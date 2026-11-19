//! Socle Rust de BOITIER PC MASTER (Tauri 2).
//!
//! Phase 1 — périmètre strictement en lecture d'informations techniques :
//! `app_info`, `engine_status`, `db_status`, `ping`.
//!
//! Aucune fonction de suppression, de modification du registre ou de
//! désinstallation n'est exposée. Aucune élévation de privilèges n'est
//! demandée : le processus s'exécute avec les droits de l'utilisateur courant.

mod commands;
mod db;
mod error;
mod platform;
mod state;

use state::AppState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            commands::system::app_info,
            commands::system::engine_status,
            commands::system::db_status,
            commands::system::ping,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de BOITIER PC MASTER");
}
