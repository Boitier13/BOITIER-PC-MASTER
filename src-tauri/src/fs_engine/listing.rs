use serde::{Deserialize, Serialize};
use std::fs;
use std::path::Path;

use crate::fs_engine::entry::{entry_from_metadata, FileEntryDto};
use crate::fs_engine::error::{EngineError, EngineResult};
use crate::fs_engine::paths::{compare_key, display_path, long_path};
use crate::fs_engine::protected::ProtectionPolicy;

/// Options d'un listage de dossier (une seule « couche », sans récursion).
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct ListOptions {
    pub include_hidden: bool,
    pub include_system: bool,
    pub directories_first: bool,
    /// Plafond de sécurité : au-delà, la liste est tronquée et signalée comme
    /// telle (`truncated: true`).
    pub max_entries: usize,
}

impl Default for ListOptions {
    fn default() -> Self {
        Self {
            include_hidden: false,
            include_system: true,
            directories_first: true,
            max_entries: 5_000,
        }
    }
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DirectoryListingDto {
    pub path: String,
    pub parent: Option<String>,
    pub entries: Vec<FileEntryDto>,
    /// Nombre d'entrées réellement présentes dans le dossier.
    pub total: usize,
    /// `true` si `max_entries` a été atteint.
    pub truncated: bool,
    /// Nombre d'entrées dont les métadonnées n'ont pas pu être lues.
    pub denied: usize,
    /// `true` si le dossier lui-même est protégé (contenu affiché, pas de
    /// parcours récursif autorisé).
    pub is_protected: bool,
}

fn parent_of(path: &Path) -> Option<String> {
    let current = display_path(path);
    path.parent()
        .map(display_path)
        .filter(|parent| !parent.is_empty() && parent != &current)
}

fn sort_entries(entries: &mut [FileEntryDto], directories_first: bool) {
    entries.sort_by(|left, right| {
        if directories_first && left.is_directory != right.is_directory {
            return right.is_directory.cmp(&left.is_directory);
        }
        compare_key(Path::new(&left.name)).cmp(&compare_key(Path::new(&right.name)))
    });
}

fn is_hidden(entry: &FileEntryDto) -> bool {
    entry.attributes.hidden || entry.name.starts_with('.')
}

/// Liste le contenu immédiat d'un dossier.
///
/// Le dossier peut être protégé : son contenu reste consultable (l'utilisateur
/// a le droit de le lire) mais le parcours récursif l'exclura.
pub fn list_directory(
    path: &Path,
    options: &ListOptions,
    policy: &ProtectionPolicy,
) -> EngineResult<DirectoryListingDto> {
    if path.as_os_str().is_empty() {
        return Err(EngineError::InvalidPath("chemin vide".to_string()));
    }

    let display = display_path(path);
    let metadata = fs::metadata(long_path(path)).map_err(|error| EngineError::from_io(error, &display))?;
    if !metadata.is_dir() {
        return Err(EngineError::NotADirectory(display));
    }

    let reader = fs::read_dir(long_path(path)).map_err(|error| EngineError::from_io(error, &display))?;

    let mut entries = Vec::new();
    let mut total = 0usize;
    let mut denied = 0usize;
    let mut truncated = false;

    for item in reader {
        let item = match item {
            Ok(value) => value,
            Err(_) => {
                denied += 1;
                continue;
            }
        };

        total += 1;

        let item_path = item.path();
        let is_symlink = item
            .file_type()
            .map(|file_type| file_type.is_symlink())
            .unwrap_or(false);

        let item_metadata = match fs::symlink_metadata(long_path(&item_path)) {
            Ok(value) => value,
            Err(_) => {
                denied += 1;
                continue;
            }
        };

        let entry = entry_from_metadata(
            &item_path,
            &item_metadata,
            is_symlink,
            policy.is_protected(&item_path),
        );

        if !options.include_hidden && is_hidden(&entry) {
            continue;
        }
        if !options.include_system && crate::fs_engine::entry::is_system_entry(&entry) {
            continue;
        }

        if entries.len() >= options.max_entries {
            truncated = true;
            continue;
        }

        entries.push(entry);
    }

    sort_entries(&mut entries, options.directories_first);

    Ok(DirectoryListingDto {
        parent: parent_of(path),
        path: display,
        entries,
        total,
        truncated,
        denied,
        is_protected: policy.is_protected(path),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sample_tree() -> tempfile::TempDir {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let root = directory.path();
        fs::create_dir(root.join("Documents")).expect("dossier");
        fs::create_dir(root.join("Images")).expect("dossier");
        fs::write(root.join("rapport.pdf"), vec![0u8; 2048]).expect("fichier");
        fs::write(root.join("photo.jpg"), vec![0u8; 512]).expect("fichier");
        fs::write(root.join(".cache"), b"x").expect("fichier caché");
        directory
    }

    #[test]
    fn listage_trie_dossiers_puis_fichiers() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let listing = list_directory(tree.path(), &ListOptions::default(), &policy).expect("listage");

        assert_eq!(listing.total, 5);
        assert_eq!(listing.entries.len(), 4); // `.cache` masqué par défaut
        assert!(listing.entries[0].is_directory);
        assert!(listing.entries[1].is_directory);
        assert_eq!(listing.entries[2].name, "photo.jpg");
        assert_eq!(listing.entries[2].category, "image");
        assert_eq!(listing.entries[3].size_bytes, 2048);
        assert!(!listing.truncated);
        assert_eq!(listing.denied, 0);
    }

    #[test]
    fn fichiers_caches_inclus_sur_demande() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let options = ListOptions {
            include_hidden: true,
            ..ListOptions::default()
        };
        let listing = list_directory(tree.path(), &options, &policy).expect("listage");
        assert_eq!(listing.entries.len(), 5);
        assert!(listing.entries.iter().any(|entry| entry.name == ".cache"));
    }

    #[test]
    fn plafond_de_securite_signale_la_troncature() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let options = ListOptions {
            max_entries: 2,
            ..ListOptions::default()
        };
        let listing = list_directory(tree.path(), &options, &policy).expect("listage");
        assert_eq!(listing.entries.len(), 2);
        assert!(listing.truncated);
        assert_eq!(listing.total, 5);
    }

    #[test]
    fn fichier_ordinaire_refuse_comme_dossier() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let error = list_directory(&tree.path().join("rapport.pdf"), &ListOptions::default(), &policy)
            .expect_err("doit échouer");
        assert_eq!(error.code(), "not_a_directory");
    }

    #[test]
    fn chemin_absent_renvoie_not_found() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let error = list_directory(&tree.path().join("absent"), &ListOptions::default(), &policy)
            .expect_err("doit échouer");
        assert_eq!(error.code(), "not_found");
    }

    #[test]
    fn parent_du_dossier_est_renseigne() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let listing = list_directory(&tree.path().join("Documents"), &ListOptions::default(), &policy)
            .expect("listage");
        assert_eq!(listing.parent.as_deref(), Some(display_path(tree.path()).as_str()));
    }
}
