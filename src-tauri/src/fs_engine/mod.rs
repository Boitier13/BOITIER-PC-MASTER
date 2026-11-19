//! Moteur d'exploration et d'inventaire des fichiers.
//!
//! Ce module est délibérément **portable** (hors attributs Windows, isolés par
//! `cfg`) : il ne dépend pas de Tauri, ce qui le rend testable unitairement et
//! réutilisable pour la future indexation SQLite.
//!
//! Règles de sécurité appliquées partout dans ce module :
//!  1. **lecture seule** : aucune fonction d'écriture, de suppression, de
//!     renommage ou de déplacement n'existe dans ce code ;
//!  2. les liens symboliques, jonctions et points d'analyse ne sont **jamais**
//!     suivis lors d'un parcours (protection contre les boucles et les
//!     échappements hors périmètre) ;
//!  3. les dossiers protégés de Windows ne sont pas parcourus et sont signalés ;
//!  4. une erreur d'accès sur une entrée n'interrompt jamais le parcours : elle
//!     est comptée et exposée.

pub mod analysis;
pub mod entry;
pub mod error;
pub mod folders;
pub mod volumes;
pub mod listing;
pub mod paths;
pub mod protected;
pub mod walker;

pub use analysis::{analyze, AnalysisReport, AnalysisRequest};
pub use entry::{entry_for_path, FileEntryDto};
pub use error::EngineError;
pub use listing::{list_directory, DirectoryListingDto, ListOptions};
pub use protected::ProtectionPolicy;
pub use walker::{walk, WalkOptions, WalkResult};
