//! Recherche, déduplication, tri et pagination de l'inventaire.
//!
//! Module pur : aucun accès système. Il s'exécute **après** la lecture du
//! registre et ne conserve rien entre deux appels.

use std::collections::HashSet;

use crate::apps::model::{
    AppInventory, AppListQuery, AppSourceStatus, InstalledAppDto, DEFAULT_LIMIT, MAX_LIMIT,
};

/// Minuscules sans accents : « Téléchargements » et « telechargements » se
/// rencontrent, ce qui correspond à l'usage réel d'un champ de recherche.
pub fn normalize(value: &str) -> String {
    let mut normalized = String::with_capacity(value.len());
    // Minuscules d'abord : sinon « É » ne serait pas reconnu comme un accent.
    for character in value.chars().flat_map(char::to_lowercase) {
        match character {
            'à' | 'â' | 'ä' | 'á' | 'ã' | 'å' => normalized.push('a'),
            'é' | 'è' | 'ê' | 'ë' => normalized.push('e'),
            'î' | 'ï' | 'í' | 'ì' => normalized.push('i'),
            'ô' | 'ö' | 'ó' | 'ò' | 'õ' => normalized.push('o'),
            'ù' | 'û' | 'ü' | 'ú' => normalized.push('u'),
            'ç' => normalized.push('c'),
            'ñ' => normalized.push('n'),
            'œ' => normalized.push_str("oe"),
            'æ' => normalized.push_str("ae"),
            other => normalized.push(other),
        }
    }
    normalized
}

fn scope_rank(scope: &str) -> u8 {
    if scope == "machine" {
        0
    } else {
        1
    }
}

fn dedupe_key(app: &InstalledAppDto) -> String {
    format!(
        "{}|{}|{}",
        normalize(&app.name),
        app.version
            .as_deref()
            .unwrap_or("")
            .to_ascii_lowercase(),
        normalize(app.publisher.as_deref().unwrap_or(""))
    )
}

/// Écarte les doublons entre ruches : la portée machine l'emporte.
pub fn dedupe(mut entries: Vec<InstalledAppDto>) -> Vec<InstalledAppDto> {
    entries.sort_by(|left, right| {
        scope_rank(&left.scope)
            .cmp(&scope_rank(&right.scope))
            .then_with(|| normalize(&left.name).cmp(&normalize(&right.name)))
    });

    let mut seen: HashSet<String> = HashSet::new();
    entries.retain(|app| seen.insert(dedupe_key(app)));
    entries
}

fn matches(app: &InstalledAppDto, query: &AppListQuery) -> bool {
    if let Some(search) = query
        .search
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let needle = normalize(search);
        let haystack = normalize(&format!(
            "{} {} {}",
            app.name,
            app.publisher.as_deref().unwrap_or(""),
            app.version.as_deref().unwrap_or("")
        ));
        if !haystack.contains(&needle) {
            return false;
        }
    }

    if let Some(publisher) = query
        .publisher
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let needle = normalize(publisher);
        if !normalize(app.publisher.as_deref().unwrap_or("")).contains(&needle) {
            return false;
        }
    }

    if let Some(scope) = query.scope.as_deref().map(str::to_ascii_lowercase) {
        if matches!(scope.as_str(), "machine" | "user") && app.scope != scope {
            return false;
        }
    }

    if let Some(architecture) = query.architecture.as_deref().map(str::to_ascii_lowercase) {
        if matches!(architecture.as_str(), "x64" | "x86" | "arm64")
            && app.architecture != architecture
        {
            return false;
        }
    }

    true
}

fn sort_items(items: &mut [InstalledAppDto], sort: Option<&str>) {
    match sort.map(str::to_ascii_lowercase).as_deref() {
        Some("size") => items.sort_by(|left, right| {
            right
                .size_bytes
                .unwrap_or(0)
                .cmp(&left.size_bytes.unwrap_or(0))
                .then_with(|| normalize(&left.name).cmp(&normalize(&right.name)))
        }),
        Some("date") => items.sort_by(|left, right| {
            right
                .installed_at_ms
                .unwrap_or(0)
                .cmp(&left.installed_at_ms.unwrap_or(0))
                .then_with(|| normalize(&left.name).cmp(&normalize(&right.name)))
        }),
        _ => items.sort_by(|left, right| {
            normalize(&left.name)
                .cmp(&normalize(&right.name))
                .then_with(|| {
                    normalize(left.publisher.as_deref().unwrap_or(""))
                        .cmp(&normalize(right.publisher.as_deref().unwrap_or("")))
                })
        }),
    }
}

/// `limit` absurde ou absent → valeur par défaut, jamais de page géante.
fn clamp_limit(limit: Option<usize>) -> usize {
    match limit {
        Some(0) | None => DEFAULT_LIMIT,
        Some(value) => value.min(MAX_LIMIT),
    }
}

/// Construit la page d'inventaire renvoyée à l'interface.
pub fn build_inventory(
    entries: Vec<InstalledAppDto>,
    sources: Vec<AppSourceStatus>,
    query: &AppListQuery,
    scanned_at_ms: i64,
) -> AppInventory {
    let mut items = dedupe(entries);
    items.retain(|app| matches(app, query));
    sort_items(&mut items, query.sort.as_deref());

    let total = items.len();
    let limit = clamp_limit(query.limit);
    let offset = query.offset.unwrap_or(0).min(total);
    let page: Vec<InstalledAppDto> = items.into_iter().skip(offset).take(limit).collect();

    AppInventory {
        items: page,
        total,
        offset,
        limit,
        sources,
        scanned_at_ms,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn app(
        name: &str,
        publisher: &str,
        version: &str,
        scope: &str,
        size: Option<u64>,
        date: Option<i64>,
    ) -> InstalledAppDto {
        InstalledAppDto {
            id: format!("{}::{}", scope, name),
            name: name.to_string(),
            publisher: Some(publisher.to_string()),
            version: Some(version.to_string()),
            installed_at_ms: date,
            size_bytes: size,
            install_location: None,
            uninstall_string: None,
            quiet_uninstall_string: None,
            product_code: None,
            installer_type: "exe".to_string(),
            scope: scope.to_string(),
            architecture: "x64".to_string(),
            has_uninstaller: false,
            registry_path: format!("HKLM\\{}", name),
        }
    }

    fn inventory(entries: Vec<InstalledAppDto>, query: AppListQuery) -> AppInventory {
        build_inventory(entries, Vec::new(), &query, 0)
    }

    #[test]
    fn la_recherche_ignore_casse_et_accents() {
        let entries = vec![
            app("Téléchargeur", "Éditeur Français", "1.0", "machine", None, None),
            app("Autre", "Autre", "2.0", "machine", None, None),
        ];
        let query = AppListQuery {
            search: Some("telechargeur".to_string()),
            ..AppListQuery::default()
        };
        let found = inventory(entries, query);
        assert_eq!(found.total, 1);
        assert_eq!(found.items[0].name, "Téléchargeur");
    }

    #[test]
    fn la_normalisation_traite_les_majuscules_accentuees() {
        assert_eq!(normalize("Éditeur Français"), "editeur francais");
        assert_eq!(normalize("TÉLÉCHARGEMENTS"), "telechargements");
        assert_eq!(normalize("Œuvre"), "oeuvre");
    }

    #[test]
    fn le_filtre_editeur_est_partiel_et_insensible_aux_accents() {
        let entries = vec![
            app("A", "Éditeur Français", "1", "machine", None, None),
            app("B", "Other Corp", "1", "machine", None, None),
        ];
        let query = AppListQuery {
            publisher: Some("editeur francais".to_string()),
            ..AppListQuery::default()
        };
        assert_eq!(inventory(entries, query).total, 1);
    }

    #[test]
    fn le_tri_par_taille_est_decroissant_puis_alpha() {
        let entries = vec![
            app("Petit", "X", "1", "machine", Some(10), None),
            app("Grand", "X", "1", "machine", Some(1000), None),
            app("Moyen", "X", "1", "machine", Some(500), None),
        ];
        let query = AppListQuery {
            sort: Some("size".to_string()),
            ..AppListQuery::default()
        };
        let names: Vec<String> = inventory(entries, query)
            .items
            .into_iter()
            .map(|item| item.name)
            .collect();
        assert_eq!(names, vec!["Grand", "Moyen", "Petit"]);
    }

    #[test]
    fn la_pagination_est_bornee() {
        let entries = (0..3)
            .map(|index| app(&format!("App {index}"), "X", "1", "machine", None, None))
            .collect::<Vec<_>>();

        let zero = inventory(
            entries.clone(),
            AppListQuery {
                limit: Some(0),
                ..AppListQuery::default()
            },
        );
        assert_eq!(zero.limit, DEFAULT_LIMIT);

        let huge = inventory(
            entries.clone(),
            AppListQuery {
                limit: Some(9_999),
                ..AppListQuery::default()
            },
        );
        assert_eq!(huge.limit, MAX_LIMIT);

        let beyond = inventory(
            entries,
            AppListQuery {
                offset: Some(99),
                ..AppListQuery::default()
            },
        );
        assert_eq!(beyond.offset, 3);
        assert!(beyond.items.is_empty());
        assert_eq!(beyond.total, 3);
    }

    #[test]
    fn la_deduplication_prefere_la_portee_machine() {
        let entries = vec![
            app("Chrome", "Google", "131", "user", None, None),
            app("Chrome", "Google", "131", "machine", None, None),
        ];
        let result = inventory(entries, AppListQuery::default());
        assert_eq!(result.total, 1);
        assert_eq!(result.items[0].scope, "machine");
    }

    #[test]
    fn le_filtre_de_portee_ecarte_les_autres() {
        let entries = vec![
            app("Machine", "X", "1", "machine", None, None),
            app("Utilisateur", "X", "1", "user", None, None),
        ];
        let query = AppListQuery {
            scope: Some("user".to_string()),
            ..AppListQuery::default()
        };
        let result = inventory(entries, query);
        assert_eq!(result.total, 1);
        assert_eq!(result.items[0].name, "Utilisateur");
    }
}
