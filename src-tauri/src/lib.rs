//! Socle Rust de BOITIER PC MASTER (Tauri 2).
//!
//! Périmètre strictement en **lecture** :
//!  - informations techniques : `app_info`, `engine_status`, `db_status`, `ping` ;
//!  - exploration et inventaire : `volumes_list`, `user_folders`,
//!    `directory_list`, `path_metadata`, `walk_start`, `walk_cancel`.
//!
//! Aucune commande de suppression, de déplacement, de renommage, d'écriture, de
//! modification du registre ou de désinstallation n'est exposée. Aucune
//! élévation de privilèges n'est demandée : le processus s'exécute avec les
//! droits de l'utilisateur courant.

mod commands;
mod db;
mod error;
mod fs_engine;
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
            commands::fs::volumes_list,
            commands::fs::user_folders,
            commands::fs::directory_list,
            commands::fs::path_metadata,
            commands::fs::walk_start,
            commands::fs::walk_cancel,
        ])
        .run(tauri::generate_context!())
        .expect("échec du démarrage de BOITIER PC MASTER");
}
