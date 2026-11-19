# Explorateur et inventaire de fichiers — phase 3

Première fonctionnalité métier réelle de BOITIER PC MASTER : parcourir les
lecteurs, dossiers et fichiers de Windows, **en lecture seule**, avec
progression, annulation et préparation des futurs inventaires datés.

## 1. Principe

| Couche | Rôle | Fichiers |
| --- | --- | --- |
| Moteur Rust portable | Lecture pure du système de fichiers, sans Tauri | `src-tauri/src/fs_engine/*` |
| Commandes IPC | Frontière unique, erreurs typées, événements de progression | `src-tauri/src/commands/fs.rs` |
| Contrats TypeScript | Miroirs exacts des structures Rust | `src/ipc/contracts.ts`, `src/ipc/client.ts` |
| Services | Moteur réel (`TauriSystemService`) et moteur démo (`MockSystemService`) | `src/services/**` |
| Interface | Explorateur, inventaire des disques, panneau du tableau de bord | `src/features/**`, `src/hooks/**` |

Le même contrat `SystemService` sert les deux modes : aucun écran ne sait s'il
parle au disque ou à l'arborescence fictive.

## 2. Commandes exposées (toutes en lecture)

| Commande | Entrée | Sortie |
| --- | --- | --- |
| `volumes_list` | — | `VolumeDto[]` (lettre, libellé, type de média, système de fichiers, octets) |
| `user_folders` | — | `UserFolderDto[]` (profil, bureau, téléchargements, documents, images…) |
| `directory_list` | `path`, `options` | `DirectoryListingDto` (entrées, total, troncature, refus, protection) |
| `path_metadata` | `path` | `FileEntryDto` |
| `walk_start` | `scanId`, `root`, `options` | `WalkResult` (entrées + statistiques) |
| `walk_cancel` | `scanId` | `bool` |

Événement : `scan://progress` (identifiant de parcours, entrées visitées,
résultats, chemin courant, durée).

**Aucune** commande d'écriture, de suppression, de déplacement, de renommage ou
d'élévation n'existe. Il n'y a donc aucun chemin de code capable de modifier un
fichier de l'utilisateur, même en cas de bug de l'interface.

## 3. Données remontées par entrée

- nom, chemin complet, dossier parent, extension (normalisée en minuscules) ;
- catégorie stable : `folder`, `document`, `image`, `video`, `audio`,
  `archive`, `application`, `system`, `other` ;
- taille en octets (`0` pour un dossier : la taille d'un dossier exige un
  parcours complet, qui n'est pas fait au listage) ;
- dates de création, de modification et d'accès en **millisecondes UNIX** ;
- indicateurs : dossier, lien symbolique / jonction, protégé, accès refusé ;
- attributs Windows (`FILE_ATTRIBUTE_*`) : lecture seule, caché, système,
  archive, compressé, chiffré, sparse, hors ligne, temporaire, point d'analyse,
  plus la valeur brute.

Les horodatages sont des nombres : ils se trient, se comparent et se stockent
directement en SQLite, sans dépendre du format d'affichage.

## 4. Règles de sécurité et de robustesse

1. **Lecture seule** : le module `fs_engine` n'appelle aucune fonction
   d'écriture (`fs::write`, `remove_file`, `rename`, `copy`, `create_dir`…).
2. **Liens jamais suivis** : les métadonnées sont lues avec `symlink_metadata`
   et un lien n'est jamais parcouru — pas de boucle, pas d'échappement hors du
   périmètre choisi.
3. **Dossiers protégés** : `System Volume Information`, `$Recycle.Bin`,
   `WinSxS`, `System32\config`, `DriverStore`, `Installer`, `servicing`, `CSC`,
   `Prefetch`, dossiers temporaires système. Ils restent **visibles** avec un
   badge, mais ne sont jamais parcourus.
4. **Erreurs d'accès** : une entrée illisible est comptée et signalée
   (`access_denied`), le parcours continue. Le nombre de refus est affiché.
5. **Bornes** : profondeur (12 par défaut), résultats (2 000), entrées visitées
   (200 000), plafond de listage (5 000). Toute troncature est signalée.
6. **Annulation** : jeton `AtomicBool` par parcours, enregistré dans
   `AppState`, déclenché par `walk_cancel`, résolu par des résultats partiels
   marqués `cancelled: true`.
7. **Aucune élévation de privilèges** : le processus s'exécute avec les droits
   de l'utilisateur courant ; un refus Windows est rapporté, pas contourné.
8. **Chemins longs** : préfixe `\\?\` ajouté au-delà de 240 caractères.
9. **Pseudo-fichiers** (`pagefile.sys`, `hiberfil.sys`, `swapfile.sys`) :
   signalés protégés, exclus des inventaires de taille.

## 5. Interface

**Explorateur** (`/explorer`)
- arborescence : profil + dossiers d'accès rapide, puis volumes réels ;
- fil d'Ariane cliquable, Précédent / Suivant / Dossier parent avec historique ;
- tableau triable (nom, type, taille, date), dossiers toujours en tête ;
- filtre par catégorie, bascule des éléments cachés ;
- badges « protégé », « lien », « accès refusé » ;
- recherche récursive dans les sous-dossiers : progression, nombre d'éléments
  examinés, résultats, annulation, retour au dossier ;
- panneau Propriétés : taille, catégorie, dates, état, emplacement, attributs.

**Inventaire** (`/inventory`) et panneau disques du tableau de bord : volumes et
capacités réels (ou fictifs en démonstration), en octets, sans écriture.

**Mode démonstration** : arborescence fictive (`src/data/demo-tree.ts`) servant
les mêmes cas — dossiers, fichiers, tailles, dates, attributs, liens, dossiers
protégés, accès refusés, annulation. Aucun accès disque.

## 6. Tests

- **Vitest** : 54 tests (`src/__tests__`), dont 11 nouveaux sur l'explorateur
  (navigation, tri, filtre, cachés, propriétés, dossiers protégés, recherche,
  annulation, absence d'action destructive) et 15 sur le service de
  démonstration (listage, erreurs, parcours, protections, contrat IPC).
- **Rust** : tests unitaires dans `fs_engine` (chemins, catégories, listage,
  tri, plafonds, protections, parcours, annulation, volumes, dossiers) et dans
  `state.rs` (jetons d'annulation), exécutés par la CI sur `windows-latest`.
- **Contrôles structurels** : `pnpm check:foundation` vérifie aussi l'absence
  d'API destructive dans le moteur et la présence des garde-fous.

## 7. Limites connues

- La compilation Rust n'a pas pu être exécutée dans l'environnement de
  développement (aucun toolchain, aucun accès à crates.io) : elle est confiée à
  GitHub Actions (`windows-latest`), qui exécute `cargo check`, `cargo test`,
  `cargo clippy -D warnings` et `cargo build --release`.
- Pas encore d'index SQLite : les inventaires datés et les comparaisons
  utiliseront les mêmes structures (`FileEntryDto` + statistiques) en phase 4.
- Pas de surveillance de volume (USN/MFT) : les très gros volumes sont bornés
  par les plafonds ci-dessus.
- Les tailles de dossiers ne sont pas agrégées au listage (seulement pendant un
  parcours, via `stats.totalSizeBytes`).

## 8. Suites prévues

1. Persistance des inventaires (SQLite) et comparaison entre deux dates.
2. Analyse de l'espace par catégorie à partir des inventaires enregistrés.
3. Inventaire des applications installées (registre + MSI), toujours sans
   suppression.
