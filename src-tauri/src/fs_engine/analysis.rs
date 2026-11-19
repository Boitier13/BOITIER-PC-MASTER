//! Analyse d'espace : agrégats mesurés pendant un parcours **en lecture seule**.
//!
//! Ce module ne renvoie jamais de liste d'entrées : il totalise ce qu'il
//! rencontre et borne volontairement la quantité de mémoire utilisée (dix
//! dossiers, vingt fichiers). Il réutilise la boucle de `walker::traverse`, donc
//! les mêmes règles de sécurité s'appliquent : liens jamais suivis, dossiers
//! protégés non parcourus, erreurs d'accès comptées sans interrompre.
//!
//! Honnêteté du résultat : un rapport dit toujours **ce qu'il n'a pas vu**
//! (`denied`, `skipped_protected`, `truncated`, `cancelled`). Un total partiel
//! annoncé comme partiel reste une mesure ; un total partiel présenté comme
//! complet serait une invention.

use serde::{Deserialize, Serialize};
use std::collections::{BTreeMap, HashMap};
use std::path::Path;
use std::sync::atomic::AtomicBool;
use std::time::{Instant, SystemTime, UNIX_EPOCH};

use crate::fs_engine::entry::FileEntryDto;
use crate::fs_engine::error::EngineResult;
use crate::fs_engine::paths::display_path;
use crate::fs_engine::protected::ProtectionPolicy;
use crate::fs_engine::walker::{traverse, WalkOptions, WalkProgress};

/// Nombre d'entrées visitées par défaut (garde-fou de durée).
pub const DEFAULT_MAX_ENTRIES: usize = 200_000;
/// Plafond absolu accepté par le moteur, même si l'interface demande plus.
pub const MAX_MAX_ENTRIES: usize = 1_000_000;
/// Plancher : en dessous, la mesure n'aurait aucune valeur.
pub const MIN_MAX_ENTRIES: usize = 1_000;
/// Profondeur par défaut (un volume Windows dépasse rarement 20 niveaux).
pub const DEFAULT_MAX_DEPTH: usize = 32;
/// Profondeur maximale acceptée.
pub const MAX_MAX_DEPTH: usize = 64;
/// Nombre de dossiers conservés dans le classement.
pub const TOP_FOLDERS: usize = 10;
/// Nombre de fichiers conservés dans le classement.
pub const LARGEST_FILES: usize = 20;

/// Demande d'analyse envoyée par l'interface.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase", default)]
pub struct AnalysisRequest {
    pub root: String,
    pub max_entries: usize,
    pub max_depth: usize,
}

impl Default for AnalysisRequest {
    fn default() -> Self {
        Self {
            root: String::new(),
            max_entries: DEFAULT_MAX_ENTRIES,
            max_depth: DEFAULT_MAX_DEPTH,
        }
    }
}

/// Octets et fichiers d'une catégorie du moteur.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CategoryTotal {
    pub category: String,
    pub files: u64,
    pub bytes: u64,
}

/// Dossier classé par taille de son **contenu direct mesuré**.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FolderTotal {
    pub path: String,
    pub bytes: u64,
    pub files: u64,
}

/// Fichier du classement des plus volumineux.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FileHit {
    pub name: String,
    pub path: String,
    pub bytes: u64,
    pub modified_at_ms: Option<u64>,
    pub category: String,
}

/// Résultat complet d'une mesure d'espace.
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AnalysisReport {
    pub root: String,
    pub scanned_at_ms: u64,
    pub elapsed_ms: u64,
    /// Tous les fichiers visités, filtres compris.
    pub files: u64,
    /// Tous les dossiers visités (hors dossiers protégés non parcourus).
    pub folders: u64,
    pub total_size_bytes: u64,
    /// Entrées visitées, y compris celles ignorées par les filtres.
    pub visited: u64,
    /// Dossiers ou entrées refusés par le système de fichiers.
    pub denied: u64,
    /// Dossiers protégés dont le contenu n'a pas été parcouru.
    pub skipped_protected: u64,
    /// Plafond d'entrées atteint : les totaux sont **partiels**.
    pub truncated: bool,
    pub cancelled: bool,
    pub by_category: Vec<CategoryTotal>,
    pub top_folders: Vec<FolderTotal>,
    pub largest_files: Vec<FileHit>,
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|duration| duration.as_millis() as u64)
        .unwrap_or(0)
}

#[derive(Default)]
struct Collector {
    files: u64,
    folders: u64,
    total_size_bytes: u64,
    categories: BTreeMap<&'static str, (u64, u64)>,
    folders_bytes: HashMap<String, (u64, u64)>,
    largest: Vec<FileHit>,
}

impl Collector {
    fn visit(&mut self, entry: &FileEntryDto) {
        if entry.is_directory {
            self.folders += 1;
            self.folders_bytes.entry(entry.path.clone()).or_insert((0, 0));
            return;
        }

        // Un lien symbolique est compté comme une entrée rencontrée, jamais
        // suivi : sa taille éventuelle n'est donc pas attribuée.
        self.files += 1;
        self.total_size_bytes = self.total_size_bytes.saturating_add(entry.size_bytes);

        let category = self.categories.entry(entry.category).or_insert((0, 0));
        category.0 += 1;
        category.1 = category.1.saturating_add(entry.size_bytes);

        if let Some(parent) = &entry.parent {
            let bucket = self.folders_bytes.entry(parent.clone()).or_insert((0, 0));
            bucket.0 = bucket.0.saturating_add(entry.size_bytes);
            bucket.1 += 1;
        }

        self.push_largest(entry);
    }

    /// Insertion triée à taille fixe : la mémoire ne dépend pas du volume.
    fn push_largest(&mut self, entry: &FileEntryDto) {
        if entry.size_bytes == 0 {
            return;
        }

        let hit = FileHit {
            name: entry.name.clone(),
            path: entry.path.clone(),
            bytes: entry.size_bytes,
            modified_at_ms: entry.modified_at_ms,
            category: entry.category.to_string(),
        };

        let position = self
            .largest
            .iter()
            .position(|existing| {
                hit.bytes > existing.bytes || (hit.bytes == existing.bytes && hit.path < existing.path)
            })
            .unwrap_or(self.largest.len());

        if position >= LARGEST_FILES {
            return;
        }

        self.largest.insert(position, hit);
        self.largest.truncate(LARGEST_FILES);
    }

    fn take_categories(&mut self) -> Vec<CategoryTotal> {
        let mut totals: Vec<CategoryTotal> = std::mem::take(&mut self.categories)
            .into_iter()
            .map(|(category, (files, bytes))| CategoryTotal {
                category: category.to_string(),
                files,
                bytes,
            })
            .collect();
        totals.sort_by(|left, right| {
            right
                .bytes
                .cmp(&left.bytes)
                .then_with(|| left.category.cmp(&right.category))
        });
        totals
    }

    fn take_top_folders(&mut self) -> Vec<FolderTotal> {
        let mut totals: Vec<FolderTotal> = std::mem::take(&mut self.folders_bytes)
            .into_iter()
            .filter(|(_, (bytes, _))| *bytes > 0)
            .map(|(path, (bytes, files))| FolderTotal { path, bytes, files })
            .collect();
        totals.sort_by(|left, right| {
            right
                .bytes
                .cmp(&left.bytes)
                .then_with(|| left.path.cmp(&right.path))
        });
        totals.truncate(TOP_FOLDERS);
        totals
    }
}

fn options_for(request: &AnalysisRequest) -> WalkOptions {
    WalkOptions {
        max_depth: request.max_depth.clamp(1, MAX_MAX_DEPTH),
        max_entries: request.max_entries.clamp(MIN_MAX_ENTRIES, MAX_MAX_ENTRIES),
        // L'analyse mesure tout ce qui est lisible : masquer les fichiers
        // cachés reviendrait à sous-estimer l'espace occupé.
        include_hidden: true,
        include_system: true,
        // Aucune liste n'est renvoyée : la collecte d'entrées est désactivée.
        max_results: 0,
        ..WalkOptions::default()
    }
}

/// Analyse bornée d'une racine, pilotée par la demande de l'interface.
pub fn analyze(
    root: &Path,
    request: &AnalysisRequest,
    policy: &ProtectionPolicy,
    cancel: &AtomicBool,
    on_progress: impl FnMut(WalkProgress),
) -> EngineResult<AnalysisReport> {
    run(root, &options_for(request), policy, cancel, on_progress)
}

/// Exécution commune, sans borne appliquée : les tests s'en servent pour
/// provoquer un plafond avec une arborescence minuscule.
pub(crate) fn run(
    root: &Path,
    options: &WalkOptions,
    policy: &ProtectionPolicy,
    cancel: &AtomicBool,
    on_progress: impl FnMut(WalkProgress),
) -> EngineResult<AnalysisReport> {
    let started = Instant::now();
    let mut collector = Collector::default();

    let result = traverse(
        root,
        options,
        policy,
        cancel,
        false,
        &mut |entry| collector.visit(entry),
        on_progress,
    )?;

    let stats = result.stats;
    let by_category = collector.take_categories();
    let top_folders = collector.take_top_folders();
    let largest_files = std::mem::take(&mut collector.largest);

    Ok(AnalysisReport {
        root: display_path(root),
        scanned_at_ms: now_ms(),
        elapsed_ms: started.elapsed().as_millis() as u64,
        files: collector.files,
        folders: collector.folders,
        total_size_bytes: collector.total_size_bytes,
        visited: stats.visited,
        denied: stats.denied,
        skipped_protected: stats.skipped_protected,
        truncated: stats.truncated,
        cancelled: stats.cancelled,
        by_category,
        top_folders,
        largest_files,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::sync::atomic::Ordering;

    fn sample_tree() -> tempfile::TempDir {
        let directory = tempfile::tempdir().expect("dossier temporaire");
        let root = directory.path();
        let documents = root.join("Documents");
        fs::create_dir_all(documents.join("2024")).expect("arborescence");
        fs::create_dir_all(documents.join("2025")).expect("arborescence");
        fs::create_dir_all(root.join("Images")).expect("arborescence");
        fs::write(documents.join("2024").join("rapport.pdf"), vec![0u8; 4096]).expect("fichier");
        fs::write(documents.join("2025").join("budget.xlsx"), vec![0u8; 1024]).expect("fichier");
        fs::write(root.join("Images").join("photo.jpg"), vec![0u8; 512]).expect("fichier");
        fs::write(root.join("notes.txt"), vec![0u8; 5]).expect("fichier");
        fs::write(root.join("pagefile.sys"), vec![0u8; 1]).expect("fichier système");
        directory
    }

    fn measure(root: &Path, max_entries: usize) -> AnalysisReport {
        let options = WalkOptions {
            max_entries,
            max_depth: MAX_MAX_DEPTH,
            include_hidden: true,
            include_system: true,
            max_results: 0,
            ..WalkOptions::default()
        };
        run(
            root,
            &options,
            &ProtectionPolicy::for_tests(),
            &AtomicBool::new(false),
            |_| {},
        )
        .expect("analyse")
    }

    #[test]
    fn agregats_de_base() {
        let tree = sample_tree();
        let report = measure(tree.path(), DEFAULT_MAX_ENTRIES);

        assert_eq!(report.files, 5);
        assert_eq!(report.folders, 4);
        assert_eq!(report.total_size_bytes, 4_096 + 1_024 + 512 + 5 + 1);
        assert_eq!(report.visited, 9);
        assert_eq!(report.denied, 0);
        assert!(!report.truncated);
        assert!(!report.cancelled);
        assert_eq!(report.root, display_path(tree.path()));
    }

    #[test]
    fn repartition_par_categorie() {
        let tree = sample_tree();
        let report = measure(tree.path(), DEFAULT_MAX_ENTRIES);

        let document = report
            .by_category
            .iter()
            .find(|total| total.category == "document")
            .expect("documents");
        assert_eq!(document.files, 3);
        assert_eq!(document.bytes, 4_096 + 1_024 + 5);

        let image = report
            .by_category
            .iter()
            .find(|total| total.category == "image")
            .expect("images");
        assert_eq!(image.files, 1);
        assert_eq!(image.bytes, 512);

        // Trié par octets décroissants.
        assert_eq!(report.by_category[0].category, "document");
    }

    #[test]
    fn plus_gros_dossiers_mesurent_le_contenu_direct() {
        let tree = sample_tree();
        let report = measure(tree.path(), DEFAULT_MAX_ENTRIES);

        assert!(report.top_folders.len() >= 2);
        assert!(report.top_folders[0].path.ends_with("2024"));
        assert_eq!(report.top_folders[0].bytes, 4_096);
        assert_eq!(report.top_folders[0].files, 1);
        assert!(report.top_folders[1].path.ends_with("2025"));
        assert_eq!(report.top_folders[1].bytes, 1_024);
        // Un dossier dont les fichiers sont dans ses sous-dossiers ne
        // s'attribue pas l'espace de ceux-ci.
        assert!(!report
            .top_folders
            .iter()
            .any(|folder| folder.path.ends_with("Documents") && folder.bytes > 0));
    }

    #[test]
    fn plus_gros_fichiers_tries_et_plafonnes() {
        let tree = sample_tree();
        let report = measure(tree.path(), DEFAULT_MAX_ENTRIES);

        assert_eq!(report.largest_files.len(), 5);
        assert_eq!(report.largest_files[0].name, "rapport.pdf");
        assert_eq!(report.largest_files[0].bytes, 4_096);
        assert!(report.largest_files[0].path.ends_with("rapport.pdf"));
        assert_eq!(report.largest_files[1].name, "budget.xlsx");
        assert!(report.largest_files.len() <= LARGEST_FILES);
    }

    #[test]
    fn plafond_atteint_marque_la_mesure_partielle() {
        let tree = sample_tree();
        let report = measure(tree.path(), 3);

        assert!(report.truncated);
        assert_eq!(report.visited, 3);
        // Les totaux reflètent seulement ce qui a été vu, et le disent.
        assert!(report.files < 5);
        assert!(report.total_size_bytes < 5_638);
    }

    #[test]
    fn annulation_renvoie_un_rapport_partiel() {
        let tree = sample_tree();
        let cancel = AtomicBool::new(true);
        let report = run(
            tree.path(),
            &WalkOptions {
                max_entries: DEFAULT_MAX_ENTRIES,
                ..WalkOptions::default()
            },
            &ProtectionPolicy::for_tests(),
            &cancel,
            |_| {},
        )
        .expect("analyse annulée");

        assert!(report.cancelled);
        assert_eq!(report.visited, 0);
        assert_eq!(report.files, 0);
    }

    #[test]
    fn dossier_protege_compte_mais_non_parcouru() {
        let tree = sample_tree();
        let policy =
            ProtectionPolicy::for_tests().with_directory(&tree.path().join("Documents"));
        let report = run(
            tree.path(),
            &WalkOptions {
                max_entries: DEFAULT_MAX_ENTRIES,
                include_hidden: true,
                include_system: true,
                ..WalkOptions::default()
            },
            &policy,
            &AtomicBool::new(false),
            |_| {},
        )
        .expect("analyse");

        assert!(report.skipped_protected >= 1);
        // Les fichiers de Documents/2024 et 2025 n'ont pas été lus : le
        // rapport ne peut donc pas les compter.
        assert_eq!(report.files, 2);
        assert_eq!(report.total_size_bytes, 5 + 1);
    }

    #[test]
    fn racine_fichier_refusee() {
        let tree = sample_tree();
        let error = run(
            &tree.path().join("notes.txt"),
            &WalkOptions::default(),
            &ProtectionPolicy::for_tests(),
            &AtomicBool::new(false),
            |_| {},
        )
        .expect_err("doit échouer");
        assert_eq!(error.code(), "not_a_directory");
    }

    #[test]
    fn bornes_de_la_demande_encadrees() {
        let huge = options_for(&AnalysisRequest {
            root: String::new(),
            max_entries: 50_000_000,
            max_depth: 500,
        });
        assert_eq!(huge.max_entries, MAX_MAX_ENTRIES);
        assert_eq!(huge.max_depth, MAX_MAX_DEPTH);

        let tiny = options_for(&AnalysisRequest {
            root: String::new(),
            max_entries: 1,
            max_depth: 0,
        });
        assert_eq!(tiny.max_entries, MIN_MAX_ENTRIES);
        assert_eq!(tiny.max_depth, 1);
        assert!(tiny.include_hidden);
    }

    #[test]
    fn progression_et_annulation_partagent_le_registre() {
        // Le drapeau d'annulation est celui du parcours : une analyse qui
        // démarre sur un jeton déjà levé ne lit rien et le signale.
        let tree = sample_tree();
        let cancel = AtomicBool::new(false);
        let report = run(
            tree.path(),
            &WalkOptions::default(),
            &ProtectionPolicy::for_tests(),
            &cancel,
            |_| {},
        )
        .expect("analyse");
        assert!(!report.cancelled);
        cancel.store(true, Ordering::SeqCst);
        assert!(cancel.load(Ordering::SeqCst));
    }
}
