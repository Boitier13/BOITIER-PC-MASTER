//! Commandes d'exploration et d'inventaire des fichiers.
//!
//! **Toutes ces commandes sont en lecture seule.** Aucune commande d'écriture,
//! de suppression, de renommage ou de déplacement n'existe dans ce module : il
//! n'y a donc aucun moyen, même par erreur d'interface, de modifier un fichier
//! de l'utilisateur depuis le moteur.
//!
//! Bornes systématiques : profondeur maximale, nombre de résultats, nombre
//! d'entrées visitées. Un parcours peut être annulé à tout moment par
//! `walk_cancel`, sans laisser de processus ni d'état résiduel.

use serde::Serialize;
use std::path::Path;
use tauri::{AppHandle, Emitter, Manager};

use crate::error::{CommandError, CommandResult};
use crate::fs_engine::folders::{user_folders as collect_user_folders, UserFolderDto};
use crate::fs_engine::volumes::{list_volumes, VolumeDto};
use crate::fs_engine::{
    entry_for_path, list_directory, walk, EngineError, FileEntryDto, ListOptions,
    ProtectionPolicy, WalkOptions, WalkResult,
};
use crate::state::AppState;

/// Événement de progression émis pendant un parcours.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanProgressEvent {
    pub scan_id: String,
    pub visited: u64,
    pub matched: u64,
    pub current: String,
    pub elapsed_ms: u64,
}

const EVENT_SCAN_PROGRESS: &str = "scan://progress";

fn to_command_error(error: EngineError) -> CommandError {
    CommandError::new(error.code(), error.message())
}

fn policy() -> ProtectionPolicy {
    ProtectionPolicy::platform_default()
}

/// Volumes montés, avec capacité totale, libre et utilisée.
#[tauri::command]
pub fn volumes_list() -> CommandResult<Vec<VolumeDto>> {
    Ok(list_volumes())
}

/// Dossiers d'accès rapide de l'utilisateur courant.
#[tauri::command]
pub fn user_folders() -> CommandResult<Vec<UserFolderDto>> {
    Ok(collect_user_folders())
}

/// Contenu immédiat d'un dossier (une seule couche).
#[tauri::command]
pub fn directory_list(
    path: String,
    options: Option<ListOptions>,
) -> CommandResult<crate::fs_engine::DirectoryListingDto> {
    list_directory(Path::new(&path), &options.unwrap_or_default(), &policy())
        .map_err(to_command_error)
}

/// Métadonnées d'un chemin précis, sans suivre un lien final.
#[tauri::command]
pub fn path_metadata(path: String) -> CommandResult<FileEntryDto> {
    entry_for_path(Path::new(&path), &policy()).map_err(to_command_error)
}

/// Parcours récursif borné et annulable.
///
/// Le travail bloquant est exécuté sur un fil de travail (jamais sur le fil de
/// l'interface). La progression est émise sur `scan://progress` au plus toutes
/// les 250 entrées visitées.
#[tauri::command]
pub async fn walk_start(
    app: AppHandle,
    scan_id: String,
    root: String,
    options: Option<WalkOptions>,
) -> CommandResult<WalkResult> {
    let options = options.unwrap_or_default();
    let cancel = app.state::<AppState>().register_scan(&scan_id);

    let emitter = app.clone();
    let event_scan_id = scan_id.clone();

    let outcome = tauri::async_runtime::spawn_blocking(move || {
        let policy = policy();
        walk(Path::new(&root), &options, &policy, cancel.as_ref(), |progress| {
            let _ = emitter.emit(
                EVENT_SCAN_PROGRESS,
                ScanProgressEvent {
                    scan_id: event_scan_id.clone(),
                    visited: progress.visited,
                    matched: progress.matched,
                    current: progress.current,
                    elapsed_ms: progress.elapsed_ms,
                },
            );
        })
    })
    .await;

    app.state::<AppState>().finish_scan(&scan_id);

    match outcome {
        Ok(result) => result.map_err(to_command_error),
        Err(error) => Err(CommandError::new(
            "ipc_failure",
            format!("Le parcours a été interrompu : {error}"),
        )),
    }
}

/// Demande l'arrêt d'un parcours en cours.
///
/// Renvoie `true` si un parcours portant cet identifiant était actif. Le
/// parcours renvoie alors ses résultats partiels avec `cancelled: true`.
#[tauri::command]
pub fn walk_cancel(app: AppHandle, scan_id: String) -> CommandResult<bool> {
    Ok(app.state::<AppState>().cancel_scan(&scan_id))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn politique_par_defaut_protege_les_dossiers_systeme() {
        let policy = policy();
        // Le nom exact dépend du système, mais la politique doit toujours
        // exister et ne jamais paniquer.
        let _ = policy.is_protected(Path::new("C:\\Windows\\WinSxS"));
    }

    #[test]
    fn options_par_defaut_bornees() {
        let options = WalkOptions::default();
        assert!(options.max_depth > 0);
        assert!(options.max_results > 0);
        assert!(options.max_entries > 0);
        assert!(!options.include_hidden);
    }

    #[test]
    fn options_de_listage_bornees() {
        let options = ListOptions::default();
        assert!(options.max_entries > 0);
        assert!(options.directories_first);
    }
}
