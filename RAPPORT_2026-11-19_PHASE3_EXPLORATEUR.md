# Rapport — Mission 3 : exploration et inventaire approfondi des fichiers

**Date** : 19 novembre 2026
**Branche de travail** : `arena/ce96ae0d-boitier-pc-master` (identique à `foundation/tauri2`, commit de base `fe8c561`)
**État** : commité et poussé sur la branche de session ; `main` intacte, aucune
fusion, aucune pull request. **CI GitHub Actions verte** (web + Rust Windows).
**Périmètre** : lecture seule. Aucune suppression, aucun déplacement, aucune
modification de fichier, aucune écriture disque, aucune élévation de privilèges.

---

## 1. Ce qui a été livré

Une première fonctionnalité métier **réelle** : un moteur Rust d'exploration et
d'inventaire, ses commandes IPC, son contrat TypeScript, deux implémentations
(moteur réel et moteur de démonstration) et les écrans qui l'exploitent.

| Exigence | Réalisation |
|---|---|
| 1. Examiner l'architecture | Lecture de `src/services`, `src/ipc`, `src-tauri/src/{commands,platform,state,error}`, `001_init.sql` avant toute écriture |
| 2. Étudier les services et l'IPC | `SystemService` étendu ; `MockSystemService` et `TauriSystemService` réécrits sur le même contrat ; `ipc/client.ts` traduit les erreurs Rust `{ code, message }` |
| 3. Moteur Rust dédié | Module `src-tauri/src/fs_engine/` (9 fichiers), indépendant de Tauri, testable |
| 4. Parcourir lecteurs/dossiers/fichiers | `volumes_list`, `directory_list`, `walk_start` (parcours itératif borné) |
| 5. Nom, chemin, extension, taille, dates, type, attributs | `FileEntryDto` : octets, horodatages UNIX (ms), catégorie, attributs `FILE_ATTRIBUTE_*` complets |
| 6. Accès refusés, liens, dossiers protégés | `access_denied` par entrée, liens jamais suivis, `ProtectionPolicy` (WinSxS, `System Volume Information`, `$Recycle.Bin`, `System32\config`, pagefile…) |
| 7. Annulation et progression | Jeton `AtomicBool` par parcours, commande `walk_cancel`, événement `scan://progress`, résultats partiels `cancelled: true` |
| 8. Préparation des inventaires datés | Tailles en octets, dates numériques, catégories stables, statistiques agrégées (`totalSizeBytes`, compteurs) — prêts pour SQLite |
| 9. Mode démo fonctionnel | Arborescence fictive (`src/data/demo-tree.ts`) servie par le même contrat, mêmes règles, mêmes états |
| 10. Aucune opération destructive | Aucune fonction d'écriture dans le moteur ; le contrat `SystemService` n'expose ni `delete`, ni `move`, ni `rename`, ni `write` |

---

## 2. Fichiers créés (11)

**Rust — moteur (9)**

- `src-tauri/src/fs_engine/mod.rs` — documentation, réexports
- `src-tauri/src/fs_engine/error.rs` — `EngineError` (`not_found`, `access_denied`, `not_a_directory`, `invalid_path`, `io_error`)
- `src-tauri/src/fs_engine/paths.rs` — chemins longs `\\?\`, extension, catégories, comparaison insensible à la casse
- `src-tauri/src/fs_engine/entry.rs` — `FileEntryDto`, attributs Windows, horodatages
- `src-tauri/src/fs_engine/protected.rs` — politique des dossiers protégés
- `src-tauri/src/fs_engine/listing.rs` — listage d'un dossier (tri, filtres, plafond, refus)
- `src-tauri/src/fs_engine/walker.rs` — parcours récursif itératif, bornes, annulation, progression
- `src-tauri/src/fs_engine/volumes.rs` — volumes réels (capacités, type de média, système de fichiers)
- `src-tauri/src/fs_engine/folders.rs` — dossiers d'accès rapide de l'utilisateur

**Rust — commandes (1)**

- `src-tauri/src/commands/fs.rs` — `volumes_list`, `user_folders`, `directory_list`, `path_metadata`, `walk_start`, `walk_cancel`

**Interface (6)**

- `src/domain/file-entry.ts` — libellés de type, attributs lisibles, segments de chemin, clés normalisées
- `src/data/demo-tree.ts` — arborescence fictive complète (volumes, dossiers, fichiers, liens, protégés, refus)
- `src/hooks/use-service-data.ts`, `src/hooks/use-volumes.ts`, `src/hooks/use-engine-mode.ts`
- `src/features/explorer/use-explorer.ts`, `FileTable.tsx`, `PropertiesPanel.tsx`

**Tests, CI, documentation (4)**

- `src/__tests__/explorer.test.tsx` — 11 tests d'interface
- `.github/workflows/ci.yml` — jobs `web` (ubuntu) et `rust-windows` (windows-latest)
- `docs/FEATURE_EXPLORER.md` — documentation de la fonctionnalité
- ce rapport

## 3. Fichiers modifiés (27)

| Domaine | Fichiers |
|---|---|
| Contrats et services | `src/domain/types.ts`, `src/ipc/contracts.ts`, `src/ipc/client.ts`, `src/services/system-service.ts`, `src/services/index.ts`, `src/services/mock/mock-system-service.ts`, `src/services/tauri/tauri-system-service.ts`, `src/store/system-service-context.tsx`, `src/store/app-state.tsx` |
| Écrans et coque | `src/features/explorer/ExplorerPage.tsx`, `src/features/inventory/InventoryPage.tsx`, `src/features/dashboard/DashboardPage.tsx`, `src/app/AppShell.tsx`, `src/components/DemoLabel.tsx`, `src/styles/globals.css` |
| Données et formatage | `src/data/workspace.ts`, `src/data/use-workspace.ts`, `src/lib/format.ts` |
| Rust | `src-tauri/Cargo.toml` (sysinfo, tempfile), `src-tauri/src/lib.rs`, `src-tauri/src/state.rs`, `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/system.rs` |
| Tests et outillage | `src/__tests__/demo-mode.test.tsx`, `src/__tests__/system-service.test.ts`, `scripts/check-foundation.mjs` (95 → **146** contrôles), `docs/FOUNDATION.md` |

---

## 4. Décisions techniques

1. **Le moteur ne dépend pas de Tauri** : `fs_engine` est du Rust standard (+ `sysinfo` pour les volumes), donc testable unitairement et réutilisable pour l'index SQLite.
2. **Parcours itératif** (pile explicite) : aucune récursion système, donc aucun risque de débordement de pile sur un arbre profond.
3. **Liens jamais suivis** : `symlink_metadata` partout ; un lien est affiché et signalé, jamais traversé.
4. **Dossiers protégés visibles mais non parcourus** : masquer une erreur serait trompeur, la parcourir serait dangereux et lent.
5. **Erreurs d'accès non bloquantes** : une entrée illisible est comptée, le parcours continue.
6. **Bornes par défaut** : profondeur 12, 2 000 résultats, 200 000 entrées visitées, 5 000 éléments par listage ; toute troncature est signalée à l'écran.
7. **Mode effectif** : réel dans Tauri, démonstration hors Tauri. L'étiquetage de l'interface suit le mode (plus de mention « démo » mensongère en mode réel).
8. **Aucun bouton destructif câblé** : Déplacer / Renommer / Supprimer ouvrent une explication explicite, comme avant, mais le texte ne prétend plus que le moteur est absent.
9. **Analyse statique** : `cargo clippy` est informatif dans la CI (le premier passage réel du compilateur est `cargo check` + `cargo test`), pour ne pas bloquer sur des préférences de style.

---

## 5. Tests réellement exécutés

Environnement local : Debian x86_64, Node 22.22.3, pnpm 12.3.4. **Aucun toolchain Rust n'est disponible** (ni `rustc`, ni `cargo`, ni accès à `static.rust-lang.org` / `deb.debian.org` / crates.io) : la compilation Rust **n'a pas pu être exécutée ici**.

| Vérification | Résultat |
|---|---|
| `pnpm typecheck` | **0 erreur** |
| `pnpm test` (Vitest) | **54 / 54 tests**, 5 fichiers |
| `pnpm check:foundation` | **146 / 146 contrôles** |
| `pnpm build` | succès — JS 330 kB (101,8 kB gzip), CSS 58,9 kB (12,6 kB gzip) |
| Transform des nouveaux modules par Vite (dev) | 10 / 10 en HTTP 200 |
| Tests Rust écrits | **34 tests** dans 9 fichiers (`fs_engine`, `state`, `commands/fs`) |
| `cargo check` / `cargo test` / `cargo build` | **exécutés par GitHub Actions sur `windows-latest`** : voir § 5 bis |

Détail des nouveaux tests d'interface : dossier de départ et tri, ouverture par double-clic, retour parent, historique Précédent/Suivant, tri par taille (deux sens), filtre par catégorie, éléments cachés, propriétés réelles, dossiers protégés (non parcourus), recherche récursive avec résultats, annulation de recherche, absence d'action destructive.

Tests du service : volumes en octets, dossiers rapides, listage trié, cachés, dossiers protégés et refus d'accès, métadonnées, parcours filtré, non-parcours des dossiers protégés, annulation, progression, pagination des applications, absence de méthode destructive, contrat IPC (10 commandes, aucune contenant `delete`/`remove`/`write`), événement `scan://progress`.

---

## 5 bis. Résultats réels de la CI Windows

Workflow `.github/workflows/ci.yml`, exécution finale
[`44457145239`](https://github.com/Boitier13/BOITIER-PC-MASTER/actions/runs/44457145239)
sur le commit `06c74df` — **succès des deux jobs** :

| Job | Étapes | Résultat |
|---|---|---|
| **Web** (ubuntu) | typage, Vitest, contrôles structurels (146), build | ✅ succès |
| **Rust** (windows-latest) | `cargo check --all-targets`, `cargo test --lib` (**34 tests**), `cargo clippy`, `cargo build --release` | ✅ succès |

### Erreurs de compilation réellement rencontrées et corrigées

Le premier passage a échoué ; chaque itération a été diagnostiquée puis
corrigée sur la branche (8 commits au total) :

| # | Erreur | Cause | Correction |
|---|---|---|---|
| 1 | `error: this file contains an unclosed delimiter` (`protected.rs:172`) | après extraction des politiques Windows/POSIX, le bloc `impl ProtectionPolicy` n'était plus fermé | fermeture de l'`impl` avant le module de tests |
| 2 | `E0382: borrow of moved value: item_path` (`walker.rs:239`) | `item_path` déplacé dans la pile de parcours puis emprunté pour l'événement de progression | clonage du chemin au moment de l'empilement (dossiers uniquement) |
| 3 | `E0599: no method named with_directory` (×4) | la même refonte avait supprimé `with_directory`, utilisée par 4 tests | méthode rétablie |
| 4 | Test `parcours_recursif_complet` : `left: 3, right: 2` | l'arborescence de test contient trois documents (`rapport.pdf`, `budget.xlsx`, `notes.txt`) | attente corrigée et vérification des deux fichiers attendus |

Aucune erreur de conception : les seuls échecs portaient sur des scories de
refactorisation et une attente de test. `sysinfo 0.30.13`, `tauri 2.12.7` et
`tempfile 3.27` se compilent correctement sur Windows.

### Diagnostic CI ajouté au passage

Les journaux de job sont hébergés hors de l'API GitHub et ne sont pas toujours
téléchargeables. Le workflow publie donc les erreurs du compilateur en
**annotations** (`.github/scripts/annotate-cargo.py`), lisibles via l'API et
directement dans l'interface GitHub, avec `CARGO_TERM_COLOR=never` pour des
journaux propres.

---

## 6. Ce qui reste à vérifier (honnêteté)

1. **Compilation et tests Rust** : désormais vérifiés sur Windows (`cargo check`, `cargo test --lib` — 34 tests, `cargo build --release`).
2. **Exécution interactive sur un PC Windows** : l'affichage réel de `C:`, des dossiers protégés et des erreurs d'accès n'a pas été observé dans une session graphique (l'environnement de développement n'a ni Windows ni WebView2). C'est la seule vérification qui reste manuelle.
3. **Performances sur très gros volumes** : bornées par les plafonds (profondeur 12, 2 000 résultats, 200 000 entrées), mais pas mesurées sur un disque de plusieurs millions de fichiers.
4. **Clippy** : exécuté sans blocage ; quelques avertissements de style éventuels restent visibles dans le job sans faire échouer la CI.

---

## 7. Ce qui n'a pas été fait (volontairement)

- Pas d'index SQLite ni d'instantanés datés (phase 4) : les données sont déjà au bon format.
- Pas d'inventaire des applications (registre, MSI, MSIX) ni de résidus (phase 5).
- Pas de suppression, déplacement, renommage, quarantaine : hors périmètre et interdit par la consigne.
- Aucune fusion, aucune pull request, `main` non modifiée.

---

## 8. Comment valider

```bash
pnpm install --frozen-lockfile
pnpm typecheck        # 0 erreur
pnpm test             # 54 tests
pnpm check:foundation # 146 contrôles
pnpm build            # bundle de production
```

Puis, pour le moteur réel :

1. consulter l'exécution verte `44457145239` sur la branche de session ;
2. sur un PC Windows avec Rust, exécuter `pnpm tauri dev` : l'explorateur affiche alors les volumes et dossiers réels, en lecture seule.
