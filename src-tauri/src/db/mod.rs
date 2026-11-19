//! Accès aux données locales — préparé, non activé.
//!
//! Phase 1 : seul l'emplacement du fichier et la version de schéma sont
//! exposés (`db_status`). Aucune base n'est créée ni ouverte.
//!
//! Phase 2 : ouverture avec `rusqlite` (feature `bundled`, donc aucune
//! dépendance système et fonctionnement 100 % hors ligne), migrations
//! versionnées par `schema_version`, mode WAL, transactions par lots pour
//! l'indexation de gros volumes.

use std::path::{Path, PathBuf};

/// Nom du fichier de base, dans `%APPDATA%\<identifier>\`.
pub const DB_FILE_NAME: &str = "boitier.db";

/// Version de schéma attendue par cette version de l'application.
pub const SCHEMA_VERSION: u32 = 1;

/// Schéma initial embarqué (compilé dans le binaire, aucune lecture disque).
#[allow(dead_code)] // exécuté à partir de la phase 2
pub const INIT_SQL: &str = include_str!("migrations/001_init.sql");

pub fn database_path(app_data_dir: &Path) -> PathBuf {
    app_data_dir.join(DB_FILE_NAME)
}
