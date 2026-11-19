# BOITIER PC MASTER — Audit technique et fonctionnel

**Dépôt audité :** `Boitier13/BOITIER-PC-MASTER`
**Révision analysée :** `a284a01ceec5e3aae7fa1788390157c2439f714f` (« Initial commit from v0 », 19/11/2026)
**Branche de travail :** `arena/ce96ae0d-boitier-pc-master` (identique à `main`)
**Date de l'audit :** 19/11/2026
**Portée :** lecture seule — aucun fichier source modifié, aucun commit, aucun push.

---

## Méthode et limites

Ce que j'ai réellement fait :

1. Lecture intégrale des **24 fichiers** du dépôt (aucun fichier ignoré, y compris CSS, données, configuration, lockfile).
2. Installation des dépendances figées (`pnpm install --frozen-lockfile`, **OK**, lockfile non modifié) puis vérifications d'exécution :
   - `tsc --noEmit` → **0 erreur** ;
   - `next build` → **succès** (mais avec « Skipping validation of types », voir §6) ;
   - `next start` + requêtes HTTP réelles : page `/` en **200**, `/parametres`, `/applications`, `/explorateur` en **404** ;
   - export statique testé **hors du dépôt** (`output: "export"`) : **succès**, 865 Ko générés — preuve de faisabilité Tauri (§8).
3. Analyse statique outillée (comptage des boutons sans gestionnaire, des états React, des couleurs codées en dur, des tailles de police, calcul des contrastes WCAG, vérification des totaux numériques).

Limites à assumer honnêtement :

- **Aucun navigateur graphique n'est disponible dans cet environnement** : je n'ai pas cliqué dans l'interface. Les constats d'interaction sont établis par **lecture du code** (chaque affirmation renvoie à une ligne précise) et par le HTML rendu côté serveur. Lorsqu'un comportement est déduit et non observé au clic, c'est signalé.
- Le dépôt ne contient **aucun historique de développement** (un seul commit). Impossible de savoir ce qui a été retiré ou prévu précédemment.
- Aucune référence à l'ancien projet ATLAS PC n'est présente dans le dépôt (recherche insensible à la casse : 0 résultat) : le projet est bien indépendant.

Artefacts d'exécution (`.next/`, `next-env.d.ts`, `tsconfig.tsbuildinfo`, `node_modules/`) supprimés ou ignorés par Git à la fin de l'audit : `git status` était **vide** avant rédaction de ce rapport. Ce rapport est le **seul fichier ajouté**, non commité.

---

## 1. État général du projet

### 1.1 Nature réelle du dépôt

Ce dépôt **n'est pas une application Windows** : c'est une **maquette web** (Next.js 16.4.6 / React 19.2.4 / TypeScript 5.7), monopage, entièrement côté client, alimentée par un jeu de données fictif statique.

| Élément | Réalité constatée |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack), une seule route `/` |
| Backend / API | **Aucun** (aucune route API, aucune server action, aucun `fetch`) |
| Accès système | **Aucun** (aucun `invoke`, aucun accès disque/registre/processus) |
| Persistance | **Aucune** (pas de SQLite, pas de `localStorage`, pas d'`indexedDB`) |
| Tauri / Rust | **Absents** (aucun `src-tauri`, `Cargo.toml`, `tauri.conf.json`, crate, ni dépendance `@tauri-apps/*`) |
| Données | `data/demo.ts` : 3 disques, 9 applications, 7 éléments de fichiers, 4 résidus, 4 opérations d'historique |
| Tests / lint / CI | **Aucun** |
| Documentation | **Aucune** (pas de README, pas de licence) |

### 1.2 Volumétrie

| Fichier | Poids | Rôle |
|---|---:|---|
| `components/pc-master.tsx` | 42 Ko, **84 lignes** (lignes de 1 000 à 6 000 caractères) | Les 9 écrans + la coque |
| `app/globals.css` | 40 Ko, 37 lignes | **Toute** la mise en forme (237 couleurs hex) |
| `data/demo.ts` | 4 Ko | Données fictives |
| `components/ui/button.tsx` | 3 Ko | Composant shadcn **jamais importé** |
| `pnpm-lock.yaml` | 3 499 lignes | 89 % des lignes du dépôt |

Le code applicatif réel tient donc dans **un composant unique de 42 Ko et une feuille de style de 40 Ko**.

### 1.3 Verdict d'ensemble

> **Maquette d'interface avancée et cohérente, sans aucune fonctionnalité métier réelle.**

- La **direction artistique** est le vrai atout du dépôt : 9 écrans complets, densité « outil professionnel », vocabulaire français soigné, états actifs/désactivés, responsive (3 points de rupture), mentions de démonstration honnêtes et visibles.
- La **couche métier est à 0 %** : aucune fonction des deux priorités (inventaire approfondi, désinstallation avancée) n'est implémentée. Tout est simulé, y compris les chiffres affichés (qui sont codés en dur et se contredisent, voir §6).
- L'**architecture technique** (monolithe client, routage par `useState`, CSS manuel, Next.js avec serveur) est en décalage avec la cible Tauri 2 + Rust + SQLite : la migration ne sera pas un portage, mais une **reconstruction du socle** en conservant le design.

### 1.4 Tableau de synthèse des fonctionnalités

Légende : **Réel** = fonctionne sur de vraies données · **Partiel** = fonctionne mais sur données fictives ou incomplet · **Simulé** = données inventées, aucun effet · **Visuel** = décoratif, sans logique · **Absent** = inexistant.

#### Priorité 1 — Exploration et inventaire

| Fonction attendue | Statut | Preuve / emplacement |
|---|---|---|
| Explorer tous les disques et partitions | **Simulé** | `data/demo.ts` L1-5 ; aucun appel système dans tout le dépôt |
| Explorer dossiers et fichiers | **Simulé** | 7 éléments figés, `data/demo.ts` L19-27 ; `pc-master.tsx` L75 |
| Afficher les caractéristiques détaillées | **Simulé** | Panneau Propriétés, `pc-master.tsx` L75 ; icône toujours « dossier », taille « — » pour les dossiers |
| Rechercher des fichiers | **Partiel** | Filtre `includes()` sur 7 noms, `pc-master.tsx` L34 |
| Filtrer par type | **Partiel** | `<select>` unique à 4 options, `pc-master.tsx` L75 ; incohérences §6 |
| Identifier les fichiers/dossiers volumineux | **Simulé** | Classements codés en dur, `pc-master.tsx` L78-79 |
| Enregistrer plusieurs inventaires datés | **Absent** | Aucun stockage ; l'« historique » est un tableau de 4 lignes fictives |
| Comparer deux inventaires | **Absent** | Boutons « Comparer des inventaires » → modale générique (`pc-master.tsx` L83) |
| Analyse de l'espace disque | **Simulé** | Camembert CSS figé (dégradé conique codé en dur), `globals.css` L24 ; `pc-master.tsx` L78 |
| Surveillance des installations | **Simulé** | Progression purement visuelle, `pc-master.tsx` L82 |
| Conservation des rapports | **Absent** | Bouton « Exporter » → modale (`pc-master.tsx` L83) |

#### Priorité 2 — Désinstallation avancée

| Fonction attendue | Statut | Preuve / emplacement |
|---|---|---|
| Répertorier les applications réellement installées | **Simulé** | 9 applications inventées, `data/demo.ts` L7-17 |
| Lancer la désinstallation officielle | **Absent** | Bouton → modale « moteur non connecté », `pc-master.tsx` L58 et L80 |
| Rechercher les résidus (fichiers, registre…) | **Simulé** | 4 résidus statiques liés à Photoshop, `data/demo.ts` L29-34 |
| Niveaux de confiance | **Visuel** | Libellés « Élevée/Probable/Système » sur données figées ; légende « Incertain » sans aucun cas |
| Distinguer personnel / partagé / système | **Visuel** | Une seule ligne « Partagé / système », case à cocher désactivée (`pc-master.tsx` L81) — **règle codée en dur sur le texte « Système »** |
| Nettoyage contrôlé par l'utilisateur | **Absent** | Sélection de cases à cocher réelle, mais « Nettoyer » → modale |
| Sauvegarde et restauration | **Absent** | Mentionnées nulle part dans le code |

#### Transverse

| Fonction | Statut |
|---|---|
| Navigation entre les 9 écrans | **Réel** (état React, `pc-master.tsx` L17/L36-48/L53) |
| Thème sombre / clair | **Partiel** (bascule réelle mais rendu clair incomplet, §6 B10 ; non persisté) |
| Recherche globale | **Partiel** et **buguée** (§6 B1) |
| Paramètres | **Visuel** (interrupteurs et sélecteurs sans effet, §6 B8/B9) |
| Fonctionnement hors ligne | **Presque** (aucune police/CDN externe) mais `@vercel/analytics` en production (§6 B19) |
| Accessibilité | **Partielle** (26 `aria-label`, rôles `tab`/`dialog`/`switch` ; mais lignes cliquables non focusables, texte 8-9 px) |

---

## 2. Architecture et organisation des fichiers

### 2.1 Arborescence réelle (24 fichiers suivis)

```
.
├── app/
│   ├── layout.tsx          # <html lang="fr">, métadonnées, Analytics Vercel (L1, L42)
│   ├── page.tsx            # 5 lignes : <PcMaster />
│   └── globals.css         # 40 Ko : variables, tous les composants, 3 media queries
├── components/
│   ├── pc-master.tsx       # 42 Ko : coque + 9 « pages » + 12 sous-composants
│   └── ui/button.tsx       # composant shadcn/base-ui — JAMAIS importé
├── data/demo.ts            # 5 tableaux de données fictives
├── lib/utils.ts            # cn() — utilisé uniquement par button.tsx (donc mort)
├── public/                 # 4 icônes + 4 images « placeholder » inutilisées
├── components.json         # config shadcn (aliases @/hooks inexistants)
├── next.config.mjs         # ignoreBuildErrors: true
├── postcss.config.mjs      # Tailwind v4
├── pnpm-workspace.yaml     # clé douteuse « pmOnFail »
├── tsconfig.json, package.json, pnpm-lock.yaml, .gitignore
```

### 2.2 Découpage du composant monolithe

`components/pc-master.tsx` contient, dans un seul fichier :

| Lignes | Contenu |
|---|---|
| L1-L5 | `"use client"`, imports (51 icônes lucide, dont 3 inutilisées) |
| L7-L14 | Type `Section` (union de 9 chaînes), `navGroups`, `EyeIcon` (alias d'`Activity`), `fmt` |
| L16-L60 | Composant `PcMaster` : **16 `useState`**, `notify`, `operation`, 3 `useMemo`, `switch` de routage, coque, modale, toast |
| L62-L63 | `PageHeading`, `DemoLabel` |
| L64-L71 | `Dashboard` |
| L72 | `Metric` |
| L73 | `SectionToolbar` — **jamais rendu** (code mort) |
| L74-L76 | `Explorer` |
| L77 | `Inventory` |
| L78-L79 | `DiskAnalysis`, `Ranking` |
| L80 | `Applications` |
| L81 | `Uninstaller` |
| L82 | `MonitorInstall` |
| L83 | `HistoryPage` |
| L84 | `SettingsPage` |

### 2.3 Choix structurants (et leurs conséquences)

1. **Routage par état, pas par URL.** `const [section, setSection] = useState<Section>("Tableau de bord")` (L17), rendu par `switch` (L36-48). Conséquence vérifiée : `/parametres`, `/applications`, `/explorateur` renvoient **404**. Aucun lien profond, aucun bouton « précédent » du navigateur, rechargement = retour au tableau de bord.
2. **Tout l'état dans le parent.** 16 `useState` dans `PcMaster`, redescendus en props (jusqu'à 9 props pour `Explorer`, L74). Pas de store, pas de contexte, pas de reducer. Toute la « logique » est dans le JSX.
3. **Aucune couche métier.** Pas de dossier `services/`, `domain/`, `hooks/`, `types/`. Les entités n'ont **aucun type explicite** (types inférés de `demo.ts`), et `any` est utilisé 5 fois (L72, L80, L81, L83).
4. **Aucune abstraction d'accès système.** Rien à remplacer par du Rust aujourd'hui : les données arrivent par `import` statique (L5).
5. **CSS manuel, pas de Tailwind.** `globals.css` définit 237 couleurs hexadécimales et une centaine de classes maison ; Tailwind v4 et `tw-animate-css` sont installés et importés (`globals.css` L1-3) mais **aucune classe utilitaire n'est utilisée dans le JSX**. `components/ui/button.tsx` (shadcn/base-ui) est du code mort.
6. **Tout en un fichier, très longues lignes.** Certaines lignes dépassent 5 000 caractères (ex. L75, L81, L84). Conséquences concrètes : `git diff`/`git blame` inexploitables, revue de code impossible, risque élevé de régression lors des modifications.
7. **Configuration permissive.** `next.config.mjs` désactive la validation TypeScript au build (`ignoreBuildErrors: true`) alors que `tsc` passe aujourd'hui : la sécurité est retirée sans nécessité.

### 2.4 Qualité des données de démonstration

`data/demo.ts` est propre et lisible, mais **non typé** et **non relié aux chiffres affichés** :

- 3 disques (`L1-5`) : 476/953/1863 Go, utilisés 312/581/1042, libres cohérents (total − utilisé).
- 9 applications (`L7-17`) : nom, éditeur, version, date, taille (chaîne « 2,84 Go »), type d'installeur, état.
- 7 éléments de fichiers (`L19-27`) : mélange de dossiers et de fichiers, dates en chaîne `JJ/MM/AAAA HH:MM`.
- 4 résidus (`L29-34`) : tous rattachés à Adobe Photoshop, un seul marqué « Système ».
- 4 opérations d'historique (`L36-41`) : dates en texte français.

Tailles stockées en **chaînes localisées** (« 1,28 Go ») : impossible de trier, d'additionner ou de comparer sans analyse syntaxique. À remplacer par des entiers d'octets dans la cible.

---

## 3. Fonctionnalités réellement réalisées

Ce qui **fonctionne vraiment**, avec le code correspondant. Il s'agit exclusivement de mécanique d'interface sur données fictives.

| Fonction | Emplacement | Ce qui marche réellement |
|---|---|---|
| Navigation entre 9 sections | L17, L36-48, L53 | Clic sur le menu → changement d'écran, section active surlignée |
| Sélection d'un disque partagée | L20, L74, L77 | Cliquer un disque dans l'arborescence ou une carte met à jour l'autre écran |
| Recherche (texte) | L19, L33-L34 | Filtrage `includes()` insensible à la casse sur nom + éditeur |
| Filtre de type de fichier | L29, L34, L75 | `select` contrôlé, filtrage réel (mais voir B2) |
| Sélection d'une ligne d'application | L80 | Ligne surlignée, barre d'action activée, boutons `disabled` corrects |
| Sélection de résidus | L23, L81 | Cases à cocher réelles, compteur mis à jour, ligne « Système » non sélectionnable |
| Choix du mode de désinstallation | L22, L81 | 3 cartes réellement sélectionnables, radio visuel |
| Onglets d'historique | L26, L35, L83 | Filtrage réel des 4 lignes par `kind` |
| Bascule thème sombre/clair | L18, L49 | Classe `theme-light` appliquée à la coque ; rendu partiellement correct (B10) |
| Repli de l'arborescence | L28, L75 | Bouton chevron fonctionnel |
| Modale + toasts | L24-L25, L57-L58 | Ouverture/fermeture, fermeture par clic sur le fond, toast auto-effacé à 3,2 s |
| Démarrage/arrêt de la « surveillance » | L30, L82 | Change l'état visuel des étapes (aucune observation réelle) |
| Responsive | `globals.css` L35-37 | 3 points de rupture (1150/800/540 px), barre latérale réduite à 62 px |
| Accessibilité de base | 26 `aria-label`, rôles `tablist`/`tab`/`dialog`/`switch` | Libellés présents sur la plupart des icônes-boutons |

**Vérifications d'exécution (mesurées) :**

| Vérification | Résultat |
|---|---|
| `pnpm install --frozen-lockfile` | Succès (lockfile inchangé) |
| `tsc --noEmit` | **0 erreur** |
| `next build` | Succès — mais « **Skipping validation of types** » (types désactivés) |
| `next start` + `GET /` | HTTP 200, 34 390 octets |
| `GET /parametres`, `/applications`, `/explorateur` | **404** (confirmé) |
| Export statique (test hors dépôt, `output: "export"`) | **Succès**, 865 Ko → portable dans Tauri en l'état |

---

## 4. Fonctionnalités simulées

Tout le contenu métier est **fictif**. Détail écran par écran, avec la source exacte de chaque chiffre affiché.

### 4.1 Tableau de bord (`pc-master.tsx` L64-71)

| Élément | Source réelle |
|---|---|
| « 3 disques détectés » | chaîne **codée en dur** L66 |
| « 1,32 To disponibles / 3,21 To » | chaîne codée en dur L66 (correspond par coïncidence aux données : 1 357 Go et 3 292 Go, divisés par 1024) |
| « 124 806 fichiers inventoriés » | **codé en dur** L66 — aucun fichier n'est compté nulle part |
| « 42 applications installées » | **codé en dur** L66 — la table en contient **9** |
| Barres d'occupation des disques | données de `demo.ts` (seul endroit réellement calculé : `d.used/d.total*100`) |
| Camembert « 2,1 To utilisés » | dégradé CSS figé (`globals.css` L24) + libellé codé en dur L68 |
| « Activité récente » | 3 premières lignes de `history` ; les colonnes de temps sont **choisies par index** (`i===0 ? "Il y a 2 h" : …` L69), pas par date |
| « État général du système » | texte statique, bouton → modale |

### 4.2 Explorateur de fichiers (L74-76)

- 7 éléments figés ; **aucune lecture du disque**.
- Les 3 premières lignes sont **toujours** affichées comme des dossiers : `i<3` (L75). Le type réel de la donnée n'est pas utilisé.
- Fil d'Ariane **figé** : `C:` (ou disque sélectionné) → `Utilisateurs` → `Alexandre`, quelle que soit la sélection ; il n'existe aucun modèle de chemin.
- Boutons Précédent / Suivant / Dossier parent : **aucun gestionnaire** (L75).
- Boutons Ouvrir / Copier / Déplacer / Renommer / Supprimer : ouvrent tous la **même** modale (L75 → L58).
- Accès rapides (Bureau, Téléchargements, Documents, Images) : **aucun gestionnaire** (L75).
- Tri des colonnes : `onClick={() => {}}` (L75) + flèche décorative.
- Panneau Propriétés : icône `FolderOpen` **fixe**, « Disponibilité : Inventorié » constant, taille « — » pour les dossiers.

### 4.3 Inventaire des disques (L77)

Cartes générées depuis `demo.ts` (seule vraie donnée calculée : pourcentages). Tous les boutons (« Analyser », « Choisir un dossier », « Historique », « Analyser un disque ») → modale.

### 4.4 Analyse de l'espace (L78-79)

- 7 catégories avec tailles et pourcentages **codés en dur** ; anneau CSS figé (`globals.css` L24).
- « Dossier le plus volumineux : Vidéos · 512 Go », « 248 fichiers > 500 Mo » : **chaînes statiques**.
- Deux classements (4 lignes chacun) entièrement statiques.
- « Détection des doublons » : bouton « Configurer » → modale. Aucun algorithme.

### 4.5 Applications installées (L80)

- 9 lignes issues de `demo.ts` ; recherche réelle sur ces 9 lignes ; compteur dynamique.
- En-têtes de colonnes avec icône `ChevronsUpDown` : **aucun tri**.
- Pagination : « 1 » figé, boutons précédent/suivant **sans gestionnaire**.
- « Actualiser l'inventaire », « Informations », « Désinstaller » → modale.

### 4.6 Désinstallation avancée (L81)

- Le choix du mode (Standard / Avancé / Approfondi) est réel, **mais il ne change rien** : seul le titre de la modale et le libellé du bouton changent.
- Le tableau des résidus est **toujours celui d'Adobe Photoshop**, quel que soit le mode ou l'application. Aucune étape de sélection d'application n'existe.
- La confiance est un texte dans les données (`data/demo.ts` L29-34) ; la règle de non-suppression est un simple test de chaîne : `disabled={r.confidence === "Système"}` (L81). Aucune analyse de partage réel.
- « Nettoyer les éléments sélectionnés » → modale ; rien n'est supprimé (comportement correct pour une démonstration).

### 4.7 Surveillance des installations (L82)

Un booléen `monitoring` fait passer des étapes de « À venir » à « En attente/En cours ». Aucun instantané, aucun différentiel, aucun accès fichier/registre. L'écran le dit lui-même : « La surveillance réelle du système n'est pas implémentée » (bandeau, L82).

### 4.8 Historique et rapports (L83)

- 4 opérations fictives ; le filtre par onglet fonctionne sur ces 4 lignes.
- Compteurs statiques : « 12 inventaires », « 8 désinstallations », « 5 surveillances », « 24 rapports », badge « Tous 24 » — alors que 4 lignes existent.
- « Exporter », « Détails », « Comparer deux inventaires » → modale.

### 4.9 Paramètres (L84)

| Réglage | Réalité |
|---|---|
| Thème clair/sombre | **Fonctionne** (partiellement, §6 B10) |
| Thème « Système » | Notifie « sera disponible avec le moteur Windows » |
| Interrupteurs (3) | Modifient la classe CSS du bouton via `classList.toggle` — **hors React** ; `aria-checked` figé ; réinitialisés au démontage |
| Langue | `select` **sans gestionnaire** |
| Conservation de l'historique | `select` **sans gestionnaire** |
| « Choisir un dossier » | Simple notification |
| Navigation interne (6 entrées) | Seule « Apparence » défile ; les 5 autres affichent un toast ; l'entrée active reste figée sur « Apparence » |

### 4.10 Coque et éléments permanents (L49-58)

- **Recherche globale** : réellement liée à l'état `query`… partagé avec l'écran Applications (B1).
- **`⌘ K`** : affiché dans le champ (L56) mais **aucun raccourci clavier** n'existe (0 gestionnaire `onKeyDown` dans tout le fichier).
- **Notifications** : pastille orange permanente ; clic → « Aucune nouvelle notification ».
- **Avatar AL / « Alexandre Laurent / Administrateur »** : statique.
- **« Moteur système — Non connecté »** (L54) : statique, honnête.
- **Bouton de repli de la barre latérale** (L51) : notifie « prêt à être réduit dans l'application Windows », ne réduit rien.
- **Modale unique** (L58) : *toutes* les actions de l'application ouvrent la même fenêtre au texte identique. C'est le point le plus révélateur : **il n'existe qu'un seul parcours d'action dans toute l'application, et il ne fait rien**.

---

## 5. Fonctionnalités absentes

Liste de ce qui n'existe **nulle part** dans le code (aucune ligne, aucun fichier, aucune dépendance).

### 5.1 Priorité 1

1. Énumération des volumes (`GetLogicalDrives`, `GetDiskFreeSpaceEx`, type de média, système de fichiers, numéro de série, point de montage).
2. Parcours réel de l'arborescence (streaming, profondeur, erreurs d'accès, liens/reparse points, fichiers système).
3. Indexation et persistance des métadonnées (nom, chemin, taille, dates, attributs, hash).
4. Recherche performante (SQL `LIKE`/FTS5, filtres par taille/date/extension/attributs).
5. Top-N des fichiers et dossiers volumineux, cartographie de l'espace (treemap / sunburst réels).
6. **Inventaires datés multiples** : notion d'instantané, identifiant, date, périmètre, statut.
7. **Comparaison de deux inventaires** : apparitions, disparitions, changements de taille/date, synthèse.
8. Analyse de l'espace réel par catégorie (extension, type MIME, dossier).
9. Détection de doublons (au moins par taille + hash partiel).
10. Export des inventaires (CSV/JSON/PDF).

### 5.2 Priorité 2

11. Inventaire réel des applications : clés `HKLM/HKCU\…\Uninstall` (vues 32 et 64 bits), `MSI` (`MsiEnumProductsW`), MSIX/Store, éditeur, version, date, taille estimée, icône, langue.
12. Lancement de la désinstallation officielle : `MsiExec /X{GUID}`, `QuietUninstallString`/`UninstallString` **validés**, affichage de la commande, exécution avec suivi du code de retour.
13. Détection du type d'installeur (MSI, NSIS, Inno, InstallShield, MSIX, portable) et de son désinstalleur.
14. Scan de résidus multi-sources : fichiers/dossiers, clés et valeurs de registre, services, tâches planifiées, raccourcis, règles de pare-feu, entrées de démarrage.
15. **Score de confiance explicable** (règles, raisons affichées, seuils), au lieu d'un libellé figé.
16. Classification **personnel / partagé / système** fondée sur des règles et des listes de protection, pas sur un texte.
17. **Quarantaine** (déplacement réversible), sauvegarde du registre (`.reg`), journal d'audit, **restauration**.
18. Mode simulation obligatoire (dry-run) avec rapport avant action.
19. Élévation UAC, détection des droits, refus explicite si insuffisants.
20. Surveillance réelle des installations (instantané avant/après, différentiel fichiers + registre + services + tâches).
21. Rapports persistés (base locale + fichiers), conservation/rétention paramétrable, export.
22. Journal global horodaté de toutes les actions (qui/quoi/quand/résultat/annulation possible).
23. Paramètres réellement persistés (thème, exclusions, confirmations, rétention, dossier de rapports).
24. Internationalisation réelle (chaînes extraites, FR/EN).

### 5.3 Socle

25. Tauri 2 (`src-tauri/`, `tauri.conf.json`, `capabilities/`), commandes Rust, IPC typé.
26. SQLite + migrations, couche d'accès aux données.
27. Séparation domaine / infrastructure / UI, types métier partagés.
28. Gestion d'erreurs (composants `error.tsx`, `try/catch` Rust → erreurs typées), journalisation.
29. Tests (unitaires, intégration, E2E), lint, CI, README, licence, versionnement sémantique.
30. Packaging Windows (`.ico`, MSI/WiX ou NSIS), signature de code, mises à jour, WebView2.

---

## 6. Bugs et problèmes techniques

Sévérité : **S1** bloquant/produit · **S2** fonctionnel visible · **S3** qualité/dette.

| # | Sév. | Problème | Preuve | Conséquence |
|---|---|---|---|---|
| **B1** | S2 | **Recherche globale et recherche d'applications partagent le même état** | `query` L19 ; `filteredFiles` L34 ; `filteredApps` L33 ; saisie dans la table L80 | Taper dans « Rechercher une application » filtre aussi l'explorateur ; la requête persiste en changeant d'écran. Deux champs distincts pour un seul état. |
| **B2** | S2 | **Icônes de dossier déterminées par la position** | `i<3 ? <Folder/> : …` L75 (deux occurrences) | Après filtrage, un `.mp4` devient « dossier » (icône + style). Incohérence visuelle immédiate. |
| **B3** | S2 | **Filtres de type incomplets** | `select` 4 options L75 ; `a.type.includes(filter)` L34 | « Document » masque les dossiers ; « Présentation » n'a aucune option ; « Dossier de fichiers » non filtrable. |
| **B4** | S2 | **Panneau Propriétés non représentatif** | L75 : `FolderOpen` fixe, « Disponibilité : Inventorié » | Un PDF s'affiche avec une icône de dossier ; l'utilisateur ne peut pas distinguer fichier/dossier. |
| **B5** | S2 | **Boutons sans effet** | 8 balises `<button>` sans `onClick` en source — dont une mappée sur 4 éléments (L75) → **11 instances** : Précédent, Suivant, Dossier parent, Options d'affichage, 4 accès rapides, Page précédente, Page suivante, « Plus d'options » (L68) | Zones cliquables inertes ; illusion d'interactivité. |
| **B6** | S2 | **Tri absent alors qu'il est suggéré** | `sort`/`setSort` déclarés L27 et **jamais utilisés** ; `th onClick={()=>{}}` L75 ; `ChevronsUpDown` L80 | L'utilisateur clique, rien ne se passe. Fonction essentielle à un inventaire. |
| **B7** | S2 | **Pagination factice** | L80 : numéro « 1 » littéral, boutons inertes | Aucune gestion de volume (or un inventaire réel compte des centaines de milliers de lignes). |
| **B8** | S2 | **Interrupteurs de paramètres hors React** | L84 : `onClick={e=>e.currentTarget.classList.toggle("on")}` ; `aria-checked={i!==0}` | État perdu au changement d'écran ; annoncé faux aux lecteurs d'écran ; impossible à persister. |
| **B9** | S2 | **Navigation des paramètres inerte** | L84 : `className={i===0?"active":""}`, seules les 5 autres entrées notifient | L'utilisateur croit avoir changé de section ; aucune section n'existe en dessous. |
| **B10** | S2 | **Thème clair incomplet** | `globals.css` L15 (variables) vs **65 sélecteurs** à fond codé en dur non couverts : `.demo-banner` L20, `.welcome-strip` L23, `.metric-icon.*` L23, `.toast-message` L33, `.modal-icon`/`.modal-demo-note` L34, `.comparison-callout`, `.potential-tag`, `.recommended`… | En mode clair, des blocs restent sombres (bandeaux, tuiles, toasts, badges) : rendu visiblement cassé. Thème non persisté (rechargement = sombre). |
| **B11** | S2 | **Chiffres incohérents entre écrans** | « 42 applications » L66 vs **9** lignes L80 ; « 124 806 fichiers » L66 vs « 1 284 éléments » L83 ; « 1,32 To » L66 (base 1024) vs « 2,1 To » L68 et « 2,16 To » L78 (base 1000) vs **1,89 To réellement utilisés** (calcul : 1 935 Go) ; badge « 3 » L53 vs **2** résidus sélectionnés L23 ; « 24 » rapports L83 vs 4 lignes | Crédibilité détruite dès qu'un utilisateur vérifie. Une même grandeur a trois valeurs et deux bases de conversion. |
| **B12** | S3 | **Dates d'activité déduites de l'index** | L69 : `i===0?"Il y a 2 h":i===1?"Hier":…` alors que `history[i].date` existe | Faux dès que les données changent ; tri chronologique impossible. |
| **B13** | S3 | **Toasts non nettoyés / races** | L31 : `window.setTimeout` sans `clearTimeout`, ni nettoyage au démontage | Un toast ancien peut effacer un toast récent ; `setState` après démontage. |
| **B14** | S3 | **Modale unique pour toutes les actions** | L58 : titre = nom de l'action, corps identique | Aucun parcours métier ; « Annuler » et « Compris » ont le même effet ; pas de fermeture par `Échap`, pas de piège de focus (`aria-modal` sans gestion du focus). |
| **B15** | S2 | **Aucune persistance** | 16 `useState`, 0 `localStorage`/SQLite | Tout est perdu au rechargement (thème, mode, sélections, onglet, surveillance). |
| **B16** | S2 | **Accessibilité** | 2 `<tr onClick>` non focusables ; 1 `<th onClick>` sans clavier ; 0 `onKeyDown` ; texte **≤ 10 px** (116 déclarations, dont 89 ≤ 9 px) ; `--subtle #637186` sur `#111925` = **3,56:1** (sous le seuil 4,5:1) | Inutilisable au clavier, illisible pour beaucoup d'utilisateurs ; problème sérieux pour un outil d'administration. |
| **B17** | S3 | **Code mort / dette** | `SectionToolbar` L73 (jamais rendu, `onChange={()=>{}}`) ; `EyeIcon` L13 (duplique `Activity`, choisi pour « Surveillance ») ; icônes `Clock3`, `Disc3`, `Home` importées non utilisées (L4) ; `components/ui/button.tsx`, `lib/utils.ts`, 4 images `placeholder` jamais utilisés ; `any` ×5 | Confusion sur l'intention, poids inutile, maintenance risquée. |
| **B18** | S1 | **Validation TypeScript désactivée au build** | `next.config.mjs` L3-5 : `typescript: { ignoreBuildErrors: true }` ; sortie observée : « Skipping validation of types » | Une erreur de type peut partir en production. Pour une application qui **supprime des fichiers**, c'est inacceptable. |
| **B19** | S2 | **Télémétrie réseau en production** | `app/layout.tsx` L1 et L42 : `{process.env.NODE_ENV === 'production' && <Analytics />}` | Contredit l'exigence « hors ligne, sans serveur distant ». Émet des requêtes vers Vercel dans l'exécutable packagé. À retirer impérativement. |
| **B20** | S3 | **Lignes de 1 000 à 6 000 caractères** | `pc-master.tsx` L66, L75, L78, L81, L84 | Revue impossible, diffs illisibles, conflits Git systématiques. |
| **B21** | S2 | **Aucune gestion d'erreur ni journal** | 0 `try/catch`, 0 `error.tsx`, 0 `loading.tsx`, 0 log | Pour un outil système, l'absence de gestion d'échec partiel est un défaut de conception majeur. |
| **B22** | S3 | **Outillage incohérent** | Tailwind v4 + shadcn + base-ui installés, **non utilisés** ; `shadcn` en `dependencies` (`package.json` L13) | Dépendances inutiles dans le bundle final, choix techniques brouillés. |
| **B23** | S3 | **Config de workspace douteuse** | `pnpm-workspace.yaml` : `pmOnFail: ignore` (clé non documentée) ; `minimumReleaseAgeExclude` sans `minimumReleaseAge` | Sans effet probable ; à nettoyer. |
| **B24** | S3 | **Identité produit incohérente** | `package.json` : `name: "my-project"`, `version: 0.1.0` ; UI : « v0.9.4 » (L56, L84) ; `layout.tsx` L8 : `generator: 'v0.app'` | Traçabilité et support impossibles ; métadonnée de générateur à supprimer. |
| **B25** | S2 | **Aucune route, aucun lien profond** | L17 + `switch` L36-48 ; 404 vérifiés sur `/parametres` | Le bouton « retour » du navigateur quitte l'application ; impossible d'ouvrir directement un écran ; pour Tauri, un vrai routeur sera nécessaire. |
| **B26** | S3 | **Icônes inadaptées à Windows** | `public/` : PNG 32×32 et SVG, **aucun `.ico`** | Tauri/Windows exige un `.ico` multi-résolutions (16→256 px). |
| **B27** | S3 | **Écran de résidus affiché comme un résultat** | L81 : titre « ÉTAPE 2 · EXEMPLE DE RÉSULTATS » alors qu'aucune étape 1 n'existe | Confusion sur le parcours réel prévu. |
| **B28** | S3 | **`useMemo` inutiles / état mal placé** | L33-L35 recalculés à chaque frappe sur 9 éléments ; `monitoring` (L30) et `mode` (L22) remontés au parent faute de store | Complexité sans bénéfice, prop drilling. |

**Bugs mineurs supplémentaires** : le nom de fichier du titre de la modale peut être très long et déborder (`Rapport : …`) ; `.demo-banner` est en `white-space:nowrap` avec une police de 8 px (illisible en 320 px) ; le bandeau `.mobile-demo` n'apparaît qu'en dessous de 800 px alors que les mentions de démo devraient être permanentes.

---

## 7. Qualité et cohérence de l'interface

### 7.1 Points forts (réels)

1. **Identité visuelle cohérente** : palette bleu/cyan, cartes à 8 px de rayon, bordures fines, ombres discrètes, iconographie lucide homogène.
2. **Couverture fonctionnelle de la maquette** : 9 écrans, tous pourvus d'un contenu dense et plausible — bien au-delà d'une page d'accueil.
3. **Honnêteté de la démonstration** : bannière « ENVIRONNEMENT DE DÉMO » (L52), bandeau mobile (L56), badges « DONNÉES DE DÉMO » (L63), bandeaux bleus explicatifs dans chaque écran, pied de page « Aucune donnée réelle n'est modifiée » (L56). C'est une **excellente pratique** à conserver.
4. **États d'interface soignés** : survol, sélection, `disabled`, pilules d'état, légendes de confiance, cartes de mode avec recommandation.
5. **Vocabulaire métier crédible** : « instantané », « état de référence », « changement observé / association supposée », « éléments partagés ou système toujours exclus » — le modèle fonctionnel est pensé, même s'il n'est pas codé.
6. **Responsive réel** : trois paliers avec réorganisation sérieuse (grilles, sidebar compacte, tableaux défilants).
7. **Structure sémantique correcte** : `aside`, `nav[aria-label]`, `main`, `header`, `footer`, `role="tablist"`, `aria-selected`, `aria-modal`.

### 7.2 Points faibles

1. **Lisibilité sacrifiée à la densité** : 116 déclarations de police ≤ 10 px, dont 89 ≤ 9 px et une à 7 px ; à 100 % de zoom, les libellés secondaires sont difficilement lisibles. Pour un outil d'administration utilisé des heures, c'est un défaut d'ergonomie important (recommandation : plancher à 11-12 px pour le secondaire, 13-14 px pour le corps).
2. **Contraste insuffisant sur le texte tertiaire** : `--subtle` (#637186) sur `--surface` (#111925) = **3,56:1**, utilisé précisément sur les libellés de 8 px (pire cas). Le texte principal (15:1) et le texte `--muted` (5,8:1) sont corrects.
3. **Thème clair cassé** (B10) : inutilisable en l'état, ce qui est visible dès le premier clic dans Paramètres.
4. **Incohérences chiffrées** (B11) : trois totaux d'espace utilisés, deux bases de conversion Go→To, « 42 » vs 9 applications. Un utilisateur attentif perd immédiatement confiance.
5. **Hiérarchie visuelle écrasée** : titres de panneaux à 12 px, sous-titres à 10 px, valeurs à 9 px — presque tout est au même niveau ; le regard ne sait pas où se poser.
6. **Mélange démo/réel dans le parcours** : l'écran de désinstallation affiche d'emblée les résidus de Photoshop sans qu'une application ait été choisie (B27). Le parcours attendu (choisir → analyser → examiner → nettoyer) n'est pas reflété.
7. **Absence d'états système** : aucun chargement, aucun squelette, aucun état vide (« aucun résidu trouvé »), aucune erreur, aucun état « annulé ». Or ce sont les états dominants d'un outil qui parcourt des millions de fichiers.
8. **Faux affordances** : 11 boutons inertes, tri suggéré sans tri, pagination factice, `⌘ K` annoncé sans raccourci, pastille de notification sans notification (B5-B8).
9. **Pas de parcours de confirmation crédible** : la modale unique ne montre ni la liste de ce qui sera supprimé, ni l'estimation d'espace, ni le bouton « Simuler » / « Créer une sauvegarde ».
10. **Accessibilité clavier quasi inexistante** : lignes de tableau cliquables non focusables, pas d'`Échap`, pas de piège de focus, pas de lien d'évitement (B16).

**Synthèse UI** : très bon niveau de *design de surface*, niveau insuffisant de *design d'interaction* et d'*accessibilité*. La maquette est un excellent brief visuel ; elle n'est pas un produit.

---

## 8. Compatibilité avec Tauri 2 + Rust + SQLite

### 8.1 Verdict

| Aspect | État | Commentaire |
|---|---|---|
| Code React/TS portable | **Bon** | Aucune API Node, aucun `fetch`, aucun accès à `window` au rendu (uniquement dans des gestionnaires) ; icônes et polices locales |
| Feuille de style portable | **Bon** | CSS standard ; Tailwind v4 fonctionne sous Vite (`@tailwindcss/vite`) |
| Export statique | **Vérifié** | `output: "export"` testé hors dépôt : build OK, 865 Ko — l'UI peut être embarquée **telle quelle** dans Tauri |
| Échafaudage Next.js | **Inadapté** | `next start` exige un serveur Node ; App Router/SSR/Turbopack n'apportent rien à une app de bureau mono-utilisateur |
| Dépendance réseau | **Bloquante** | `@vercel/analytics` (L1/L42) doit être retiré |
| Socle Tauri/Rust/SQLite | **Absent à 100 %** | Rien à migrer : tout est à créer |
| Architecture applicative | **Inadaptée** | Monolithe, état global dans un composant, aucune frontière domaine/infra |

**Conclusion** : le front peut être conservé ; le socle est à construire. Ce n'est **pas** une migration, c'est une **reconstruction autour du design existant**. C'est une bonne nouvelle : il n'y a aucune dette côté Rust.

### 8.2 Deux options d'échafaudage

| Critère | **A. Vite + React + TS (recommandé)** | **B. Conserver Next en export statique** |
|---|---|---|
| Poids / démarrage | Léger, rapide | Plus lourd (runtime Next) |
| Routage | React Router (URL internes, historique) | À réimplémenter côté client |
| Cohérence Tauri | Standard de la communauté | Cas marginal, peu documenté |
| Coût de bascule | Reprise de `globals.css` + JSX (mécanique, 1-2 j) | Nul au départ, dette durable |
| Risque | Faible | Moyen (mises à jour Next/Turbopack) |

Recommandation : **option A**, en conservant `globals.css`, les composants visuels et `data/demo.ts` comme jeu de démonstration derrière une interface de service.

### 8.3 Architecture cible proposée

```
src/                     # UI React (Vite)
  app/                   # routeur, layout, thème
  features/dashboard | explorer | inventory | apps | uninstall | monitor | reports | settings
  domain/                # types métier + règles (aucune dépendance UI)
  services/              # SystemService (interface) → TauriSystemService | MockSystemService
  lib/                   # formatage, unités, i18n
src-tauri/
  src/main.rs            # builder, plugins, single-instance
  src/commands/          # volumes.rs, inventory.rs, apps.rs, residues.rs, uninstall.rs, monitor.rs, reports.rs
  src/db/                # connexion, migrations SQL, requêtes
  src/win/               # volumes, fs, registry, msi, process, tasks, elevation
  capabilities/          # permissions minimales
  tauri.conf.json        # bundle Windows, .ico, signature
```

Points techniques à prévoir :

- **IPC typé** : `tauri-specta` (génération des types TS depuis Rust) pour éviter les désynchronisations.
- **Progression et annulation** : événements `scan://progress` + `AtomicBool` d'annulation ; jamais de scan bloquant le thread UI.
- **SQLite** : `tauri-plugin-sql` (rapide à mettre en place) ou `rusqlite` (contrôle total, recommandé pour les insertions massives). Migrations versionnées, mode WAL, transactions par lots de 5 000-10 000 lignes.
- **APIs Windows** (`windows` crate) : `GetLogicalDrives`/`GetDiskFreeSpaceEx`, `FindFirstFileExW`/`NtQueryDirectoryFile`, `RegEnumKeyExW` (vues `KEY_WOW64_32KEY`/`64KEY`), `MsiEnumProductsW`/`MsiGetProductInfoW`, `CreateToolhelp32Snapshot`, Task Scheduler COM.
- **Performance** : pour plusieurs millions de fichiers, privilégier le **journal USN** ou l'énumération MFT plutôt qu'un parcours récursif naïf ; sinon, au minimum `FindFirstFileExW` + pool de threads + écriture asynchrone.
- **Élévation** : `ShellExecuteW` avec `runas` ou processus helper ; détecter `IsUserAnAdmin` et **refuser proprement** les actions qui l'exigent.
- **Sécurité** : liste de chemins protégés (`%WINDIR%`, `Program Files\Common Files`, `WinSxS`, profils autres), résolution des jonctions/reparse points, refus de suivre les liens symboliques lors des suppressions, validation des lignes de commande de désinstallation.
- **Restauration** : quarantaine sur le même volume (déplacement atomique) + export `.reg` + table `quarantine` en base.
- **Packaging** : `.ico` multi-taille, installeur MSI (WiX) ou NSIS, signature Authenticode, SmartScreen, mises à jour Tauri (clé de signature), WebView2 (runtime Evergreen sur Windows 10/11).

### 8.4 Ce qu'il faudra supprimer ou remplacer

| À retirer | Raison |
|---|---|
| `@vercel/analytics` (layout L1, L42) | Télémétrie réseau, incompatible hors ligne |
| `generator: 'v0.app'` (layout L8) | Métadonnée de générateur |
| `shadcn` en `dependencies` | Outil de génération, pas une dépendance d'exécution |
| `typescript.ignoreBuildErrors` | Sécurité de compilation |
| Next.js (selon option A) | Serveur inutile |
| `any` (5 occurrences) | Typage des entités métier |
| Tailles en chaînes (« 2,84 Go ») | Remplacer par des octets (`u64`) + formatage à l'affichage |

---

## 9. Risques techniques

| # | Risque | Probabilité | Impact | Mitigation indispensable |
|---|---|---|---|---|
| R1 | **Suppression accidentelle de données personnelles** lors du nettoyage des résidus | Élevée sans garde-fous | **Critique** | Quarantaine obligatoire, aperçu exhaustif, confirmation explicite, journal, restauration testée |
| R2 | **Faux positifs** : résidus « partagés » (VC++ Redistributable, .NET, Adobe Common, polices) proposés à la suppression | Élevée | **Critique** | Listes blanches, détection d'usage partagé (autres apps dépendantes), score explicable, exclusion par défaut de tout élément non exclusivement attribuable |
| R3 | **Exécution de commandes arbitraires** via `UninstallString`/`QuietUninstallString` (chaîne lue dans le registre, souvent modifiable par un utilisateur non administrateur) | Moyenne | **Critique** | Ne jamais exécuter aveuglément : privilégier `MsiExec /X{ProductCode}`, afficher la commande, vérifier la signature/le chemin, refuser les interpréteurs (`cmd /c`, PowerShell) sans confirmation renforcée |
| R4 | **Suppression hors cible** via jonctions/reparse points ou chemins relatifs (`AppData\Local\…` redirigé) | Moyenne | **Critique** | Canonicalisation, refus des liens symboliques, vérification que le chemin résolu reste sous le volume attendu, chemins protégés bloqués |
| R5 | **Élévation UAC** : refus, annulation, ou exécution partielle sans rollback | Élevée | Élevé | Vérification des droits en amont, découpage en actions atomiques, journal de reprise, message clair |
| R6 | **Performance/échelle** : inventaire de millions de fichiers (temps, mémoire, I/O), UI figée | Élevée | Élevé | Streaming + index SQLite, progression, annulation, reprise, tests sur 1 M+ entrées, USN/MFT |
| R7 | **Fichiers verrouillés / en cours d'utilisation** → échec partiel | Élevée | Moyen | Rapport par élément, marquage « nécessite un redémarrage », jamais de suppression forcée silencieuse |
| R8 | **Registre 32/64 bits** (`WOW6432Node`), `HKCU` vs `HKLM`, droits d'écriture | Moyenne | Élevé | Lire les deux vues, fusionner, indiquer la portée de chaque clé |
| R9 | **Conformité et vie privée** : journaux contenant chemins et noms de fichiers, télémétrie | Moyenne | Élevé | Aucune télémétrie, journaux locaux chiffrables, purge paramétrable, information utilisateur |
| R10 | **Chaîne de qualité absente** (0 test, types ignorés) sur un logiciel destructif | Élevée | **Critique** | Tests unitaires du domaine, tests d'intégration sur VM Windows, tests E2E, CI obligatoire, réactivation du typage strict |
| R11 | **Dette du monolithe** : chaque écran ajouté augmente le coût de découpage | Certaine | Moyen | Découper maintenant, avant d'ajouter des fonctionnalités |
| R12 | **Dérive des libellés de démonstration** : confusion entre démo et réel une fois le moteur branché | Moyenne | Moyen | Retirer les libellés « démo » dès qu'un écran est réel, écran par écran (indicateur par capacité) |
| R13 | **Écosystème** : Next 16/Turbopack + React 19 dans un contexte Tauri | Moyenne | Moyen | Option A (Vite) ; épingler les versions |
| R14 | **Distribution** : SmartScreen/antivirus signalent un installeur non signé manipulant le registre et supprimant des fichiers | Élevée | Élevé | Signature de code, réputation, documentation, bêta fermée |
| R15 | **Attentes utilisateur** : l'UI promet « niveaux de confiance » et « sauvegardes » ; les livrer réellement ou retirer la promesse | Moyenne | Moyen | Ne rien afficher qui ne soit implémenté |

---

## 10. Plan de développement recommandé

Principe directeur : **ne pas migrer la maquette, mais construire le socle autour d'elle**, en gardant le design (`globals.css`, structure des écrans) et en introduisant dès le départ une **couche de service** avec deux implémentations (réelle Tauri / simulée) — ainsi l'UI reste démontrable à tout moment.

### Phase 0 — Hygiène et décisions (1-2 jours)

- Trancher : **Vite + React** (recommandé) ; périmètre Windows 10/11 x64.
- Retirer `@vercel/analytics`, `generator`, `shadcn` des dépendances d'exécution, `ignoreBuildErrors`.
- Découper `pc-master.tsx` en `features/` (un fichier par écran), extraire les composants (`Metric`, `Panel`, `DataTable`, `Modal`, `Toast`).
- Introduire les **types métier** (`Volume`, `FileEntry`, `InstalledApp`, `Residue`, `Snapshot`, `Report`) en octets/ISO 8601.
- Ajouter ESLint + Prettier + Vitest + React Testing Library, CI GitHub Actions, README, licence, version 0.1.0.
- **Critères d'acceptation** : aucun fichier > 300 lignes ; 0 `any` ; build avec typage strict ; CI verte ; rendu identique à la maquette.

### Phase 1 — Socle Tauri 2 + SQLite (2-3 jours)

- `pnpm create tauri-app` (React-TS) puis réintégration du CSS/écrans.
- `src-tauri` : `tauri.conf.json`, `.ico`, fenêtre unique, single-instance, menu système.
- SQLite + migrations (`schema_version`) ; commandes `db_health`, `app_info`.
- IPC typé (`tauri-specta`), gestion d'erreurs typée, `MockSystemService` branché par défaut.
- Persistance des paramètres (thème, confirmations, exclusions, rétention) et du journal.
- **Critères** : application Windows installable, thème persistant après redémarrage, mode démo/réel sélectionnable.

### Phase 2 — Volumes réels (2-3 jours)

- Rust : `GetLogicalDrives`, `GetDiskFreeSpaceExW`, type de média, système de fichiers, point de montage, numéro de série, espace total/libre.
- UI : remplacer les 3 disques fictifs, états de chargement/erreur, rafraîchissement.
- **Critères** : disques réels affichés, cohérents avec l'Explorateur Windows, aucune donnée codée en dur.

### Phase 3 — Explorateur et index (5-7 jours)

- Rust : parcours `FindFirstFileExW` (ou MFT/USN), pool de threads, gestion des accès refusés, reparse points, progression + annulation.
- SQLite : `snapshots`, `entries` (chemin, nom, parent, type, taille, dates, attributs), index sur `name`, `size`, `parent`.
- UI : arborescence réelle, fil d'Ariane réelle, tri serveur, filtres (type, taille, date, attributs), recherche SQL, top-N des gros fichiers/dossiers.
- **Critères** : 200 000 fichiers indexés < 60 s sur SSD ; recherche < 300 ms ; mémoire stable ; annulation effective.

### Phase 4 — Inventaires datés et comparaison (3-4 jours)

- Modèle d'instantané (périmètre, date, durée, nombre d'entrées, statut), liste, renommage, suppression.
- Comparateur (`+`/`−`/taille modifiée/date modifiée), synthèse chiffrée, export CSV/JSON.
- **Critères** : deux inventaires comparables, écarts exacts, export vérifiable.

### Phase 5 — Applications installées et désinstallation standard (5-7 jours)

- Rust : `HKLM/HKCU\…\Uninstall` (2 vues), `MsiEnumProductsW`, MSIX/Store, nom, éditeur, version, date, taille estimée, icône, type d'installeur, `UninstallString`/`QuietUninstallString`, `ProductCode`.
- UI : tableau réel triable/paginé, recherche, fiche détaillée (dont la commande de désinstallation affichée).
- Désinstallation : `MsiExec /X` prioritaire, sinon commande validée + confirmation renforcée, suivi du code de retour, journal.
- **Critères** : liste identique à « Applications et fonctionnalités » de Windows (± écart expliqué) ; désinstallation réelle journalisée ; refus explicite des commandes non sûres.

### Phase 6 — Détection des résidus (7-10 jours)

- Sources : fichiers/dossiers (noms d'éditeur/app, `%APPDATA%`, `%LOCALAPPDATA%`, `%PROGRAMDATA%`, `Program Files`, `Temp`), registre (`HKCU/HKLM\Software`, `Uninstall`, services), services, tâches planifiées, raccourcis, démarrage.
- **Moteur de score** : règles pondérées (nom exact, nom d'éditeur, contenu des clés `InstallLocation`/`DisplayIcon`, date, autres applications liées) → confiance **Élevée/Probable/Incertaine** + **raisons affichées**.
- Classification **personnel / partagé / système** avec listes de protection (`WinSxS`, `Program Files\Common Files`, `Microsoft\Windows`, `VC++`, `.NET`, `Windows Defender`, pilotes…).
- UI : revue par élément, filtres, estimation d'espace, sélection multiple.
- **Critères** : jeu de test de 20 désinstallations réelles sur VM ; **0 proposition d'élément système** ; taux de faux positifs documenté.

### Phase 7 — Nettoyage contrôlé, sauvegarde, restauration (5-7 jours)

- Quarantaine (déplacement réversible), export `.reg` préalable, journal d'audit horodaté.
- Écran de confirmation final : liste exacte, espace récupéré, « Simuler », « Créer une sauvegarde ».
- Restauration (fichiers + registre), vérification d'intégrité, gestion des éléments non restaurés.
- **Critères** : cycle complet testé (nettoyage → restauration → état identique), 100 % des actions journalisées, **aucune suppression directe possible**.

### Phase 8 — Surveillance des installations (4-6 jours)

- Instantané avant/après (fichiers + registre + services + tâches + démarrage), différentiel, distinction **observé / supposé**, rapport consultable et exportable.
- **Critères** : installation MSI réelle détectée avec écart < 5 % sur les fichiers créés ; rapport lisible.

### Phase 9 — Rapports, conservation, finitions (4-5 jours)

- Rapports persistés (base + HTML/PDF/CSV), rétention paramétrable, purge, recherche dans l'historique.
- i18n FR/EN, thème clair **complet** (remplacer les 65 fonds codés en dur par des variables), accessibilité (tailles ≥ 11 px, contrastes ≥ 4,5:1, navigation clavier, focus visible, `Échap`).
- **Critères** : audit d'accessibilité sans erreur bloquante ; thème clair validé écran par écran.

### Phase 10 — Durcissement et distribution (5-7 jours)

- Typage strict partout, tests E2E (Playwright + WebDriver Tauri), tests de performance 1 M+ fichiers, tests de reprise après crash.
- Installeur MSI/WiX, `.ico`, signature Authenticode, mises à jour signées, télémétrie **désactivée**, mentions légales.
- Bêta fermée, collecte de rapports d'erreur **locaux** uniquement.
- **Critères** : installation propre sur Windows 10/11 vierges, absence d'alerte SmartScreen (après réputation), désinstallation propre.

**Ordre de grandeur total** : ~45-60 jours-homme pour un socle réellement utilisable (Phases 0-7), ~20 jours supplémentaires pour la surveillance, les rapports et le durcissement.

### Décisions à prendre avant la Phase 1

1. **Échafaudage** : Vite (recommandé) ou Next en export statique ?
2. **Cible** : Windows 10 + 11, x64 uniquement ? (impacte les APIs et le packaging)
3. **Élévation** : application toujours lancée en administrateur, ou helper élevé à la demande ? (impacte l'UX et la sécurité)
4. **Suppression** : corbeille, quarantaine interne, ou les deux ? (je recommande la quarantaine interne, avec restauration en un clic)
5. **Périmètre des résidus** : fichiers + registre seulement au départ, puis services/tâches ? (réduit le risque R2)
6. **Mode démo** : conserver un mode « données fictives » sélectionnable dans les paramètres du produit final ?

### Ce qu'il ne faut **pas** faire

- Migration « big bang » de la maquette vers Tauri sans découpage préalable.
- Conserver Next.js et son serveur dans le paquet final.
- Implémenter d'abord le nettoyage, puis la sécurité/restauration (l'inverse est la seule option acceptable).
- Livrer un écran qui prétend détecter des résidus sans moteur de score explicable.
- Supprimer quoi que ce soit sans quarantaine ni journal.

---

## Annexe A — Preuves d'exécution

| Commande / mesure | Résultat |
|---|---|
| `git log --oneline` | 1 seul commit : `a284a01 Initial commit from v0` |
| `find` (hors `node_modules`, `.git`) | 24 fichiers |
| `pnpm install --frozen-lockfile` | Succès — `git status` vide après installation |
| `tsc --noEmit` | 0 erreur |
| `next build` | Succès ; journal : « Skipping validation of types » |
| `next start` + `GET /` | 200 · 34 390 octets |
| `GET /parametres` `/applications` `/explorateur` | 404 · 404 · 404 |
| Export statique (`output: "export"`, hors dépôt) | Succès · 865 Ko |
| Boutons dans le JSX | 62 balises · dont **8 sans `onClick`** (≈ 11 instances rendues) |
| Gestionnaires clavier (`onKeyDown`/`Escape`) | **0** |
| `<select>` | 3 · dont **1 seul** avec `onChange` |
| `aria-label` / `role=` | 26 / 5 |
| Couleurs hexadécimales (`globals.css`) | **237** |
| Sélecteurs à fond codé en dur non couverts par `.theme-light` | **65** |
| Déclarations `font-size` ≤ 10 px | **116** (dont 89 ≤ 9 px) |
| Contraste `--subtle` sur `--surface` | **3,56:1** |
| `fetch`, `localStorage`, `indexedDB`, `invoke` | **0 occurrence** |
| `tauri`, `cargo`, `rust`, `sqlite` | **0 occurrence** |
| Références « ATLAS » | **0 occurrence** |
| Tests / lint / CI / README | **0** |

## Annexe B — Index des références de code

- `components/pc-master.tsx` : L1 `"use client"` · L4 icônes · L7 type `Section` · L13 `EyeIcon` · L17-L30 états · L31 `notify` · L33-L35 filtres · L36-L48 routage · L49 thème · L51 repli · L53 navigation · L54 moteur · L56 barre supérieure · L57 toast · L58 modale · L64-L71 tableau de bord · L73 `SectionToolbar` mort · L74-L76 explorateur · L77 inventaire · L78-L79 analyse · L80 applications · L81 désinstallation · L82 surveillance · L83 historique · L84 paramètres.
- `data/demo.ts` : L1-L5 disques · L7-L17 applications · L19-L27 fichiers · L29-L34 résidus · L36-L41 historique.
- `app/globals.css` : L1-L3 imports · L4-L9 thème · L10 `body` · L14-L15 coque et thème clair · L20 bandeau démo · L23 tuiles · L24 camemberts · L28-L33 tableaux/toasts · L34 modale · L35-L37 media queries.
- `app/layout.tsx` : L1 et L42 Analytics · L8 `generator`.
- `next.config.mjs` : L3-L5 typage ignoré.

---

**Note finale** : aucun fichier du dépôt n'a été modifié, aucun commit ni push n'a été effectué. Ce rapport est le seul ajout, laissé à votre disposition et supprimable. J'attends vos instructions avant toute intervention.
