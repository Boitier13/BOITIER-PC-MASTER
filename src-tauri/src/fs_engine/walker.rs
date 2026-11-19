use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::time::Instant;

use crate::fs_engine::entry::{entry_from_metadata, is_system_entry, FileEntryDto};
use crate::fs_engine::error::{EngineError, EngineResult};
use crate::fs_engine::paths::{compare_key, display_path, long_path};
use crate::fs_engine::protected::ProtectionPolicy;

/// Options d'un parcours récursif.
///
/// Toutes les bornes sont **obligatoires par défaut** : un parcours ne peut pas
/// partir à l'infini sur un volume de plusieurs téraoctets sans que
/// l'utilisateur l'ait demandé.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct WalkOptions {
    /// Profondeur maximale (0 = enfants de la racine uniquement).
    pub max_depth: usize,
    /// Nombre maximal de résultats renvoyés.
    pub max_results: usize,
    /// Garde-fou absolu sur le nombre d'entrées visitées.
    pub max_entries: usize,
    pub include_hidden: bool,
    pub include_system: bool,
    /// Filtre sur le nom (insensible à la casse, sous-chaîne).
    pub search: Option<String>,
    /// Filtre sur la catégorie (`document`, `video`, …).
    pub category: Option<String>,
    /// Taille minimale en octets (exclut les dossiers du résultat).
    pub min_size_bytes: Option<u64>,
    pub directories_only: bool,
}

impl Default for WalkOptions {
    fn default() -> Self {
        Self {
            max_depth: 12,
            max_results: 2_000,
            max_entries: 200_000,
            include_hidden: false,
            include_system: true,
            search: None,
            category: None,
            min_size_bytes: None,
            directories_only: false,
        }
    }
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalkStats {
    pub visited: u64,
    pub matched: u64,
    pub folders: u64,
    pub files: u64,
    pub denied: u64,
    pub skipped_protected: u64,
    pub total_size_bytes: u64,
    pub truncated: bool,
    pub cancelled: bool,
    pub elapsed_ms: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalkResult {
    pub root: String,
    pub entries: Vec<FileEntryDto>,
    pub stats: WalkStats,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WalkProgress {
    pub visited: u64,
    pub matched: u64,
    pub current: String,
    pub elapsed_ms: u64,
}

const PROGRESS_EVERY: u64 = 250;

fn is_hidden(entry: &FileEntryDto) -> bool {
    entry.attributes.hidden || entry.name.starts_with('.')
}

fn matches_filters(entry: &FileEntryDto, options: &WalkOptions, search: &Option<String>) -> bool {
    if !options.include_hidden && is_hidden(entry) {
        return false;
    }
    if !options.include_system && is_system_entry(entry) {
        return false;
    }
    if options.directories_only && !entry.is_directory {
        return false;
    }
    if let Some(category) = &options.category {
        if !category.is_empty() && entry.category != category.as_str() {
            return false;
        }
    }
    if let Some(minimum) = options.min_size_bytes {
        if entry.is_directory || entry.size_bytes < minimum {
            return false;
        }
    }
    if let Some(query) = search {
        if !entry.name.to_lowercase().contains(query) {
            return false;
        }
    }
    true
}

/// Parcours récursif, **itératif** (pas de récursion système : un arbre très
/// profond ne peut pas provoquer de débordement de pile).
///
/// `on_progress` est appelé périodiquement, jamais à chaque entrée, pour ne pas
/// saturer le canal d'événements de l'interface.
pub fn walk(
    root: &Path,
    options: &WalkOptions,
    policy: &ProtectionPolicy,
    cancel: &AtomicBool,
    mut on_progress: impl FnMut(WalkProgress),
) -> EngineResult<WalkResult> {
    let started = Instant::now();
    let display_root = display_path(root);

    if root.as_os_str().is_empty() {
        return Err(EngineError::InvalidPath("chemin vide".to_string()));
    }

    let metadata =
        fs::metadata(long_path(root)).map_err(|error| EngineError::from_io(error, &display_root))?;
    if !metadata.is_dir() {
        return Err(EngineError::NotADirectory(display_root));
    }

    let search = options
        .search
        .as_ref()
        .map(|value| value.trim().to_lowercase())
        .filter(|value| !value.is_empty());

    let mut stats = WalkStats::default();
    let mut entries: Vec<FileEntryDto> = Vec::new();
    let mut stack: Vec<(PathBuf, usize)> = vec![(root.to_path_buf(), 0)];
    let mut next_progress = PROGRESS_EVERY;

    while let Some((directory, depth)) = stack.pop() {
        if cancel.load(Ordering::Relaxed) {
            stats.cancelled = true;
            break;
        }

        let reader = match fs::read_dir(long_path(&directory)) {
            Ok(value) => value,
            Err(_) => {
                // Dossier illisible (droits, volume démonté, chemin trop long) :
                // on le compte et on continue, jamais d'interruption globale.
                stats.denied += 1;
                continue;
            }
        };

        for item in reader {
            if cancel.load(Ordering::Relaxed) {
                stats.cancelled = true;
                break;
            }

            if stats.visited >= options.max_entries as u64 {
                stats.truncated = true;
                break;
            }

            let item = match item {
                Ok(value) => value,
                Err(_) => {
                    stats.denied += 1;
                    continue;
                }
            };

            stats.visited += 1;

            let item_path = item.path();
            let is_symlink = item
                .file_type()
                .map(|file_type| file_type.is_symlink())
                .unwrap_or(false);

            let item_metadata = match fs::symlink_metadata(long_path(&item_path)) {
                Ok(value) => value,
                Err(_) => {
                    stats.denied += 1;
                    continue;
                }
            };

            let protected = policy.is_protected(&item_path);
            let entry = entry_from_metadata(&item_path, &item_metadata, is_symlink, protected);
            let traversable = entry.is_directory && !entry.is_symlink;
            let blocked = policy.blocks_traversal(&item_path);

            if traversable && blocked {
                stats.skipped_protected += 1;
            }

            if matches_filters(&entry, options, &search) {
                if entries.len() >= options.max_results {
                    stats.truncated = true;
                } else {
                    stats.matched += 1;
                    if entry.is_directory {
                        stats.folders += 1;
                    } else {
                        stats.files += 1;
                        stats.total_size_bytes += entry.size_bytes;
                    }
                    entries.push(entry.clone());
                }
            }

            if traversable && !blocked && depth < options.max_depth {
                // Clone d'un dossier seulement (les fichiers ne sont jamais
                // empilés) : `item_path` reste disponible pour la progression.
                stack.push((item_path.clone(), depth + 1));
            }

            if stats.visited >= next_progress {
                next_progress += PROGRESS_EVERY;
                on_progress(WalkProgress {
                    visited: stats.visited,
                    matched: stats.matched,
                    current: display_path(&item_path),
                    elapsed_ms: started.elapsed().as_millis() as u64,
                });
            }
        }
    }

    entries.sort_by(|left, right| {
        compare_key(Path::new(&left.path)).cmp(&compare_key(Path::new(&right.path)))
    });
    stats.matched = entries.len() as u64;
    stats.elapsed_ms = started.elapsed().as_millis() as u64;

    Ok(WalkResult {
        root: display_root,
        entries,
        stats,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    fn sample_tree() -> tempfile::TempDir {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let root = directory.path();
        let documents = root.join("Documents");
        fs::create_dir_all(documents.join("2024")).expect("arborescence");
        fs::create_dir_all(documents.join("2025")).expect("arborescence");
        fs::create_dir_all(root.join("Images")).expect("arborescence");
        fs::write(documents.join("2024").join("rapport.pdf"), vec![0u8; 4096]).expect("fichier");
        fs::write(documents.join("2025").join("budget.xlsx"), vec![0u8; 1024]).expect("fichier");
        fs::write(root.join("Images").join("photo.jpg"), vec![0u8; 512]).expect("fichier");
        fs::write(root.join("notes.txt"), b"notes").expect("fichier");
        fs::write(root.join("pagefile.sys"), b"x").expect("fichier système");
        directory
    }

    fn run(options: WalkOptions) -> WalkResult {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let cancel = AtomicBool::new(false);
        walk(tree.path(), &options, &policy, &cancel, |_| {}).expect("parcours")
    }

    #[test]
    fn parcours_recursif_complet() {
        let result = run(WalkOptions::default());
        assert!(result.stats.visited >= 7);
        assert!(result.stats.files >= 4);
        assert!(!result.stats.cancelled);
        assert!(!result.stats.truncated);

        let documents: Vec<_> = result
            .entries
            .iter()
            .filter(|entry| entry.category == "document")
            .collect();
        // rapport.pdf, budget.xlsx et notes.txt sont tous des « documents ».
        assert_eq!(documents.len(), 3);
        assert!(documents.iter().any(|entry| entry.name == "rapport.pdf"));
        assert!(documents.iter().any(|entry| entry.name == "budget.xlsx"));
        assert!(result.stats.total_size_bytes >= 4_096 + 1_024);
        assert!(
            result
                .entries
                .iter()
                .any(|entry| entry.name == "rapport.pdf" && !entry.is_protected)
        );
    }

    #[test]
    fn filtre_par_nom() {
        let result = run(WalkOptions {
            search: Some("RAPPORT".to_string()),
            ..WalkOptions::default()
        });
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "rapport.pdf");
    }

    #[test]
    fn filtre_par_categorie_et_taille() {
        let result = run(WalkOptions {
            category: Some("document".to_string()),
            min_size_bytes: Some(2_000),
            ..WalkOptions::default()
        });
        assert_eq!(result.entries.len(), 1);
        assert_eq!(result.entries[0].name, "rapport.pdf");
    }

    #[test]
    fn profondeur_limitee() {
        let result = run(WalkOptions {
            max_depth: 0,
            ..WalkOptions::default()
        });
        // Enfants directs uniquement : dossiers + notes.txt + pagefile.sys.
        assert!(!result.entries.iter().any(|entry| entry.name == "rapport.pdf"));
        assert!(result.entries.iter().any(|entry| entry.name == "notes.txt"));
    }

    #[test]
    fn plafond_de_resultats_signale() {
        let result = run(WalkOptions {
            max_results: 1,
            ..WalkOptions::default()
        });
        assert_eq!(result.entries.len(), 1);
        assert!(result.stats.truncated);
    }

    #[test]
    fn annulation_immediate() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let cancel = AtomicBool::new(true);
        let result = walk(tree.path(), &WalkOptions::default(), &policy, &cancel, |_| {})
            .expect("parcours");
        assert!(result.stats.cancelled);
        assert!(result.entries.is_empty());
    }

    #[test]
    fn dossier_protege_jamais_parcouru() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests().with_directory(&tree.path().join("Documents"));
        let cancel = AtomicBool::new(false);
        let result = walk(tree.path(), &WalkOptions::default(), &policy, &cancel, |_| {})
            .expect("parcours");

        assert!(!result.entries.iter().any(|entry| entry.name == "rapport.pdf"));
        assert!(result.stats.skipped_protected >= 1);

        let protected_entry = result
            .entries
            .iter()
            .find(|entry| entry.name == "Documents")
            .expect("dossier signalé");
        assert!(protected_entry.is_protected);
    }

    #[test]
    fn progression_remontee_par_lots() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let cancel = AtomicBool::new(false);
        let mut events = 0;
        walk(tree.path(), &WalkOptions::default(), &policy, &cancel, |_| {
            events += 1;
        })
        .expect("parcours");
        // 8 entrées < PROGRESS_EVERY : aucun événement n'est nécessaire.
        assert_eq!(events, 0);
    }

    #[test]
    fn racine_fichier_refusee() {
        let tree = sample_tree();
        let policy = ProtectionPolicy::for_tests();
        let cancel = AtomicBool::new(false);
        let error = walk(
            &tree.path().join("notes.txt"),
            &WalkOptions::default(),
            &policy,
            &cancel,
            |_| {},
        )
        .expect_err("doit échouer");
        assert_eq!(error.code(), "not_a_directory");
    }
}
