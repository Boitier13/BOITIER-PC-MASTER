//! Lecture réelle du registre Windows, **strictement en lecture**.
//!
//! Seul module du projet qui parle à `winreg`, et uniquement avec `KEY_READ` :
//! aucune fonction d'écriture (`set_value`, `create_subkey`, `delete_subkey`)
//! n'est appelée nulle part. Aucune valeur n'est modifiée, aucun programme
//! n'est lancé.

use winreg::enums::{
    HKEY_CURRENT_USER, HKEY_LOCAL_MACHINE, KEY_READ, KEY_WOW64_32KEY, KEY_WOW64_64KEY, REG_DWORD,
    REG_EXPAND_SZ, REG_SZ,
};
use winreg::RegKey;

use crate::apps::model::AppSourceStatus;
use crate::apps::parse::decode_utf16;
use crate::apps::source::{Architecture, RawAppKey, RawValue, RegistrySource, Scope, SourceRead};

/// Clé standard des applications installées, dans chaque ruche.
const UNINSTALL_KEY: &str = r"SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall";

/// Valeurs utiles, lues une par une. Toute valeur absente est simplement ignorée.
const VALUE_NAMES: [&str; 13] = [
    "DisplayName",
    "DisplayVersion",
    "Publisher",
    "InstallDate",
    "EstimatedSize",
    "InstallSize",
    "InstallLocation",
    "UninstallString",
    "QuietUninstallString",
    "SystemComponent",
    "ParentKeyName",
    "ParentDisplayName",
    "ReleaseType",
];

/// Source réelle : trois vues du registre (machine 64/32 bits, utilisateur).
pub struct SystemRegistry;

impl RegistrySource for SystemRegistry {
    fn read_all(&self) -> SourceRead {
        let mut read = SourceRead::default();

        read_branch(
            &mut read,
            "hklm64",
            "Ordinateur — applications 64 bits",
            RegKey::predef(HKEY_LOCAL_MACHINE),
            KEY_READ | KEY_WOW64_64KEY,
            Scope::Machine,
            Architecture::native(),
        );
        read_branch(
            &mut read,
            "hklm32",
            "Ordinateur — applications 32 bits",
            RegKey::predef(HKEY_LOCAL_MACHINE),
            KEY_READ | KEY_WOW64_32KEY,
            Scope::Machine,
            Architecture::X86,
        );
        read_branch(
            &mut read,
            "hkcu",
            "Utilisateur courant",
            RegKey::predef(HKEY_CURRENT_USER),
            KEY_READ,
            Scope::User,
            Architecture::native(),
        );

        read
    }
}

/// Lit une ruche. Un refus global n'interrompt jamais les deux autres.
fn read_branch(
    read: &mut SourceRead,
    id: &str,
    label: &str,
    root: RegKey,
    flags: u32,
    scope: Scope,
    architecture: Architecture,
) {
    let key = match root.open_subkey_with_flags(UNINSTALL_KEY, flags) {
        Ok(key) => key,
        Err(error) => {
            read.statuses.push(AppSourceStatus {
                id: id.to_string(),
                label: label.to_string(),
                accessible: false,
                entries: 0,
                denied: 0,
                error: Some(format!("Clé « Uninstall » inaccessible : {error}")),
            });
            return;
        }
    };

    let mut entries = 0usize;
    let mut denied = 0usize;

    for name in key.enum_keys() {
        let name = match name {
            Ok(name) => name,
            Err(_) => {
                denied += 1;
                continue;
            }
        };

        let sub = match key.open_subkey_with_flags(&name, flags) {
            Ok(sub) => sub,
            Err(_) => {
                denied += 1;
                continue;
            }
        };

        let values: Vec<(String, RawValue)> = VALUE_NAMES
            .iter()
            .filter_map(|value_name| {
                read_value(&sub, *value_name).map(|value| ((*value_name).to_string(), value))
            })
            .collect();

        if values.is_empty() {
            continue;
        }

        entries += 1;
        read.entries.push(RawAppKey {
            scope,
            architecture,
            registry_path: format!("{}\\{}\\{}", id.to_ascii_uppercase(), UNINSTALL_KEY, name),
            key_name: name,
            values,
        });
    }

    read.statuses.push(AppSourceStatus {
        id: id.to_string(),
        label: label.to_string(),
        accessible: true,
        entries,
        denied,
        error: None,
    });
}

/// Décodage d'une valeur sans dépendre du type exact déclaré par l'éditeur.
fn read_value(key: &RegKey, name: &str) -> Option<RawValue> {
    let raw = key.get_raw_value(name).ok()?;

    match raw.vtype {
        REG_SZ | REG_EXPAND_SZ => {
            let text = decode_utf16(&raw.bytes);
            let text = text.trim();
            if text.is_empty() {
                None
            } else {
                Some(RawValue::Text(text.to_string()))
            }
        }
        REG_DWORD if raw.bytes.len() >= 4 => Some(RawValue::Number(u32::from_le_bytes([
            raw.bytes[0],
            raw.bytes[1],
            raw.bytes[2],
            raw.bytes[3],
        ]))),
        _ => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::apps::parse::parse_entry;

    /// Vérification réelle, exécutée par la CI Windows : l'inventaire doit
    /// contenir des applications et respecter les invariants du contrat.
    /// Aucune écriture n'est effectuée.
    #[test]
    fn l_inventaire_reel_est_lisible_et_coherent() {
        let read = SystemRegistry.read_all();

        assert_eq!(read.statuses.len(), 3, "trois ruches doivent être rapportées");
        assert!(
            read.statuses.iter().any(|status| status.accessible),
            "au moins une ruche doit être accessible"
        );

        let apps: Vec<_> = read.entries.iter().filter_map(parse_entry).collect();
        assert!(
            !apps.is_empty(),
            "le runner Windows doit exposer au moins une application"
        );

        for app in &apps {
            assert!(!app.name.trim().is_empty());
            assert!(app.scope == "machine" || app.scope == "user");
            assert!(
                app.size_bytes.map(|size| size > 0).unwrap_or(true),
                "une taille connue est toujours strictement positive"
            );
        }
    }
}
