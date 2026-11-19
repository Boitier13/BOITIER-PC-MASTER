use serde::Serialize;
use std::fs::Metadata;
use std::io;
use std::path::Path;
use std::time::{SystemTime, UNIX_EPOCH};

use crate::fs_engine::error::{EngineError, EngineResult};
use crate::fs_engine::paths::{
    category_for, display_path, extension_of, is_system_extension, long_path,
};

/// Attributs de fichier, uniformisés entre systèmes.
///
/// Sur Windows ils proviennent de `FILE_ATTRIBUTE_*` ; ailleurs seuls
/// `readonly` et `hidden` (nom commençant par un point) sont renseignés.
/// `raw` conserve la valeur brute Windows pour les besoins du diagnostic.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileAttributes {
    pub readonly: bool,
    pub hidden: bool,
    pub system: bool,
    pub archive: bool,
    pub directory: bool,
    pub reparse_point: bool,
    pub offline: bool,
    pub temporary: bool,
    pub sparse: bool,
    pub compressed: bool,
    pub encrypted: bool,
    pub raw: u32,
}

#[cfg(windows)]
mod win {
    pub const READONLY: u32 = 0x0000_0001;
    pub const HIDDEN: u32 = 0x0000_0002;
    pub const SYSTEM: u32 = 0x0000_0004;
    pub const DIRECTORY: u32 = 0x0000_0010;
    pub const ARCHIVE: u32 = 0x0000_0020;
    pub const TEMPORARY: u32 = 0x0000_0100;
    pub const SPARSE_FILE: u32 = 0x0000_0200;
    pub const REPARSE_POINT: u32 = 0x0000_0400;
    pub const COMPRESSED: u32 = 0x0000_0800;
    pub const OFFLINE: u32 = 0x0000_1000;
    pub const ENCRYPTED: u32 = 0x0000_4000;
}

#[cfg(windows)]
fn attributes_from(metadata: &Metadata, _name: &str) -> FileAttributes {
    use std::os::windows::fs::MetadataExt;

    let raw = metadata.file_attributes();
    FileAttributes {
        readonly: raw & win::READONLY != 0,
        hidden: raw & win::HIDDEN != 0,
        system: raw & win::SYSTEM != 0,
        archive: raw & win::ARCHIVE != 0,
        directory: raw & win::DIRECTORY != 0,
        reparse_point: raw & win::REPARSE_POINT != 0,
        offline: raw & win::OFFLINE != 0,
        temporary: raw & win::TEMPORARY != 0,
        sparse: raw & win::SPARSE_FILE != 0,
        compressed: raw & win::COMPRESSED != 0,
        encrypted: raw & win::ENCRYPTED != 0,
        raw,
    }
}

#[cfg(not(windows))]
fn attributes_from(metadata: &Metadata, name: &str) -> FileAttributes {
    FileAttributes {
        readonly: metadata.permissions().readonly(),
        hidden: name.starts_with('.'),
        directory: metadata.is_dir(),
        ..FileAttributes::default()
    }
}

/// Une entrée de fichier ou de dossier, telle que consommée par l'interface.
///
/// Les horodatages sont exposés en **millisecondes depuis l'époque UNIX**
/// (facile à trier, à stocker en SQLite et à formater côté TypeScript avec
/// `Intl.DateTimeFormat`), et non en chaînes déjà formatées.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileEntryDto {
    pub name: String,
    pub path: String,
    pub parent: Option<String>,
    pub extension: Option<String>,
    /// Catégorie stable : `folder`, `document`, `image`, `video`, `audio`,
    /// `archive`, `application`, `system`, `other`.
    pub category: &'static str,
    pub size_bytes: u64,
    pub created_at_ms: Option<u64>,
    pub modified_at_ms: Option<u64>,
    pub accessed_at_ms: Option<u64>,
    pub is_directory: bool,
    pub is_symlink: bool,
    /// Dossier ou fichier système sensible (voir `ProtectionPolicy`).
    pub is_protected: bool,
    /// Renseigné quand le système d'exploitation refuse la lecture des
    /// métadonnées : l'entrée reste affichée, sans taille ni dates.
    pub access_denied: bool,
    pub attributes: FileAttributes,
}

fn to_millis(time: io::Result<SystemTime>) -> Option<u64> {
    let time = time.ok()?;
    let since_epoch = time.duration_since(UNIX_EPOCH).ok()?;
    Some(since_epoch.as_millis() as u64)
}

/// Construit un DTO à partir de métadonnées déjà lues.
pub fn entry_from_metadata(
    path: &Path,
    metadata: &Metadata,
    is_symlink: bool,
    is_protected: bool,
) -> FileEntryDto {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| display_path(path));

    let extension = extension_of(&name);
    let is_directory = metadata.is_dir() && !is_symlink;
    let attributes = attributes_from(metadata, &name);

    FileEntryDto {
        category: category_for(extension.as_deref(), is_directory),
        extension,
        parent: path
            .parent()
            .filter(|parent| !parent.as_os_str().is_empty())
            .map(display_path),
        path: display_path(path),
        name,
        size_bytes: if is_directory { 0 } else { metadata.len() },
        created_at_ms: to_millis(metadata.created()),
        modified_at_ms: to_millis(metadata.modified()),
        accessed_at_ms: to_millis(metadata.accessed()),
        is_directory,
        is_symlink,
        is_protected,
        access_denied: false,
        attributes,
    }
}

/// Entrée « métadonnées illisibles » : on préfère afficher le nom avec un état
/// explicite plutôt que masquer l'élément (exigence « erreurs d'accès »).
pub fn denied_entry(path: &Path, is_protected: bool) -> FileEntryDto {
    let name = path
        .file_name()
        .map(|value| value.to_string_lossy().to_string())
        .unwrap_or_else(|| display_path(path));
    let extension = extension_of(&name);

    FileEntryDto {
        category: category_for(extension.as_deref(), false),
        extension,
        parent: path.parent().map(display_path),
        path: display_path(path),
        name,
        size_bytes: 0,
        created_at_ms: None,
        modified_at_ms: None,
        accessed_at_ms: None,
        is_directory: false,
        is_symlink: false,
        is_protected,
        access_denied: true,
        attributes: FileAttributes::default(),
    }
}

/// Lit les métadonnées d'un chemin quelconque **sans** suivre un lien final.
pub fn entry_for_path(path: &Path, policy: &crate::fs_engine::ProtectionPolicy) -> EngineResult<FileEntryDto> {
    let metadata =
        std::fs::symlink_metadata(long_path(path)).map_err(|error| EngineError::from_io(error, &display_path(path)))?;
    let is_symlink = metadata.file_type().is_symlink();
    Ok(entry_from_metadata(path, &metadata, is_symlink, policy.is_protected(path)))
}

/// Un fichier est « système » s'il porte l'attribut Windows ou une extension
/// système reconnue : sert au filtre « masquer les fichiers système ».
pub fn is_system_entry(entry: &FileEntryDto) -> bool {
    entry.attributes.system || is_system_extension(entry.extension.as_deref())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn dossier_temp_porte_les_bonnes_metadonnees() {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let file = directory.path().join("Rapport Annuel.PDF");
        fs::write(&file, b"contenu de test").expect("écriture du fichier de test");

        let policy = crate::fs_engine::ProtectionPolicy::for_tests();
        let entry = entry_for_path(&file, &policy).expect("métadonnées");

        assert_eq!(entry.name, "Rapport Annuel.PDF");
        assert_eq!(entry.extension.as_deref(), Some("pdf"));
        assert_eq!(entry.category, "document");
        assert_eq!(entry.size_bytes, 15);
        assert!(!entry.is_directory);
        assert!(!entry.is_symlink);
        assert!(entry.modified_at_ms.is_some());
    }

    #[test]
    fn dossier_detecte_comme_tel() {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let policy = crate::fs_engine::ProtectionPolicy::for_tests();
        let entry = entry_for_path(directory.path(), &policy).expect("métadonnées");

        assert!(entry.is_directory);
        assert_eq!(entry.category, "folder");
        assert_eq!(entry.size_bytes, 0);
        assert!(entry.extension.is_none());
    }

    #[test]
    fn chemin_absent_renvoie_not_found() {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let policy = crate::fs_engine::ProtectionPolicy::for_tests();
        let error = entry_for_path(&directory.path().join("fantome.txt"), &policy)
            .expect_err("doit échouer");
        assert_eq!(error.code(), "not_found");
    }
}
