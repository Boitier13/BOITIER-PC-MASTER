# Applications installées — inventaire réel (lecture seule)

Lot C1 : remplacer les fixtures de démonstration par une lecture réelle du
registre Windows, sans jamais ouvrir la porte à une action destructive.

## 1. Contrat IPC

Deux commandes, toutes deux en lecture :

| Commande | Entrée | Sortie |
|---|---|---|
| `apps_list` | `{ query?: AppListQuery }` | `AppInventory` |
| `apps_sources` | — | `AppSourceStatus[]` |

`AppListQuery` : `search`, `publisher`, `scope` (`machine`/`user`),
`architecture` (`x64`/`x86`/`arm64`), `sort` (`name`/`size`/`date`), `offset`,
`limit` (défaut 200, plafond 500). Les valeurs inconnues sont ignorées, jamais
rejetées.

`AppInventory` : `items`, `total`, `offset`, `limit`, `sources`, `scannedAtMs`.
Le filtrage, le tri et la pagination sont faits **côté Rust** : l'interface ne
reçoit jamais l'inventaire complet d'un poste chargé.

`InstalledApp` (voir `src/domain/types.ts`) : `id`, `name`, `publisher`,
`version`, `installedAtMs`, `sizeBytes`, `installLocation`, `uninstallString`,
`quietUninstallString`, `productCode`, `installerType`, `scope`,
`architecture`, `hasUninstaller`, `registryPath`. Toute valeur absente reste
`null` — jamais remplacée par une valeur plausible.

## 2. Sources lues

| Id | Ruche | Vue | Portée |
|---|---|---|---|
| `hklm64` | `HKLM` | 64 bits | machine |
| `hklm32` | `HKLM` | `KEY_WOW64_32KEY` | machine |
| `hkcu` | `HKCU` | courante | utilisateur |

Chemin commun : `SOFTWARE\Microsoft\Windows\CurrentVersion\Uninstall`.

Une clé refusée par Windows (ACL) incrémente `denied` et **n'interrompt jamais**
l'énumération. Une ruche entièrement inaccessible produit `accessible: false`
avec un message : l'écran peut alors expliquer un inventaire vide.

## 3. Règles d'exclusion

1. `DisplayName` absent ou vide ;
2. `SystemComponent = 1` (composants internes de Windows) ;
3. `ParentKeyName` / `ParentDisplayName` renseignés (correctifs rattachés) ;
4. nom de mise à jour (`KBxxxxxxx`) ou `ReleaseType` contenant `update`/`hotfix` ;
5. doublon `(nom, version, éditeur)` : la portée **machine** l'emporte sur la
   portée utilisateur.

## 4. Conversions

| Donnée | Règle |
|---|---|
| Taille | `EstimatedSize` (Ko) puis `InstallSize` (Ko) ; `null` sinon. Jamais d'estimation par balayage |
| Date | `InstallDate` `AAAAMMJJ` → millisecondes epoch UTC ; `null` si invalide |
| Type d'installateur | `msiexec` ou code produit GUID → `msi` ; chaîne présente → `exe` ; sinon `unknown` |
| Code produit | nom de sous-clé GUID (`{…}`), sinon valeur `ProductCode` |
| Architecture | vue de registre : 64 bits natif (`x64`/`arm64`), 32 bits (`x86`) |

## 5. Sécurité

- `KEY_READ` uniquement ; aucune fonction d'écriture n'existe dans le module ;
- aucun `std::process`, aucun shell, donc **aucune désinstallation exécutée** :
  `UninstallString` est affichée, jamais lancée ;
- aucune élévation de privilèges demandée ;
- aucune écriture disque, aucun accès réseau.

Ces règles sont vérifiées automatiquement par `scripts/check-foundation.mjs`
(contrôles de la catégorie « Applications »).

## 6. Interface

- **Applications** : table réelle (nom, éditeur, version, date, taille `≈`, type,
  emplacement), recherche différée de 250 ms, filtre de portée, tri par nom,
  taille ou date, pagination, bandeau des sources, état d'erreur explicite.
- **Tableau de bord** : le compteur « Applications installées » vient du moteur ;
  `—` si le moteur est indisponible.
- **Paramètres › Diagnostic moteur** : environnement (`Tauri`/navigateur), état,
  version du binaire, aller-retour IPC, volumes lus, dossier personnel,
  élévation, capacités annoncées, dernière vérification, dernière erreur.

## 7. Limites

1. applications **MSIX/Store** non inventoriées (hors des clés `Uninstall`) ;
2. taille **approximative** (déclarée par Windows) ;
3. autres comptes utilisateurs non lus ;
4. pas d'icônes d'application (nécessiterait la lecture de `DisplayIcon`) ;
5. pas d'historique ni de comparaison d'inventaires (phase SQLite).

## 8. Suite prévue

- **C2** : `uninstall_plan` / `residues_scan` — plan calculé, affiché, jamais exécuté.
- **C3** : sauvegarde/restauration des résidus (introduit des écritures : hors
  périmètre actuel).
- Lot ultérieur : applications Store, icônes, historique.
