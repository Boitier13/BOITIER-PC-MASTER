use serde::Serialize;
use std::path::PathBuf;

/// Dossier d'accès rapide exposé à l'interface.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UserFolderDto {
    pub id: &'static str,
    pub label: &'static str,
    pub path: String,
}

/// Dossiers standard de l'utilisateur courant, uniquement s'ils existent.
///
/// Le chemin est toujours celui du système réel (`Desktop`, `Downloads`…) même
/// si Windows l'affiche en français : le moteur ne devine jamais un nom localisé.
pub fn user_folders() -> Vec<UserFolderDto> {
    let profile = match std::env::var("USERPROFILE").or_else(|_| std::env::var("HOME")) {
        Ok(value) if !value.trim().is_empty() => PathBuf::from(value),
        _ => return Vec::new(),
    };

    let candidates: [(&'static str, &'static str, PathBuf); 7] = [
        ("home", "Profil", profile.clone()),
        ("desktop", "Bureau", profile.join("Desktop")),
        ("downloads", "Téléchargements", profile.join("Downloads")),
        ("documents", "Documents", profile.join("Documents")),
        ("pictures", "Images", profile.join("Pictures")),
        ("music", "Musique", profile.join("Music")),
        ("videos", "Vidéos", profile.join("Videos")),
    ];

    candidates
        .into_iter()
        .filter(|(_, _, path)| path.is_dir())
        .map(|(id, label, path)| UserFolderDto {
            id,
            label,
            path: path.to_string_lossy().to_string(),
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identifiants_uniques_et_chemins_absolus() {
        let folders = user_folders();
        let mut ids: Vec<&str> = folders.iter().map(|folder| folder.id).collect();
        let unique_before = ids.len();
        ids.dedup();
        assert_eq!(ids.len(), unique_before);

        for folder in &folders {
            assert!(PathBuf::from(&folder.path).is_absolute(), "{}", folder.path);
        }
    }
}
