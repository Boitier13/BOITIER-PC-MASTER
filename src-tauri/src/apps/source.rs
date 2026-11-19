//! Source brute de l'inventaire : abstraction du registre Windows.
//!
//! Tout le module `apps` dépend de ce trait et **jamais** de `winreg`
//! directement, sauf `windows.rs`. Conséquences :
//!
//!  - la normalisation, le filtrage et le tri se testent sans registre ;
//!  - aucun chemin de code n'expose d'écriture : le trait n'a qu'une méthode de
//!    lecture (`read_all`) et les structures retournées sont immuables.
//!
//! Aucune désinstallation n'est exécutée ni préparée ici : `uninstall_string`
//! est une donnée lue, jamais lancée.

use crate::apps::model::AppSourceStatus;

/// Portée d'installation : machine (HKLM) ou utilisateur courant (HKCU).
#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord)]
pub enum Scope {
    Machine,
    User,
}

impl Scope {
    pub fn as_str(self) -> &'static str {
        match self {
            Scope::Machine => "machine",
            Scope::User => "user",
        }
    }

    /// Les installations machine l'emportent lors de la déduplication.
    pub fn precedence(self) -> u8 {
        match self {
            Scope::Machine => 0,
            Scope::User => 1,
        }
    }
}

/// Architecture de la vue de registre interrogée.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Architecture {
    X64,
    X86,
    Arm64,
    Unknown,
}

impl Architecture {
    pub fn as_str(self) -> &'static str {
        match self {
            Architecture::X64 => "x64",
            Architecture::X86 => "x86",
            Architecture::Arm64 => "arm64",
            Architecture::Unknown => "unknown",
        }
    }

    /// Architecture native du processus (vue 64 bits).
    pub fn native() -> Self {
        if cfg!(target_arch = "aarch64") {
            Architecture::Arm64
        } else {
            Architecture::X64
        }
    }
}

/// Valeur de registre déjà décodée : ne dépend plus du type REG_*.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RawValue {
    Text(String),
    Number(u32),
}

/// Une sous-clé `Uninstall\<nom>` et ses valeurs utiles.
#[derive(Debug, Clone)]
pub struct RawAppKey {
    pub scope: Scope,
    pub architecture: Architecture,
    /// Chemin complet de la clé, utilisé comme identifiant stable.
    pub registry_path: String,
    /// Nom de la sous-clé (GUID pour un MSI).
    pub key_name: String,
    pub values: Vec<(String, RawValue)>,
}

impl RawAppKey {
    /// Valeur texte insensible à la casse du nom.
    pub fn text(&self, name: &str) -> Option<&str> {
        self.values
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .and_then(|(_, value)| match value {
                RawValue::Text(text) => Some(text.as_str()),
                RawValue::Number(_) => None,
            })
    }

    /// Valeur numérique (DWORD) insensible à la casse du nom.
    pub fn number(&self, name: &str) -> Option<u32> {
        self.values
            .iter()
            .find(|(key, _)| key.eq_ignore_ascii_case(name))
            .and_then(|(_, value)| match value {
                RawValue::Number(number) => Some(*number),
                RawValue::Text(_) => None,
            })
    }
}

/// Résultat d'une lecture complète : entrées et état de chaque ruche.
#[derive(Debug, Clone, Default)]
pub struct SourceRead {
    pub entries: Vec<RawAppKey>,
    pub statuses: Vec<AppSourceStatus>,
}

/// Source en lecture seule de l'inventaire.
pub trait RegistrySource {
    fn read_all(&self) -> SourceRead;
}
