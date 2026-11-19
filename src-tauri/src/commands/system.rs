use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::db;
use crate::error::{CommandError, CommandResult};
use crate::state::{AppState, EngineMode};

/// Informations sur l'application et le moteur.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AppInfo {
    pub name: String,
    pub version: String,
    pub platform: String,
    pub arch: String,
    pub engine_mode: EngineMode,
    pub real_system_access: bool,
}

/// Capacités déclarées du moteur courant.
///
/// `volumes` et `fileInventory` sont réellement implémentés (phase 3) et en
/// lecture seule. Les autres restent à `false` : l'interface les présente
/// explicitement comme non disponibles plutôt que de simuler un résultat.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Capabilities {
    pub volumes: bool,
    pub file_inventory: bool,
    pub installed_apps: bool,
    pub uninstall: bool,
    pub residue_scan: bool,
    pub monitoring: bool,
    pub reports: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct EngineStatus {
    pub mode: EngineMode,
    pub capabilities: Capabilities,
    pub elevation: &'static str,
    pub real_system_access: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DbStatus {
    pub ready: bool,
    pub path: String,
    pub schema_version: u32,
}

#[tauri::command]
pub fn app_info(state: State<'_, AppState>) -> CommandResult<AppInfo> {
    let mode = state.engine();
    Ok(AppInfo {
        name: "BOITIER PC MASTER".to_string(),
        version: env!("CARGO_PKG_VERSION").to_string(),
        platform: std::env::consts::OS.to_string(),
        arch: std::env::consts::ARCH.to_string(),
        engine_mode: mode,
        real_system_access: mode == EngineMode::System,
    })
}

#[tauri::command]
pub fn engine_status(state: State<'_, AppState>) -> CommandResult<EngineStatus> {
    let mode = state.engine();
    Ok(EngineStatus {
        mode,
        capabilities: Capabilities {
            volumes: true,
            file_inventory: true,
            installed_apps: false,
            uninstall: false,
            residue_scan: false,
            monitoring: false,
            reports: false,
        },
        // Aucun privilège administrateur n'est demandé ni requis.
        elevation: "none",
        real_system_access: mode == EngineMode::System,
    })
}

#[tauri::command]
pub fn db_status(app: AppHandle) -> CommandResult<DbStatus> {
    let directory = app
        .path()
        .app_data_dir()
        .map_err(|error| CommandError::new("path_unavailable", error.to_string()))?;

    Ok(DbStatus {
        // Phase 1 : la base n'est pas encore ouverte (schéma préparé uniquement).
        ready: false,
        path: db::database_path(&directory).to_string_lossy().to_string(),
        schema_version: db::SCHEMA_VERSION,
    })
}

/// Test de disponibilité de la liaison IPC (aucun effet de bord).
#[tauri::command]
pub fn ping() -> &'static str {
    "pong"
}
