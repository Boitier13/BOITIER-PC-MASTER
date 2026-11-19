//! Normalisation d'une clé de registre en application installée.
//!
//! Toutes les fonctions de ce module sont **pures** : elles ne touchent ni au
//! registre, ni au disque, ni à l'horloge. C'est ce qui rend les règles
//! d'exclusion et de conversion vérifiables sans Windows.

use crate::apps::model::InstalledAppDto;
use crate::apps::source::RawAppKey;

/// Décodage d'une chaîne UTF-16LE du registre (`REG_SZ`, `REG_EXPAND_SZ`).
///
/// Décodage manuel volontaire : il évite toute dépendance au type exact de la
/// valeur et conserve les accents des noms d'applications.
pub fn decode_utf16(bytes: &[u8]) -> String {
    let units: Vec<u16> = bytes
        .chunks_exact(2)
        .map(|chunk| u16::from_le_bytes([chunk[0], chunk[1]]))
        .take_while(|unit| *unit != 0)
        .collect();
    String::from_utf16_lossy(&units)
}

/// Vrai si la valeur ressemble à un GUID de produit MSI.
pub fn is_guid(value: &str) -> bool {
    let trimmed = value.trim();
    if trimmed.len() != 38
        || !trimmed.starts_with('{')
        || !trimmed.ends_with('}')
        || !trimmed.is_ascii()
    {
        return false;
    }
    trimmed[1..37].chars().all(|character| {
        character == '-' || character.is_ascii_hexdigit()
    })
}

/// Vrai pour une entrée de mise à jour Windows (KBxxxxxxx, correctif).
pub fn is_update_entry(name: &str, release_type: Option<&str>) -> bool {
    let upper = name.trim().to_ascii_uppercase();
    let looks_like_kb = upper.starts_with("KB")
        && upper.len() > 2
        && upper[2..].chars().all(|character| character.is_ascii_digit());

    let update_release = release_type
        .map(|value| {
            let value = value.to_ascii_lowercase();
            value.contains("update") || value.contains("hotfix")
        })
        .unwrap_or(false);

    looks_like_kb || update_release
}

/// Convertit `AAAAMMJJ` (registre) en millisecondes epoch UTC.
pub fn parse_install_date(value: &str) -> Option<i64> {
    let trimmed = value.trim();
    if trimmed.len() != 8 || !trimmed.chars().all(|character| character.is_ascii_digit()) {
        return None;
    }

    let year: i32 = trimmed[0..4].parse().ok()?;
    let month: u32 = trimmed[4..6].parse().ok()?;
    let day: u32 = trimmed[6..8].parse().ok()?;

    if !(1990..=2200).contains(&year) || !(1..=12).contains(&month) || day == 0 {
        return None;
    }
    if day > days_in_month(year, month) {
        return None;
    }

    let days = days_from_civil(year, month, day);
    Some(days * 86_400_000)
}

fn days_in_month(year: i32, month: u32) -> u32 {
    match month {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        2 if is_leap_year(year) => 29,
        2 => 28,
        _ => 31,
    }
}

fn is_leap_year(year: i32) -> bool {
    (year % 4 == 0 && year % 100 != 0) || year % 400 == 0
}

/// Nombre de jours écoulés depuis 1970-01-01 (algorithme civil, sans dépendance).
fn days_from_civil(year: i32, month: u32, day: u32) -> i64 {
    let year = i64::from(if month <= 2 { year - 1 } else { year });
    let era = if year >= 0 { year } else { year - 399 } / 400;
    let year_of_era = year - era * 400;
    let month_index = (i64::from(month) + 9) % 12;
    let day_of_year = (153 * month_index + 2) / 5 + i64::from(day) - 1;
    let day_of_era = year_of_era * 365 + year_of_era / 4 - year_of_era / 100 + day_of_year;
    era * 146_097 + day_of_era - 719_468
}

/// Taille en octets à partir des valeurs du registre (exprimées en Ko).
///
/// Aucune estimation par balayage de dossier : `None` si Windows ne fournit
/// rien, plutôt qu'un chiffre inventé.
pub fn size_bytes(estimated_kb: Option<u32>, install_kb: Option<u32>) -> Option<u64> {
    let kilo_bytes = match (estimated_kb, install_kb) {
        (Some(value), _) if value > 0 => value,
        (_, Some(value)) if value > 0 => value,
        _ => return None,
    };
    Some(u64::from(kilo_bytes) * 1024)
}

/// Type d'installateur déduit des chaînes de désinstallation.
pub fn installer_type(
    uninstall: Option<&str>,
    quiet: Option<&str>,
    product_code: Option<&str>,
) -> &'static str {
    let msi_hint = [uninstall, quiet]
        .into_iter()
        .flatten()
        .any(|value| value.to_ascii_lowercase().contains("msiexec"));

    if msi_hint || product_code.is_some() {
        "msi"
    } else if uninstall.is_some() || quiet.is_some() {
        "exe"
    } else {
        "unknown"
    }
}

/// Transforme une clé brute en application, ou `None` si elle doit être écartée.
///
/// Règles d'exclusion (documentées dans `docs/FEATURE_APPLICATIONS.md`) :
///  - pas de `DisplayName` exploitable ;
///  - `SystemComponent = 1` (composants internes de Windows) ;
///  - `ParentKeyName`/`ParentDisplayName` renseignés (correctifs rattachés) ;
///  - nom de mise à jour (`KB…`, `ReleaseType` de type update/hotfix).
pub fn parse_entry(raw: &RawAppKey) -> Option<InstalledAppDto> {
    let name = raw.text("DisplayName")?.trim();
    if name.is_empty() {
        return None;
    }

    if raw.number("SystemComponent") == Some(1) {
        return None;
    }

    if raw.text("ParentKeyName").is_some() || raw.text("ParentDisplayName").is_some() {
        return None;
    }

    let release_type = raw.text("ReleaseType");
    if is_update_entry(name, release_type) {
        return None;
    }

    let uninstall_string = raw.text("UninstallString").map(str::to_string);
    let quiet_uninstall_string = raw.text("QuietUninstallString").map(str::to_string);

    let product_code = if is_guid(&raw.key_name) {
        Some(raw.key_name.to_ascii_uppercase())
    } else {
        raw.text("ProductCode")
            .filter(|value| is_guid(value))
            .map(str::to_ascii_uppercase)
    };

    Some(InstalledAppDto {
        id: raw.registry_path.clone(),
        name: name.to_string(),
        publisher: raw.text("Publisher").map(str::to_string),
        version: raw.text("DisplayVersion").map(str::to_string),
        installed_at_ms: raw
            .text("InstallDate")
            .and_then(parse_install_date),
        size_bytes: size_bytes(raw.number("EstimatedSize"), raw.number("InstallSize")),
        install_location: raw.text("InstallLocation").map(str::to_string),
        has_uninstaller: uninstall_string.is_some() || quiet_uninstall_string.is_some(),
        installer_type: installer_type(
            uninstall_string.as_deref(),
            quiet_uninstall_string.as_deref(),
            product_code.as_deref(),
        )
        .to_string(),
        uninstall_string,
        quiet_uninstall_string,
        product_code,
        scope: raw.scope.as_str().to_string(),
        architecture: raw.architecture.as_str().to_string(),
        registry_path: raw.registry_path.clone(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::source::{Architecture, RawValue, Scope};

    fn raw_key(values: Vec<(&str, RawValue)>) -> RawAppKey {
        RawAppKey {
            scope: Scope::Machine,
            architecture: Architecture::X64,
            registry_path:
                "HKLM64\\SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Exemple"
                    .to_string(),
            key_name: "Exemple".to_string(),
            values: values
                .into_iter()
                .map(|(name, value)| (name.to_string(), value))
                .collect(),
        }
    }

    fn text(value: &str) -> RawValue {
        RawValue::Text(value.to_string())
    }

    #[test]
    fn une_entree_sans_nom_est_ecartee() {
        let key = raw_key(vec![("Publisher", text("Éditeur"))]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn un_nom_vide_est_ecarte() {
        let key = raw_key(vec![("DisplayName", text("   "))]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn un_composant_systeme_est_ecarte() {
        let key = raw_key(vec![
            ("DisplayName", text("Composant interne")),
            ("SystemComponent", RawValue::Number(1)),
        ]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn un_correctif_rattache_est_ecarte() {
        let key = raw_key(vec![
            ("DisplayName", text("Correctif")),
            ("ParentKeyName", text("Application")),
        ]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn une_mise_a_jour_kb_est_ecartee() {
        let key = raw_key(vec![("DisplayName", text("KB5041585"))]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn un_type_de_publication_de_mise_a_jour_est_ecarte() {
        let key = raw_key(vec![
            ("DisplayName", text("Mise à jour cumulative")),
            ("ReleaseType", text("Security Update")),
        ]);
        assert!(parse_entry(&key).is_none());
    }

    #[test]
    fn les_champs_utiles_sont_conserves() {
        let key = raw_key(vec![
            ("DisplayName", text("Google Chrome")),
            ("Publisher", text("Google LLC")),
            ("DisplayVersion", text("131.0")),
            ("InstallDate", text("20240131")),
            ("EstimatedSize", RawValue::Number(4096)),
            ("InstallLocation", text("C:\\Program Files\\Google\\Chrome")),
            ("UninstallString", text("MsiExec.exe /X{ABC}")),
        ]);

        let app = parse_entry(&key).expect("application attendue");
        assert_eq!(app.name, "Google Chrome");
        assert_eq!(app.publisher.as_deref(), Some("Google LLC"));
        assert_eq!(app.version.as_deref(), Some("131.0"));
        assert_eq!(app.installed_at_ms, Some(1_706_659_200_000));
        assert_eq!(app.size_bytes, Some(4_194_304));
        assert_eq!(app.installer_type, "msi");
        assert!(app.has_uninstaller);
        assert_eq!(app.scope, "machine");
        assert_eq!(app.architecture, "x64");
        assert_eq!(app.id, app.registry_path);
    }

    #[test]
    fn une_installation_sans_desinstalleur_est_signalee() {
        let key = raw_key(vec![("DisplayName", text("Outil portable"))]);
        let app = parse_entry(&key).expect("application attendue");
        assert!(!app.has_uninstaller);
        assert_eq!(app.installer_type, "unknown");
        assert!(app.uninstall_string.is_none());
    }

    #[test]
    fn un_executable_de_desinstallation_donne_le_type_exe() {
        let key = raw_key(vec![
            ("DisplayName", text("VLC")),
            ("UninstallString", text("\"C:\\Program Files\\VideoLAN\\uninstall.exe\"")),
        ]);
        let app = parse_entry(&key).expect("application attendue");
        assert_eq!(app.installer_type, "exe");
    }

    #[test]
    fn une_sous_cle_guid_devient_un_code_produit() {
        let mut key = raw_key(vec![("DisplayName", text("7-Zip"))]);
        key.key_name = "{23170F69-40C1-2702-2409-000001000000}".to_string();
        let app = parse_entry(&key).expect("application attendue");
        assert_eq!(
            app.product_code.as_deref(),
            Some("{23170F69-40C1-2702-2409-000001000000}")
        );
        assert_eq!(app.installer_type, "msi");
    }

    #[test]
    fn une_date_invalide_ne_produit_pas_de_date() {
        assert!(parse_install_date("2024-01-31").is_none());
        assert!(parse_install_date("20241331").is_none());
        assert!(parse_install_date("20240231").is_none());
        assert!(parse_install_date("").is_none());
    }

    #[test]
    fn une_annee_bissextile_accepte_le_29_fevrier() {
        let ms = parse_install_date("20240229").expect("29 février 2024 valide");
        assert_eq!(ms / 86_400_000, 19_782);
    }

    #[test]
    fn la_taille_prefere_estimated_size_puis_install_size() {
        assert_eq!(size_bytes(Some(10), Some(99)), Some(10_240));
        assert_eq!(size_bytes(None, Some(99)), Some(101_376));
        assert_eq!(size_bytes(Some(0), Some(0)), None);
        assert_eq!(size_bytes(None, None), None);
    }

    #[test]
    fn une_chaine_utf16_conserve_les_accents() {
        let text = "Désinstalleur — 7-Zip";
        let mut bytes: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
        bytes.extend_from_slice(&[0, 0]);
        assert_eq!(decode_utf16(&bytes), text);
    }

    #[test]
    fn un_guid_est_reconnu() {
        assert!(is_guid("{23170F69-40C1-2702-2409-000001000000}"));
        assert!(!is_guid("Exemple"));
        assert!(!is_guid("{trop-court}"));
    }
}
