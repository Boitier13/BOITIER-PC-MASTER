# Construire et télécharger l'installateur Windows

BOITIER PC MASTER est distribué sous forme d'installateur Windows **non signé**,
construit par GitHub Actions sur un runner `windows-latest`. Aucun outil Rust
n'est nécessaire sur le PC de l'utilisateur, ni sur la machine de développement
pour récupérer un installateur.

## 1. Récupérer les fichiers

L'installateur se construit **uniquement sur un push de la branche
`arena/ce96ae0d-boitier-pc-master`** (branche de session). Aucun autre
déclencheur ne le produit : ni les autres branches, ni les pull requests.

1. Ouvrir l'onglet **Actions** du dépôt `Boitier13/BOITIER-PC-MASTER`, puis le
   workflow **CI**.
2. Ouvrir l'exécution correspondant au dernier push de la branche de session
   (message du commit en cours).
3. Attendre la fin : les jobs de tests s'exécutent d'abord, l'installateur
   ensuite.
4. Dans la section **Artifacts** de la page de l'exécution, télécharger
   **`boitier-pc-master-windows-x64`** (archive ZIP).

Sur les pushs des autres branches et sur les pull requests, les tests
s'exécutent mais le job d'installateur apparaît « Ignoré » et **aucun artefact
n'est publié**.

> Le déclenchement manuel (`workflow_dispatch`) n'est pas utilisé pour l'instant :
> GitHub ne l'expose que si le workflow est présent sur la branche par défaut,
> et `main` doit rester intacte. Dès que ce workflow y sera présent, la
> condition du job pourra devenir `if: github.event_name == 'workflow_dispatch'`.

Le job `Installateur Windows (MSI + NSIS)` n'est construit que si les deux jobs
de tests (`Web — typage, tests, build` et `Rust — compilation et tests Windows`)
ont réussi : **aucun installateur n'est produit à partir d'un code en échec**.

Les artefacts expirent après **14 jours** (limite du stockage GitHub) et ne sont
visibles que par les personnes ayant accès au dépôt. Pour une distribution
publique, voir la section 7.

## 2. Contenu de l'archive

| Fichier | Format | Usage |
|---|---|---|
| `BOITIER PC MASTER_0.1.0_x64_en-US.msi` | WiX / MSI | Déploiement d'entreprise : `msiexec`, GPO, Intune, SCCM |
| `BOITIER PC MASTER_0.1.0_x64-setup.exe` | NSIS | Installation classique par double-clic, sans droits administrateur |
| `SHA256SUMS.txt` | Texte | Empreintes SHA-256 des deux installateurs |

Le nom exact dépend de la version (`0.1.0` actuellement) : elle est définie à
l'identique dans `src-tauri/Cargo.toml` et `src-tauri/tauri.conf.json`.

## 3. Vérifier l'intégrité

PowerShell :

```powershell
Get-FileHash -Algorithm SHA256 "BOITIER PC MASTER_0.1.0_x64-setup.exe"
# comparer avec la ligne correspondante de SHA256SUMS.txt
```

Git Bash / WSL :

```bash
sha256sum -c SHA256SUMS.txt
```

## 4. Installer

- **NSIS** : double-clic sur `…-setup.exe`. Installation dans le profil de
  l'utilisateur, sans élévation de privilèges. Mode silencieux : `…-setup.exe /S`.
- **MSI** : double-clic sur `….msi`, ou en ligne de commande :
  `msiexec /i "BOITIER PC MASTER_0.1.0_x64_en-US.msi"`. Installation pour tous
  les utilisateurs, **élévation requise**.

Ce qui est créé : un raccourci dans le menu Démarrer (et sur le Bureau pour
NSIS), une entrée dans **Applications installées**, et un désinstalleur. Rien
d'autre : aucun service Windows, aucune tâche planifiée, aucune règle de
pare-feu, aucune modification du registre en dehors des clés de désinstallation
standard.

## 5. WebView2

Le mode retenu est **`embedBootstrapper`** (voir `bundle.windows.
webviewInstallMode` dans `src-tauri/tauri.conf.json`) :

- le bootstrapper Microsoft est **embarqué** dans l'installateur (+ ~1,8 Mo) ;
- si WebView2 est **déjà présent** (Windows 11, ou Windows 10 à jour),
  l'installation se déroule **hors ligne** ;
- si WebView2 est **absent**, le bootstrapper embarqué le télécharge depuis
  Microsoft : **une connexion Internet est alors nécessaire**.

Pour une installation garantie hors ligne sur un parc sans WebView2, remplacer
par `offlineInstaller` (+ ~100 Mo) — non retenu ici pour garder un artefact
léger.

## 6. Limites connues (à assumer explicitement)

1. **Aucune signature de code.** Windows SmartScreen affichera
   « Windows a protégé votre PC » / « Éditeur inconnu ». C'est normal pour un
   binaire non signé ; l'utilisateur doit passer par « Informations
   complémentaires » puis « Exécuter quand même ».
2. **Aucun mécanisme de mise à jour automatique** (`plugins` est vide) : une
   nouvelle version s'installe en lançant le nouvel installateur, sans
   désinstallation préalable (`allowDowngrades` est activé).
3. **Build reproductible non garanti** : les horodatages internes diffèrent
   d'une exécution à l'autre ; les empreintes SHA-256 changent donc même à code
   identique.
4. **Aucun test d'installation automatisé** : l'installateur est produit et
   vérifié (présence, taille, empreinte), mais son exécution n'est pas testée
   dans un environnement jetable.

## 7. Feuille de route (hors périmètre actuel)

- **Signature Authenticode** : certificat de signature de code (ou Azure Trusted
  Signing), puis `bundle.windows.certificateThumbprint`,
  `digestAlgorithm: "sha256"` et `timestampUrl`. Sans cela, SmartScreen restera
  bloquant pour le grand public.
- **Publication d'une release** : étendre la condition du job aux tags
  (`startsWith(github.ref, 'refs/tags/v')`), puis téléverser les fichiers avec
  `gh release create --latest=false`. Les artefacts Actions expirent, pas les
  releases.
- **Mise à jour automatique** : plugin `updater` + `TAURI_SIGNING_PRIVATE_KEY`
  en secret, et `createUpdaterArtifacts: true`.
- **Test d'installation** : machine virtuelle Windows jetable, installation
  silencieuse, lancement, vérification de `%LOCALAPPDATA%`, désinstallation.

## 8. Construire localement

Prérequis : Rust stable, **Visual Studio Build Tools** (charge de travail
« Développement Desktop en C++ »), WebView2 Runtime, Node 22 et pnpm.

```bash
pnpm install --frozen-lockfile
pnpm build          # frontend Vite → dist/
pnpm tauri build    # → src-tauri/target/release/bundle/{msi,nsis}
```

La première exécution télécharge WiX et NSIS ; elle prend ensuite plusieurs
minutes (profil `release` avec `lto = true` et `codegen-units = 1`).

## 9. Dépannage

| Symptôme | Cause probable |
|---|---|
| `failed to download WiX/NSIS` | runner sans accès réseau sortant, ou proxy |
| Aucun artefact publié | push sur une autre branche (l'installateur est réservé à la branche de session) ou un des deux jobs de tests a échoué |
| « Aucun installateur MSI n'a été produit » | `bundle.targets` ou `--bundles` ne contient plus `msi` |
| Icône refusée par WiX | `src-tauri/icons/icon.ico` invalide : régénérer avec `pnpm tauri icon <source>` |
| Artefact expiré | pousser un commit vide sur la branche de session (`git commit --allow-empty`) pour relancer la CI |
