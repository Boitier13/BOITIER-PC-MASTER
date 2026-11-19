use std::fmt;
use std::io;

/// Erreur du moteur d'exploration.
///
/// Volontairement pauvre et explicite : le code (`code`) est stable et destiné
/// à l'interface, le message est destiné au diagnostic.
#[derive(Debug)]
pub enum EngineError {
    NotFound(String),
    AccessDenied(String),
    NotADirectory(String),
    InvalidPath(String),
    Io(String),
}

impl EngineError {
    pub fn code(&self) -> &'static str {
        match self {
            EngineError::NotFound(_) => "not_found",
            EngineError::AccessDenied(_) => "access_denied",
            EngineError::NotADirectory(_) => "not_a_directory",
            EngineError::InvalidPath(_) => "invalid_path",
            EngineError::Io(_) => "io_error",
        }
    }

    pub fn message(&self) -> String {
        match self {
            EngineError::NotFound(path) => format!("Chemin introuvable : {path}"),
            EngineError::AccessDenied(path) => format!("Accès refusé : {path}"),
            EngineError::NotADirectory(path) => format!("Ce chemin n’est pas un dossier : {path}"),
            EngineError::InvalidPath(path) => format!("Chemin invalide : {path}"),
            EngineError::Io(message) => message.clone(),
        }
    }

    pub fn from_io(error: io::Error, path: &str) -> Self {
        match error.kind() {
            io::ErrorKind::NotFound => EngineError::NotFound(path.to_string()),
            io::ErrorKind::PermissionDenied => EngineError::AccessDenied(path.to_string()),
            io::ErrorKind::NotADirectory => EngineError::NotADirectory(path.to_string()),
            _ => EngineError::Io(format!("{path} : {error}")),
        }
    }
}

impl fmt::Display for EngineError {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(formatter, "{} : {}", self.code(), self.message())
    }
}

impl std::error::Error for EngineError {}

pub type EngineResult<T> = Result<T, EngineError>;
