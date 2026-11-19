use std::path::Path;

use crate::fs_engine::paths::compare_key;

/// Politique de protection des emplacements sensibles de Windows.
///
/// Deux usages :
///  - `is_protected` : l'élément est affiché mais signalé (badge « protégé ») ;
///  - `blocks_traversal` : le parcours récursif ne descend pas dedans, ce qui
///    évite les énormes dossiers système (WinSxS), les pseudo-dossiers
///    ($Recycle.Bin) et les répertoires dont la lecture déclenche des invites
///    de sécurité.
pub struct ProtectionPolicy {
    directory_prefixes: Vec<String>,
    file_names: Vec<String>,
}

fn push_unique(target: &mut Vec<String>, value: String) {
    let key = value.to_lowercase().replace('/', "\\");
    if !key.is_empty() && !target.contains(&key) {
        target.push(key);
    }
}

impl ProtectionPolicy {
    /// Politique vide : utilisée par les tests.
    #[cfg(test)]
    pub fn empty() -> Self {
        Self {
            directory_prefixes: Vec::new(),
            file_names: Vec::new(),
        }
    }

    /// Politique neutre pour les tests unitaires (aucune interférence avec les
    /// chemins temporaires).
    #[cfg(test)]
    pub fn for_tests() -> Self {
        Self::empty()
    }

    /// Politique par défaut, construite à partir des variables d'environnement
    /// (`SystemDrive`, `WINDIR`, `ProgramData`) pour rester valable sur un
    /// système installé sur un autre lecteur que `C:`.
    pub fn platform_default() -> Self {
        #[cfg(windows)]
        {
            let system_drive = std::env::var("SystemDrive").unwrap_or_else(|_| "C:".to_string());
            let windows_dir = std::env::var("WINDIR")
                .unwrap_or_else(|_| format!("{system_drive}\\Windows"));
            let program_data = std::env::var("ProgramData")
                .unwrap_or_else(|_| format!("{system_drive}\\ProgramData"));

            let mut directories = Vec::new();
            // Dossiers système à ne jamais parcourir.
            push_unique(&mut directories, format!("{windows_dir}\\WinSxS"));
            push_unique(&mut directories, format!("{windows_dir}\\System32\\config"));
            push_unique(&mut directories, format!("{windows_dir}\\System32\\DriverStore"));
            push_unique(&mut directories, format!("{windows_dir}\\Installer"));
            push_unique(&mut directories, format!("{windows_dir}\\servicing"));
            push_unique(&mut directories, format!("{windows_dir}\\CSC"));
            push_unique(&mut directories, format!("{windows_dir}\\assembly"));
            push_unique(&mut directories, format!("{windows_dir}\\Prefetch"));
            push_unique(&mut directories, format!("{windows_dir}\\Temp"));
            push_unique(&mut directories, format!("{program_data}\\Microsoft\\Windows\\SystemData"));
            // Pseudo-dossiers présents à la racine de chaque volume.
            push_unique(&mut directories, format!("{system_drive}\\System Volume Information"));
            push_unique(&mut directories, format!("{system_drive}\\$Recycle.Bin"));
            push_unique(&mut directories, format!("{system_drive}\\Recovery"));

            let mut files = Vec::new();
            for name in [
                "pagefile.sys",
                "hiberfil.sys",
                "swapfile.sys",
                "dumpstack.log.tmp",
                "ntuser.dat",
                "ntuser.dat.log1",
                "ntuser.dat.log2",
            ] {
                push_unique(&mut files, name.to_string());
            }

            return Self {
                directory_prefixes: directories,
                file_names: files,
            };
        }

        #[cfg(not(windows))]
        {
            let mut directories = Vec::new();
            for prefix in ["/proc", "/sys", "/dev", "/run"] {
                push_unique(&mut directories, prefix.to_string());
            }
            Self {
                directory_prefixes: directories,
                file_names: Vec::new(),
            }
        }
    }

    /// Ajoute un préfixe de dossier protégé (utilisé par les tests et par la
    /// configuration future « exclusions utilisateur »).
    #[cfg(test)]
    pub fn with_directory(mut self, path: &Path) -> Self {
        push_unique(&mut self.directory_prefixes, compare_key(path));
        self
    }

    pub fn is_protected(&self, path: &Path) -> bool {
        let key = compare_key(path);
        if self
            .directory_prefixes
            .iter()
            .any(|prefix| key == *prefix || key.starts_with(&format!("{prefix}\\")))
        {
            return true;
        }

        match path.file_name() {
            Some(name) => {
                let name = name.to_string_lossy().to_lowercase();
                self.file_names.iter().any(|candidate| candidate == &name)
            }
            None => false,
        }
    }

    /// Un dossier protégé est affiché, jamais parcouru.
    pub fn blocks_traversal(&self, path: &Path) -> bool {
        self.is_protected(path)
    }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prefixes_windows_proteges() {
        let policy = ProtectionPolicy::for_tests()
            .with_directory(Path::new("C:\\Windows\\WinSxS"))
            .with_directory(Path::new("D:\\System Volume Information"));

        assert!(policy.is_protected(Path::new("C:\\Windows\\WinSxS")));
        assert!(policy.is_protected(Path::new("c:\\windows\\winsxs\\temp\\fichier.dll")));
        assert!(policy.is_protected(Path::new("D:\\System Volume Information\\IndexerVolumeGuid")));
        assert!(!policy.is_protected(Path::new("C:\\Windows\\System32")));
        assert!(!policy.is_protected(Path::new("C:\\Users\\Alexandre")));
    }

    #[test]
    fn prefixes_ne_matchent_pas_un_voisin_de_nom() {
        let policy = ProtectionPolicy::for_tests().with_directory(Path::new("C:\\Windows\\Temp"));
        assert!(!policy.is_protected(Path::new("C:\\Windows\\Temporary")));
    }

    #[test]
    fn pseudo_fichiers_reconnus() {
        assert!(is_pseudo_file_name("PAGEFILE.SYS"));
        assert!(is_pseudo_file_name("hiberfil.sys"));
        assert!(!is_pseudo_file_name("rapport.sys"));
    }
}
