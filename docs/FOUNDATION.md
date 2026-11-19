# Socle BOITIER PC MASTER — phase 1

Ce document décrit l'état du socle après le remplacement de Next.js par Vite et
la mise en place de Tauri 2. Il indique aussi, sans ambiguïté, ce qui a été
vérifié et ce qui ne peut pas l'être dans l'environnement de développement
actuel.

---

## 1. Pile technique

| Couche | Technologie | État |
|---|---|---|
| Interface | React 19.2 + TypeScript 5.7 strict | Compilé et testé |
| Outil de build | Vite 8.3 (+ plugin React) | Build vérifié |
| Styles | Tailwind CSS 4 + CSS historique de la maquette | Conservé à l'identique |
| Routage | React Router 7 (`HashRouter`) | 9 routes testées |
| Enveloppe bureau | Tauri 2.12 (CLI + API) | Structure vérifiée, **non compilée** |
| Moteur système | Rust (édition 2021), `tauri` 2, `serde` | Écrit, **non compilé** |
| Persistance | SQLite (schéma préparé, non activé) | Migration écrite, non exécutée |

Toutes les dépendances réseau ont été retirées : Next.js et Vercel Analytics ne
sont plus présents. Aucune police, image ou script n'est chargé depuis Internet.

---

## 2. Organisation

```
src/
├── app/            coque, navigation, routes
│   ├── App.tsx           arborescence des 9 routes
│   ├── AppShell.tsx      barre latérale, barre supérieure, modale, notification
│   ├── navigation.tsx    groupes et entrées du menu
│   └── routes.ts         chemins + libellés du fil d'Ariane
├── features/       1 dossier = 1 écran (dashboard, explorer, inventory,
│                   disk-analysis, applications, uninstall, monitoring,
│                   history, settings)
├── components/     briques partagées (PageHeading, DemoLabel, Metric, Ranking)
├── domain/         types métier + libellés (aucune dépendance UI)
├── services/       contrat SystemService et ses deux implémentations
│   ├── system-service.ts            interface + ServiceError
│   ├── mock/mock-system-service.ts  moteur de démonstration (données fictives)
│   ├── tauri/tauri-system-service.ts moteur Windows (capacités IPC seulement)
│   └── index.ts                     fabrique (démo par défaut)
├── ipc/            frontière React ↔ Rust (liste blanche + types miroirs)
├── store/          état d'interface + fourniture du service
├── data/           fixtures de démonstration (conservées) + projection typée
└── styles/         globals.css (maquette conservée)
src-tauri/
├── Cargo.toml, build.rs, tauri.conf.json
├── capabilities/default.json     cœur Tauri uniquement
├── icons/                        icon.ico multi-résolutions inclus
└── src/
    ├── lib.rs            builder + liste explicite des commandes
    ├── commands/system.rs  app_info, engine_status, db_status, ping
    ├── db/               emplacement + schéma v1 (non exécuté)
    └── platform/windows/ plan des futures API Windows (aucun appel)
```

---

## 3. Contrat `SystemService`

Une seule interface, deux implémentations :

- **`MockSystemService`** : données de démonstration, aucun accès système,
  aucun appel réseau. C'est le mode actif aujourd'hui, y compris dans Tauri.
- **`TauriSystemService`** : interroge réellement `engine_status` et `ping` ;
  toutes les autres méthodes lèvent `ServiceError('unimplemented')`, traduite
  par l'interface en message explicite.

Les opérations destructives sont **déclarées mais non implémentées** :
`requestUninstall` (retourne un plan, n'exécute rien) et `planCleanup`.
Aucune fonction d'exécution n'existe dans le code.

---

## 4. Communication React ↔ Rust

- 4 commandes, toutes en lecture, sans paramètre fourni par l'utilisateur :
  `app_info`, `engine_status`, `db_status`, `ping`.
- Déclarées une seule fois dans `lib.rs` (`invoke_handler`) et une seule fois
  côté frontend (`src/ipc/contracts.ts`), avec des types miroirs.
- `withGlobalTauri: false` : pas d'objet global exposé à la page.
- Aucun plugin (`fs`, `shell`, `process`, `http`) : la surface d'attaque est
  réduite à ces quatre commandes.
- CSP stricte (pas d'`unsafe-eval`, pas de joker sur les scripts).
- Erreurs typées `{ code, message }`, jamais de détail interne brut.
- **Aucune élévation** : exécution avec les droits de l'utilisateur courant.

---

## 5. SQLite — préparé, non activé

- `src-tauri/src/db/migrations/001_init.sql` : `schema_version`, `settings`,
  `snapshots`, `volumes`, `entries`, `installed_apps`, `residues`, `audit_log`,
  `quarantine`. Tailles en octets, dates en ISO 8601 UTC.
- Le schéma est **embarqué** dans le binaire (`include_str!`) mais n'est pas
  exécuté : `db_status` renvoie `{ ready: false, path, schemaVersion: 1 }`.
- Emplacement prévu : `%APPDATA%\fr.boitier.pcmaster\boitier.db`.
- Décision pour la phase 2 : `rusqlite` avec la feature `bundled` (aucune
  dépendance système, fonctionnement hors ligne), WAL, migrations versionnées.

---

## 6. Vérifications réellement exécutées

| Commande | Résultat |
|---|---|
| `pnpm typecheck` | 0 erreur |
| `pnpm build` | succès (301 kB JS / 92,6 kB gzip, CSS 54 kB) |
| `pnpm test` | **32 tests réussis** (3 fichiers) |
| `pnpm check:foundation` | **95 contrôles réussis** |
| `pnpm tauri info` | projet détecté : React + Vite, `frontendDist: ../dist`, CSP lue |
| `pnpm tauri icon` | `icon.ico` généré (6 résolutions) |

Tests couverts :

1. les **9 écrans** existent, avec leur titre et leur fil d'Ariane ;
2. une URL inconnue ramène au tableau de bord ;
3. la navigation latérale fonctionne ;
4. le mode démonstration fournit 3 disques / 9 applications / 7 éléments ;
5. la recherche et le filtre par type fonctionnent ;
6. la modale d'action s'ouvre et se ferme ;
7. les résidus système ne sont pas sélectionnables ;
8. le thème bascule ;
9. la surveillance simulée évolue ;
10. l'historique se filtre par onglet ;
11. **aucun appel réseau** (`fetch` / XHR) au chargement des 9 écrans ;
12. le client IPC refuse tout hors Tauri et toute commande inconnue.

Parité visuelle vérifiée par analyse statique : les **216 classes CSS** utilisées
par la maquette sont toutes présentes dans le socle, et aucun libellé d'interface
n'a été perdu.

---

## 7. Ce qui n'a PAS pu être vérifié ici

L'environnement de développement est un conteneur Linux **sans Rust** et **sans
accès à crates.io**, et il n'existe aucune cible Windows/WebView2.

| Élément | Statut |
|---|---|
| `cargo check` / `cargo build` | **non exécuté** (rustc et cargo absents) |
| `pnpm tauri dev` | **non exécuté** (nécessite Rust + WebView2) |
| `pnpm tauri build` (MSI/NSIS) | **non exécuté** |
| Exécution réelle sous Windows (UAC, registre, WebView2) | **non testée** |
| Validation du schéma JSON de `tauri.conf.json` | contrôle structurel local uniquement |

Aucun résultat de compilation Rust n'est donc affirmé. Le code Rust a été écrit
en suivant strictement le gabarit officiel Tauri 2 et volontairement réduit à
quatre commandes triviales pour limiter le risque d'erreur invisible.

### À exécuter sur une machine Windows avec Rust

```powershell
# Prérequis : rustup (toolchain MSVC) + Visual Studio Build Tools (C++),
#             WebView2 (inclus dans Windows 11), WiX si vous voulez le MSI.
rustup default stable-msvc

pnpm install
cargo check --manifest-path src-tauri/Cargo.toml   # attendu : aucune erreur
pnpm tauri dev                                     # fenêtre de l'application
pnpm tauri build                                   # MSI + NSIS dans src-tauri/target/release/bundle
```

Si `cargo check` signale une erreur, merci de la transmettre telle quelle : elle
sera corrigée sans modifier le reste du socle.

---

## 8. Choix assumés pour cette phase

1. **Mode démonstration par défaut**, même dans Tauri : les écrans restent
   utilisables et honnêtement étiquetés, en attendant le moteur réel.
2. **Bugs de la maquette conservés** (recherche couplée, tri absent, thème clair
   incomplet, interrupteurs hors React…), conformément à la consigne « ne
   remplacer aucune fonctionnalité visuelle ». Ils sont annotés dans le code par
   leur numéro d'audit (`B1`, `B2`, `B8`…) pour être traités écran par écran.
3. **Écrans alimentés de façon synchrone** par les fixtures (`useWorkspace`) :
   c'est une couture de transition, documentée, remplacée en phase 2 par des
   appels asynchrones à `SystemService` avec états de chargement.
4. **Un seul ajout visuel** : la règle CSS du niveau de confiance « Incertain »
   (présent dans la légende, sans style auparavant). Aucun élément de
   démonstration ne l'utilise : le rendu actuel est inchangé.

---

## 9. Prochaines étapes proposées

| Phase | Contenu | Prérequis |
|---|---|---|
| 2 | SQLite réel (rusqlite), réglages persistés, `getCapabilities` par écran | Rust compilable |
| 3 | Volumes réels + parcours de fichiers + index, progression et annulation | Phase 2 |
| 4 | Instantanés datés et comparaison | Phase 3 |
| 5 | Inventaire des applications (registre 64/32, MSI, MSIX) + inventaire lisible | Phase 3 |
| 6 | Détection des résidus avec score explicable | Phase 5 |
| 7 | Quarantaine, restauration, journal d'audit, confirmation finale | Phase 6 |
| 8 | Surveillance des installations (instantané avant/après) | Phase 4 |
| 9 | Rapports, conservation, i18n, thème clair complet, accessibilité | Phases 2-8 |

Aucune de ces phases n'inclut de suppression définitive : la quarantaine
réversible reste le seul mode de nettoyage prévu.

---

## 10. Phase 3 — explorateur et inventaire (implémentée)

La phase 3 est désormais réalisée : voir **`docs/FEATURE_EXPLORER.md`** pour le
détail (commandes, structures, garde-fous, tests, limites).

Résumé des changements d'architecture depuis la phase 1 :

| Point | Phase 1 | Phase 3 |
|---|---|---|
| Mode réel | `TauriSystemService` limité à `getCapabilities`/`ping` | volumes, dossiers, métadonnées, parcours annulable |
| Mode par défaut du contexte | démonstration systématique | réel dans Tauri, démonstration hors Tauri |
| Données de fichiers | libellés pré-formatés (`sizeLabel`, `modifiedAt`) | octets (`sizeBytes`) + horodatages UNIX (ms) |
| Explorateur | liste plate figée, navigation inerte | navigation réelle, tri, filtres, propriétés, recherche |
| Inventaire / tableau de bord | capacités fictives | volumes lus par le moteur (ou fictifs en démo) |
| SQLite | non ouvert | toujours non ouvert (phase 4) |

Les bugs de maquette conservés par la phase 1 (B1, B2, B6, B8, interrupteurs hors
React, compteur « 24 ») restent inchangés **hors** de l'écran Explorateur : B2
(icônes déduites de l'index) et B6 (tri absent) y sont corrigés, puisque la
mission 3 consistait précisément à remplacer cette maquette par un moteur réel.

---

## 11. Applications installées et diagnostic du moteur (lot C1)

### 11.1 Inventaire réel, en lecture seule

| Élément | Avant | Après |
|---|---|---|
| Source des applications | fixtures `demo.ts` uniquement | registre Windows (`Uninstall`), 3 vues, lecture seule |
| Type `InstalledApp` | libellés pré-formatés (`sizeLabel`, `installedAt`) | valeurs typées (`sizeBytes`, `installedAtMs`, `scope`, `architecture`) |
| Filtrage / tri / pagination | dans le composant | dans le moteur Rust (`apps_list`) |
| Écran Applications | fixtures, mention « Données de démonstration » | données réelles, ou état d'erreur explicite |
| Capacité `installedApps` | `false` | `true` (mesurée, pas déclarative) |
| État du moteur | texte figé « Non connecté » | sonde réelle `app_info` + `engine_status` + `ping` |
| Diagnostic | inexistant | panneau **Paramètres › Diagnostic moteur** |

Dépendance ajoutée : `winreg 0.52`, limitée à `cfg(windows)` et confinée à
`src-tauri/src/apps/windows.rs`, avec `KEY_READ` uniquement. La règle de
fondation « aucun accès registre » devient donc « **aucune écriture** de
registre », vérifiée par `scripts/check-foundation.mjs` (`set_value`,
`create_subkey`, `delete_subkey`, `RegSetValue`, `RegDelete` interdits).

### 11.2 Ce que l'interface n'affiche plus

- plus aucun chiffre d'applications écrit en dur (`42`) : le compteur vient de
  `apps_list`, ou affiche `—` si le moteur est indisponible ;
- plus de statut « Non connecté » figé : quatre états mesurés
  (`probing`, `connected`, `demo`, `unavailable`) ;
- plus de profil inventé : le nom affiché provient du dossier personnel réel
  (`user_folders`), ou « Session locale » si la lecture échoue ;
- plus de badge « 3 » sur la désinstallation avancée.

### 11.3 Limites assumées

1. **Applications MSIX/Store non inventoriées** (elles ne figurent pas dans les
   clés `Uninstall`) — lot ultérieur.
2. **Taille approximative** : `EstimatedSize` fournie par Windows, affichée avec
   le préfixe `≈` ; jamais estimée par balayage de dossier.
3. **Autres comptes utilisateurs non lus** (pas de montage de ruche).
4. **Aucune désinstallation exécutée** : la commande déclarée est affichée,
   jamais lancée.

## 12. Lot B — fiabilisation des données (2026-11-19)

Le tableau de bord et les écrans d'analyse, d'historique, de désinstallation et
de surveillance ne contiennent plus aucune valeur d'exemple.

| Élément | Avant | Après |
|---|---|---|
| Fichiers affichés | `124 806` en dur | mesure réelle, ou « — » |
| Répartition par catégorie | `2,1 To` et 4 tailles figées | agrégats de `analysis_scan`, ou état vide |
| Activité récente | fixtures + horodatages déduits de l'index | journal de session réel |
| Espace utilisé | absent | somme réelle des volumes |
| Analyse de l'espace | 7 catégories, 2 classements fictifs | mesure du périmètre choisi, couverture affichée |
| Historique | 4 lignes fictives, compteurs `12/8/5/24` | journal de session, compteurs calculés |
| Désinstallation | résidus Adobe présélectionnés | état vide « lot C2 » |
| Surveillance | faux rapport `24/6/12/2` | écran inerte, mention « lot C4 » |
| Mode démonstration | exemples chiffrés | mêmes états d'indisponibilité |

**Nouveauté moteur** : `analysis_scan` (lecture seule, bornée, annulable) et
`fs_engine::walker::traverse`, boucle unique partagée par l'exploration et la
mesure. Aucune écriture, aucun processus, aucune suppression.

**Contrats** : `scripts/check-foundation.mjs` passe à 165 contrôles, dont 8 pour
la mesure (commande déclarée et miroitée, aucune écriture, boucle unique, plus
aucune valeur de la maquette dans les écrans, plus aucune fixture consommée,
mock qui refuse au lieu d'inventer, journal non persisté, lots nommés).

**Limites** : pas de persistance (lot D), doublons et résidus absents (lots C5 et
C2), surveillance absente (lot C4). Toute mesure partielle est annoncée comme
telle, avec le nombre d'entrées refusées et de dossiers protégés non parcourus.
