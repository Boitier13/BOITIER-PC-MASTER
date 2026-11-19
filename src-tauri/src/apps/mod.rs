//! Inventaire des applications Windows, en **lecture seule**.
//!
//! Le module lit les clés `Uninstall` du registre (machine 64 bits, machine
//! 32 bits, utilisateur courant), normalise chaque entrée, écarte le bruit
//! (composants système, correctifs, mises à jour), déduplique, filtre, trie et
//! pagine.
//!
//! Ce qui n'est **jamais** fait ici :
//!  - aucune écriture dans le registre ni sur le disque ;
//!  - aucun lancement de désinstalleur (`std::process` absent du projet) ;
//!  - aucune estimation de taille par balayage : la taille vient de Windows ou
//!    reste inconnue.
//!
//! Limite assumée : les applications MSIX/Store ne figurent pas dans ces clés
//! et ne sont donc pas inventoriées par cette version.

pub mod filter;
pub mod model;
pub mod parse;
pub mod source;

#[cfg(windows)]
mod windows;

#[cfg(windows)]
pub use windows::SystemRegistry;

use std::time::{SystemTime, UNIX_EPOCH};

use crate::apps::filter::build_inventory;
use crate::apps::parse::parse_entry;
use crate::apps::source::SourceRead;

pub use crate::apps::model::{AppInventory, AppListQuery, AppSourceStatus};
pub use crate::apps::source::RegistrySource;

/// Source neutre hors Windows : l'application reste utilisable, et l'absence de
/// données est expliquée au lieu d'être masquée par des exemples.
#[cfg(not(windows))]
pub struct SystemRegistry;

#[cfg(not(windows))]
impl RegistrySource for SystemRegistry {
    fn read_all(&self) -> SourceRead {
        SourceRead {
            entries: Vec::new(),
            statuses: vec![AppSourceStatus {
                id: "unsupported".to_string(),
                label: "Registre Windows".to_string(),
                accessible: false,
                entries: 0,
                denied: 0,
                error: Some(
                    "Le registre Windows n'est consultable que depuis Windows.".to_string(),
                ),
            }],
        }
    }
}

/// Inventaire complet, filtré et paginé, à partir d'une source.
pub fn list_installed_apps(query: AppListQuery, source: &dyn RegistrySource) -> AppInventory {
    let read = source.read_all();
    let entries = read.entries.iter().filter_map(parse_entry).collect();
    build_inventory(entries, read.statuses, &query, now_ms())
}

/// Horodatage de la lecture, en millisecondes epoch.
pub fn now_ms() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|elapsed| elapsed.as_millis() as i64)
        .unwrap_or(0)
}

#[cfg(test)]
pub(crate) mod fake {
    use crate::apps::model::AppSourceStatus;
    use crate::apps::source::{RawAppKey, RegistrySource, SourceRead};

    /// Source factice : permet de tester l'enchaînement complet sans registre.
    pub struct FakeSource {
        pub entries: Vec<RawAppKey>,
        pub statuses: Vec<AppSourceStatus>,
    }

    impl RegistrySource for FakeSource {
        fn read_all(&self) -> SourceRead {
            SourceRead {
                entries: self.entries.clone(),
                statuses: self.statuses.clone(),
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::fake::FakeSource;
    use super::*;
    use crate::apps::source::{Architecture, RawValue, Scope};

    fn raw_key(name: &str, system_component: Option<u32>) -> crate::apps::source::RawAppKey {
        let mut values = vec![(
            "DisplayName".to_string(),
            RawValue::Text(name.to_string()),
        )];
        if let Some(component) = system_component {
            values.push(("SystemComponent".to_string(), RawValue::Number(component)));
        }
        crate::apps::source::RawAppKey {
            scope: Scope::Machine,
            architecture: Architecture::X64,
            registry_path: format!("HKLM64\\{name}"),
            key_name: name.to_string(),
            values,
        }
    }

    #[test]
    fn l_inventaire_ecarte_les_composants_et_les_correctifs() {
        let source = FakeSource {
            entries: vec![
                raw_key("Google Chrome", None),
                raw_key("Composant interne", Some(1)),
                raw_key("KB5041585", None),
            ],
            statuses: vec![AppSourceStatus {
                id: "hklm64".to_string(),
                label: "Ordinateur".to_string(),
                accessible: true,
                entries: 3,
                denied: 0,
                error: None,
            }],
        };

        let inventory = list_installed_apps(AppListQuery::default(), &source);

        assert_eq!(inventory.total, 1);
        assert_eq!(inventory.items[0].name, "Google Chrome");
        assert_eq!(inventory.sources.len(), 1);
        assert!(inventory.sources[0].accessible);
    }

    #[test]
    fn une_source_refusee_reste_visible_dans_le_resultat() {
        let source = FakeSource {
            entries: Vec::new(),
            statuses: vec![AppSourceStatus {
                id: "hklm64".to_string(),
                label: "Ordinateur".to_string(),
                accessible: false,
                entries: 0,
                denied: 4,
                error: Some("accès refusé".to_string()),
            }],
        };

        let inventory = list_installed_apps(AppListQuery::default(), &source);

        assert_eq!(inventory.total, 0);
        assert!(!inventory.sources[0].accessible);
        assert_eq!(inventory.sources[0].denied, 4);
        assert_eq!(inventory.sources[0].error.as_deref(), Some("accès refusé"));
    }
}
