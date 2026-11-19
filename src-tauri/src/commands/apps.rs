//! Commandes d'inventaire des applications Windows.
//!
//! **Lecture seule.** Aucune commande de désinstallation n'existe ici : la
//! chaîne `UninstallString` est une donnée affichée, jamais exécutée. Aucun
//! `std::process`, aucun shell, aucune écriture de registre.
//!
//! La lecture du registre est effectuée sur un fil de travail : l'interface
//! n'attend jamais sur le fil principal, même sur un poste très chargé.

use tauri::async_runtime::spawn_blocking;

use crate::apps::RegistrySource;
use crate::apps::{
    list_installed_apps, AppInventory, AppListQuery, AppSourceStatus, SystemRegistry,
};
use crate::error::{CommandError, CommandResult};

/// Inventaire des applications installées sur cet ordinateur.
///
/// Les filtres, le tri et la pagination sont appliqués côté Rust : l'interface
/// ne reçoit jamais l'inventaire complet d'un PC très chargé.
#[tauri::command]
pub async fn apps_list(query: Option<AppListQuery>) -> CommandResult<AppInventory> {
    let query = query.unwrap_or_default();

    spawn_blocking(move || list_installed_apps(query, &SystemRegistry))
        .await
        .map_err(|error| {
            CommandError::new(
                "ipc_failure",
                format!("La lecture de l'inventaire a été interrompue : {error}"),
            )
        })
}

/// État de chaque ruche interrogée.
///
/// Utile lorsqu'un inventaire est vide : l'interface peut alors dire *pourquoi*
/// (clé inaccessible, aucun droit) au lieu d'afficher une liste vide muette.
#[tauri::command]
pub async fn apps_sources() -> CommandResult<Vec<AppSourceStatus>> {
    spawn_blocking(|| SystemRegistry.read_all().statuses)
        .await
        .map_err(|error| {
            CommandError::new(
                "ipc_failure",
                format!("La lecture des sources a été interrompue : {error}"),
            )
        })
}
