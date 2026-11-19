use serde::Serialize;
use std::path::Path;
use sysinfo::Disks;

use crate::fs_engine::paths::display_path;

/// Un volume monté (lecteur Windows `C:`, ou point de montage ailleurs).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VolumeDto {
    /// Lettre du lecteur (`C:`) ou point de montage (`/`).
    pub letter: String,
    pub label: String,
    /// Code stable : `ssd`, `hdd`, `removable`, `unknown`.
    pub kind: String,
    pub filesystem: Option<String>,
    pub mount_point: String,
    pub total_bytes: u64,
    pub free_bytes: u64,
    pub used_bytes: u64,
    pub is_removable: bool,
    /// `true` pour le volume qui porte Windows.
    pub is_system: bool,
}

/// `C:\` → `C:` ; `None` pour tout autre forme de point de montage.
fn drive_letter(mount_point: &Path) -> Option<String> {
    let raw = mount_point.to_string_lossy();
    let mut characters = raw.chars();
    let letter = characters.next()?;
    if !letter.is_ascii_alphabetic() || characters.next()? != ':' {
        return None;
    }
    Some(format!("{}:", letter.to_ascii_uppercase()))
}

/// Le type de média est décrit par `Debug` pour ne pas dépendre des variantes
/// exactes de `DiskKind` : `SSD`, `HDD`, `Unknown(..)`.
fn media_kind<T: std::fmt::Debug>(kind: &T, is_removable: bool) -> String {
    if is_removable {
        return "removable".to_string();
    }
    let raw = format!("{kind:?}").to_lowercase();
    if raw.starts_with("ssd") {
        "ssd".to_string()
    } else if raw.starts_with("hdd") {
        "hdd".to_string()
    } else {
        "unknown".to_string()
    }
}

fn non_empty(value: std::borrow::Cow<'_, str>) -> Option<String> {
    let trimmed = value.trim().to_string();
    if trimmed.is_empty() {
        None
    } else {
        Some(trimmed)
    }
}

/// Énumère les volumes réellement présents.
///
/// Aucun accès en écriture, aucune requête d'élévation : seules les
/// informations de capacité exposées par le système sont lues.
pub fn list_volumes() -> Vec<VolumeDto> {
    let disks = Disks::new_with_refreshed_list();
    let system_drive = std::env::var("SystemDrive")
        .unwrap_or_else(|_| "C:".to_string())
        .to_uppercase();

    let mut volumes: Vec<VolumeDto> = disks
        .list()
        .iter()
        .filter_map(|disk| {
            let mount_point = disk.mount_point();
            let letter = match drive_letter(mount_point) {
                Some(value) => value,
                // Hors Windows, un volume peut être monté sur `/` ou `/home`.
                None if !cfg!(windows) => display_path(mount_point),
                None => return None,
            };

            let total_bytes = disk.total_space();
            let free_bytes = disk.available_space();
            let label = non_empty(disk.name().to_string_lossy())
                .unwrap_or_else(|| "Disque local".to_string());
            let filesystem = non_empty(disk.file_system().to_string_lossy());
            let is_removable = disk.is_removable();
            let is_system = if cfg!(windows) {
                letter.eq_ignore_ascii_case(&system_drive)
            } else {
                display_path(mount_point) == "/"
            };

            Some(VolumeDto {
                letter,
                label,
                kind: media_kind(&disk.kind(), is_removable),
                filesystem,
                mount_point: display_path(mount_point),
                total_bytes,
                free_bytes,
                used_bytes: total_bytes.saturating_sub(free_bytes),
                is_removable,
                is_system,
            })
        })
        .collect();

    volumes.sort_by(|left, right| left.letter.cmp(&right.letter));
    volumes.dedup_by(|left, right| left.mount_point.eq_ignore_ascii_case(&right.mount_point));
    volumes
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lettre_de_lecteur_windows() {
        assert_eq!(drive_letter(Path::new("C:\\")), Some("C:".to_string()));
        assert_eq!(drive_letter(Path::new("d:\\")), Some("D:".to_string()));
        assert_eq!(drive_letter(Path::new("/")), None);
        assert_eq!(drive_letter(Path::new("C")), None);
    }

    #[derive(Debug)]
    enum Kind {
        SSD,
        HDD,
        Unknown,
    }

    #[test]
    fn type_de_media_stable() {
        assert_eq!(media_kind(&Kind::SSD, true), "removable");
        assert_eq!(media_kind(&Kind::SSD, false), "ssd");
        assert_eq!(media_kind(&Kind::HDD, false), "hdd");
        assert_eq!(media_kind(&Kind::Unknown, false), "unknown");
    }

    #[test]
    fn enumeration_sans_panique() {
        // Sur une machine sans disque détectable, la liste est simplement vide.
        let volumes = list_volumes();
        for volume in volumes {
            assert!(volume.used_bytes <= volume.total_bytes);
        }
    }
}
