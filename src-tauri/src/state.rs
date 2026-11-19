use std::collections::HashMap;
use std::sync::atomic::AtomicBool;
use std::sync::{Arc, Mutex, RwLock};

use serde::Serialize;

/// Moteur actif.
///
/// `Demo` : aucune donnée système n'est lue (mode de l'aperçu web).
/// `System` : moteur local réel, **strictement en lecture**.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineMode {
    Demo,
    System,
}

/// État partagé de l'application, géré par Tauri (`manage`).
///
/// Il ne contient que deux choses : le mode du moteur et les jetons
/// d'annulation des parcours en cours. Aucun chemin, aucune liste de fichiers
/// n'est conservée ici (les parcours ne laissent pas d'état durable).
#[derive(Debug)]
pub struct AppState {
    engine: RwLock<EngineMode>,
    scans: Mutex<HashMap<String, Arc<AtomicBool>>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            // Le binaire de bureau embarque réellement le moteur de fichiers.
            // L'interface choisit, elle, d'afficher la démonstration ou les
            // données réelles (voir `src/services/index.ts`).
            engine: RwLock::new(EngineMode::System),
            scans: Mutex::new(HashMap::new()),
        }
    }
}

impl AppState {
    pub fn engine(&self) -> EngineMode {
        match self.engine.read() {
            Ok(guard) => *guard,
            Err(poisoned) => *poisoned.into_inner(),
        }
    }

    #[allow(dead_code)] // utilisé lorsqu'un basculement manuel sera exposé
    pub fn set_engine(&self, mode: EngineMode) {
        if let Ok(mut guard) = self.engine.write() {
            *guard = mode;
        }
    }

    /// Enregistre un parcours et renvoie son jeton d'annulation.
    pub fn register_scan(&self, scan_id: &str) -> Arc<AtomicBool> {
        let flag = Arc::new(AtomicBool::new(false));
        if let Ok(mut scans) = self.scans.lock() {
            scans.insert(scan_id.to_string(), Arc::clone(&flag));
        }
        flag
    }

    /// Demande l'arrêt d'un parcours. `false` si le parcours est déjà terminé.
    pub fn cancel_scan(&self, scan_id: &str) -> bool {
        match self.scans.lock() {
            Ok(scans) => match scans.get(scan_id) {
                Some(flag) => {
                    flag.store(true, std::sync::atomic::Ordering::SeqCst);
                    true
                }
                None => false,
            },
            Err(_) => false,
        }
    }

    /// Retire le jeton d'un parcours terminé (aucune fuite mémoire).
    pub fn finish_scan(&self, scan_id: &str) {
        if let Ok(mut scans) = self.scans.lock() {
            scans.remove(scan_id);
        }
    }

    /// Nombre de parcours suivis — utilisé par les tests.
    #[cfg(test)]
    pub fn active_scans(&self) -> usize {
        self.scans.lock().map(|scans| scans.len()).unwrap_or(0)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jetons_annulation_isoles_par_parcours() {
        let state = AppState::default();
        let first = state.register_scan("scan-a");
        let second = state.register_scan("scan-b");

        assert!(state.cancel_scan("scan-a"));
        assert!(first.load(std::sync::atomic::Ordering::SeqCst));
        assert!(!second.load(std::sync::atomic::Ordering::SeqCst));
        assert!(!state.cancel_scan("inconnu"));

        state.finish_scan("scan-a");
        state.finish_scan("scan-b");
        assert_eq!(state.active_scans(), 0);
    }

    #[test]
    fn mode_moteur_par_defaut() {
        let state = AppState::default();
        assert_eq!(state.engine(), EngineMode::System);
        state.set_engine(EngineMode::Demo);
        assert_eq!(state.engine(), EngineMode::Demo);
    }
}
