//! Structures sérialisées de l'inventaire des applications Windows.
//!
//! Aucun de ces types n'est exposé à l'interface sans passer par
//! `commands::apps` : la frontière IPC reste unique.

use serde::{Deserialize, Serialize};

/// Nombre de résultats renvoyés par défaut.
pub const DEFAULT_LIMIT: usize = 200;
/// Plafond absolu d'une page de résultats.
pub const MAX_LIMIT: usize = 500;

/// Application installée lue dans le registre Windows (lecture seule).
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstalledAppDto {
    /// Identifiant stable : ruche + chemin exact de la clé.
    pub id: String,
    pub name: String,
    pub publisher: Option<String>,
    pub version: Option<String>,
    /// `InstallDate` (`AAAAMMJJ`) converti en millisecondes epoch (UTC).
    pub installed_at_ms: Option<i64>,
    /// `EstimatedSize`/`InstallSize` fourni par Windows, en octets.
    pub size_bytes: Option<u64>,
    pub install_location: Option<String>,
    pub uninstall_string: Option<String>,
    pub quiet_uninstall_string: Option<String>,
    pub product_code: Option<String>,
    /// `msi`, `exe` ou `unknown` (`msix` réservé à un lot ultérieur).
    pub installer_type: String,
    /// `machine` (HKLM) ou `user` (HKCU).
    pub scope: String,
    /// `x64`, `x86`, `arm64` ou `unknown`.
    pub architecture: String,
    pub has_uninstaller: bool,
    /// Chemin de la clé de registre, pour le diagnostic uniquement.
    pub registry_path: String,
}

/// État d'une ruche interrogée : sert à expliquer un inventaire vide.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppSourceStatus {
    pub id: String,
    pub label: String,
    pub accessible: bool,
    pub entries: usize,
    /// Sous-clés refusées par Windows (ACL) : jamais bloquant.
    pub denied: usize,
    pub error: Option<String>,
}

/// Page d'inventaire, avec la provenance des données.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInventory {
    pub items: Vec<InstalledAppDto>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
    pub sources: Vec<AppSourceStatus>,
    pub scanned_at_ms: i64,
}

/// Critères de filtrage, de tri et de pagination.
///
/// Les valeurs inconnues (`sort`, `scope`, `architecture`) sont ignorées plutôt
/// que rejetées : une interface ancienne ne doit pas casser le moteur.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AppListQuery {
    pub search: Option<String>,
    pub publisher: Option<String>,
    pub scope: Option<String>,
    pub architecture: Option<String>,
    /// `name` (défaut), `size` ou `date`.
    pub sort: Option<String>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_requete_vide_est_acceptee() {
        let query: AppListQuery = serde_json::from_str("{}").expect("requête vide");
        assert!(query.search.is_none());
        assert!(query.limit.is_none());
    }

    #[test]
    fn les_criteres_sont_lus_en_camel_case() {
        let query: AppListQuery =
            serde_json::from_str(r#"{"search":"chrome","sort":"size","offset":10,"limit":50}"#)
                .expect("requête camelCase");
        assert_eq!(query.search.as_deref(), Some("chrome"));
        assert_eq!(query.sort.as_deref(), Some("size"));
        assert_eq!(query.offset, Some(10));
        assert_eq!(query.limit, Some(50));
    }

    #[test]
    fn l_inventaire_est_serialise_en_camel_case() {
        let inventory = AppInventory {
            items: Vec::new(),
            total: 0,
            offset: 0,
            limit: DEFAULT_LIMIT,
            sources: vec![AppSourceStatus {
                id: "hklm64".to_string(),
                label: "Ordinateur (64 bits)".to_string(),
                accessible: true,
                entries: 0,
                denied: 0,
                error: None,
            }],
            scanned_at_ms: 1_700_000_000_000,
        };
        let json = serde_json::to_string(&inventory).expect("sérialisation");
        assert!(json.contains("\"scannedAtMs\""));
        assert!(json.contains("\"accessible\":true"));
    }
}
