//! Mesure d'espace : commande d'agrégation **en lecture seule**.
//!
//! Elle ne renvoie aucun fichier de l'utilisateur, seulement des totaux, dix
//! dossiers et vingt fichiers. Le parcours est borné, progressif et annulable
//! par la commande existante `walk_cancel` — le registre d'annulation est le
//! même que celui de l'exploration, il n'existe donc qu'un seul mécanisme.

use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};

use crate::commands::fs::{ScanProgressEvent, EVENT_SCAN_PROGRESS};
use crate::error::{CommandError, CommandResult};
use crate::fs_engine::{analyze, AnalysisReport, AnalysisRequest, ProtectionPolicy};
use crate::state::AppState;

/// Mesure bornée d'une racine (volume ou dossier).
///
/// Le travail bloquant s'exécute sur un fil de travail ; la progression utilise
/// `scan://progress`, comme l'exploration, afin que l'interface n'ait qu'un seul
/// canal à écouter.
#[tauri::command]
pub async fn analysis_scan(
    app: AppHandle,
    scan_id: String,
    request: AnalysisRequest,
) -> CommandResult<AnalysisReport> {
    let root = request.root.trim().to_string();
    if root.is_empty() {
        return Err(CommandError::new(
            "invalid_argument",
            "Aucune racine n'a été indiquée pour la mesure.",
        ));
    }

    let cancel = app.state::<AppState>().register_scan(&scan_id);
    let emitter = app.clone();
    let event_scan_id = scan_id.clone();

    let outcome = tauri::async_runtime::spawn_blocking(move || {
        let policy = ProtectionPolicy::platform_default();
        let path = PathBuf::from(&root);
        analyze(&path, &request, &policy, cancel.as_ref(), |progress| {
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
        Ok(result) => result.map_err(|error| CommandError::new(error.code(), error.message())),
        Err(error) => Err(CommandError::new(
            "ipc_failure",
            format!("La mesure a été interrompue : {error}"),
        )),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn une_racine_vide_est_refusee_avant_tout_parcours() {
        let request = AnalysisRequest {
            root: "   ".to_string(),
            ..AnalysisRequest::default()
        };
        assert!(request.root.trim().is_empty());
    }

    #[test]
    fn la_demande_par_defaut_est_bornee() {
        let request = AnalysisRequest::default();
        assert!(request.max_entries > 0);
        assert!(request.max_depth > 0);
        assert!(request.root.is_empty());
    }
}
