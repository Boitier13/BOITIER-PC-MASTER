use std::path::{Path, PathBuf};

/// Préfixe de chemin long Windows (`\\?\`) pour dépasser la limite historique
/// de 260 caractères (MAX_PATH). Sans effet sur les autres systèmes.
pub fn long_path(path: &Path) -> PathBuf {
    #[cfg(windows)]
    {
        let raw = path.to_string_lossy();
        if raw.len() >= 240 && !raw.starts_with("\\\\?\\") && !raw.starts_with("\\\\.\\") {
            return PathBuf::from(format!("\\\\?\\{}", raw));
        }
    }
    path.to_path_buf()
}

/// Représentation affichable / comparable d'un chemin, sans préfixe technique.
pub fn display_path(path: &Path) -> String {
    let raw = path.to_string_lossy().to_string();
    raw.strip_prefix("\\\\?\\").map(str::to_string).unwrap_or(raw)
}

/// Clé de comparaison insensible à la casse (Windows) et stable.
pub fn compare_key(path: &Path) -> String {
    display_path(path).to_lowercase().replace('/', "\\")
}

/// Extension en minuscules, sans point. `None` pour les dossiers et les noms
/// sans extension (ou les fichiers cachés de type `.gitignore`).
pub fn extension_of(name: &str) -> Option<String> {
    let (stem, extension) = name.rsplit_once('.')?;
    if stem.is_empty() || extension.is_empty() || extension.len() > 16 {
        return None;
    }
    Some(extension.to_lowercase())
}

/// Catégorie stable, utilisée pour les filtres de l'interface et, plus tard,
/// pour l'agrégation des inventaires (`GROUP BY category` en SQLite).
pub fn category_for(extension: Option<&str>, is_directory: bool) -> &'static str {
    if is_directory {
        return "folder";
    }

    let extension = match extension {
        Some(value) => value.to_lowercase(),
        None => return "other",
    };
    let extension = extension.as_str();

    match extension {
        // Documents
        "pdf" | "doc" | "docx" | "odt" | "rtf" | "txt" | "md" | "xls" | "xlsx" | "ods" | "csv"
        | "ppt" | "pptx" | "odp" | "pages" | "epub" => "document",
        // Images
        "jpg" | "jpeg" | "png" | "gif" | "bmp" | "webp" | "tif" | "tiff" | "svg" | "heic" | "raw"
        | "psd" | "ico" => "image",
        // Vidéos
        "mp4" | "mkv" | "avi" | "mov" | "wmv" | "flv" | "webm" | "m4v" | "mpg" | "mpeg" => "video",
        // Audio
        "mp3" | "wav" | "flac" | "aac" | "ogg" | "wma" | "m4a" | "opus" => "audio",
        // Archives et images disque
        "zip" | "rar" | "7z" | "tar" | "gz" | "bz2" | "xz" | "iso" | "img" | "cab" | "msi" => {
            "archive"
        }
        // Exécutables, bibliothèques et pilotes
        "exe" | "dll" | "msix" | "appx" | "bat" | "cmd" | "ps1" | "sys" | "com" | "scr" => {
            "application"
        }
        // Éléments système
        "lnk" | "ini" | "inf" | "reg" | "log" | "tmp" | "dat" => "system",
        _ => "other",
    }
}

/// Extensions considérées comme système, quel que soit le dossier.
pub fn is_system_extension(extension: Option<&str>) -> bool {
    match extension {
        Some(value) => matches!(
            value.to_lowercase().as_str(),
            "sys" | "dll" | "drv" | "mui" | "cat" | "ocx" | "msc"
        ),
        None => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn extension_lowercase_et_sans_point() {
        assert_eq!(extension_of("Rapport.PDF"), Some("pdf".to_string()));
        assert_eq!(extension_of("archive.tar.gz"), Some("gz".to_string()));
        assert_eq!(extension_of("sans_extension"), None);
        assert_eq!(extension_of(".gitignore"), None);
        assert_eq!(extension_of("nom."), None);
    }

    #[test]
    fn categories_principales() {
        assert_eq!(category_for(Some("pdf"), false), "document");
        assert_eq!(category_for(Some("JPG"), false), "image"); // insensible à la casse
        assert_eq!(category_for(Some("jpg"), false), "image");
        assert_eq!(category_for(Some("mp4"), false), "video");
        assert_eq!(category_for(None, true), "folder");
        assert_eq!(category_for(Some("inconnu"), false), "other");
    }

    #[test]
    fn chemin_long_ne_casse_pas_les_chemins_courts() {
        let path = Path::new("C:\\Users\\Alexandre");
        assert_eq!(long_path(path), path.to_path_buf());
        assert_eq!(display_path(path), "C:\\Users\\Alexandre");
    }

    #[test]
    fn cle_de_comparaison_insensible_a_la_casse() {
        let a = Path::new("C:\\Users\\Alexandre\\Documents");
        let b = Path::new("c:\\users\\alexandre\\documents");
        assert_eq!(compare_key(a), compare_key(b));
    }
}
