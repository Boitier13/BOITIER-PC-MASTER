use std::sync::RwLock;

use serde::Serialize;

/// Moteur actif.
///
/// `Demo` : aucune donnée système n'est lue (état par défaut).
/// `System` : moteur Windows réel — pas encore branché en phase 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum EngineMode {
    Demo,
    System,
}

/// État partagé de l'application, géré par Tauri (`manage`).
#[derive(Debug)]
pub struct AppState {
    engine: RwLock<EngineMode>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            engine: RwLock::new(EngineMode::Demo),
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

    #[allow(dead_code)] // utilisé lorsque le moteur réel sera activable (phase 2)
    pub fn set_engine(&self, mode: EngineMode) {
        if let Ok(mut guard) = self.engine.write() {
            *guard = mode;
        }
    }
}
