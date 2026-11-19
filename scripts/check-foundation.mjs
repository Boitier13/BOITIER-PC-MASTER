#!/usr/bin/env node
/**
 * Contrôle structurel du socle BOITIER PC MASTER.
 *
 * Ce script ne remplace PAS une compilation Rust : il vérifie la présence, la
 * validité syntaxique et les règles de sécurité de la fondation. La compilation
 * Rust doit être exécutée sur une machine disposant de `cargo` (voir
 * docs/FOUNDATION.md).
 *
 * Usage : node scripts/check-foundation.mjs
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { parse as parseToml } from 'smol-toml'

const root = process.cwd()
const results = []

function check(category, label, condition, detail = '') {
  results.push({ category, label, ok: Boolean(condition), detail })
}

function read(path) {
  return readFileSync(join(root, path), 'utf8')
}

function readJson(path) {
  try {
    return JSON.parse(read(path))
  } catch (error) {
    check('Config', `${path} — JSON valide`, false, error.message)
    return null
  }
}

/* ---------------------------------------------------------------- Présence */

const requiredFiles = [
  'index.html',
  'vite.config.ts',
  'vitest.config.ts',
  'tsconfig.json',
  'src/main.tsx',
  'src/app/App.tsx',
  'src/app/AppShell.tsx',
  'src/app/routes.ts',
  'src/styles/globals.css',
  'src/services/system-service.ts',
  'src/services/mock/mock-system-service.ts',
  'src/services/tauri/tauri-system-service.ts',
  'src/ipc/client.ts',
  'src/ipc/contracts.ts',
  'src/domain/types.ts',
  'src-tauri/Cargo.toml',
  'src-tauri/build.rs',
  'src-tauri/tauri.conf.json',
  'src-tauri/capabilities/default.json',
  'src-tauri/src/main.rs',
  'src-tauri/src/lib.rs',
  'src-tauri/src/commands/system.rs',
  'src-tauri/src/db/migrations/001_init.sql',
  'src-tauri/icons/icon.ico',
  'src-tauri/icons/32x32.png',
  'src-tauri/icons/128x128.png',
]

for (const file of requiredFiles) {
  check('Présence', file, existsSync(join(root, file)))
}

/* ------------------------------------------------------------ package.json */

const pkg = readJson('package.json')
if (pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies }
  check('Dépendances', 'React présent', deps.react, deps.react ?? '')
  check('Dépendances', 'TypeScript présent', deps.typescript, deps.typescript ?? '')
  check('Dépendances', 'Vite présent', deps.vite, deps.vite ?? '')
  check('Dépendances', 'Tailwind présent', deps.tailwindcss, deps.tailwindcss ?? '')
  check('Dépendances', 'Tauri API présent', deps['@tauri-apps/api'], '')
  check('Dépendances', 'Tauri CLI présent', deps['@tauri-apps/cli'], '')

  check('Hors ligne', 'Next.js absent', !deps.next, deps.next ?? '')
  check('Hors ligne', 'Vercel Analytics absent', !deps['@vercel/analytics'], '')
  check(
    'Hors ligne',
    'Aucun paquet de télémétrie/analytics',
    !Object.keys(deps).some((name) => /analytics|telemetry|sentry|posthog|mixpanel/i.test(name)),
    '',
  )
  check('Hors ligne', 'Aucun client HTTP ajouté (axios/got)', !deps.axios && !deps.got, '')

  const scripts = pkg.scripts ?? {}
  for (const script of ['dev', 'build', 'typecheck', 'test', 'tauri', 'check:foundation']) {
    check('Scripts', `script « ${script} »`, Boolean(scripts[script]), scripts[script] ?? '')
  }
  check(
    'Scripts',
    'build = typecheck + build (typage obligatoire)',
    (scripts.build ?? '').includes('tsc'),
    scripts.build ?? '',
  )
}

/* ------------------------------------------------------ Configuration Tauri */

const tauri = readJson('src-tauri/tauri.conf.json')
if (tauri) {
  check('Tauri', 'productName défini', Boolean(tauri.productName), tauri.productName ?? '')
  check('Tauri', 'identifier défini', Boolean(tauri.identifier), tauri.identifier ?? '')
  check('Tauri', 'frontendDist = ../dist', tauri.build?.frontendDist === '../dist', tauri.build?.frontendDist ?? '')
  check('Tauri', 'devUrl sur le port Vite (5173)', String(tauri.build?.devUrl ?? '').includes('5173'), tauri.build?.devUrl ?? '')
  check('Tauri', 'withGlobalTauri désactivé', tauri.app?.withGlobalTauri === false, String(tauri.app?.withGlobalTauri))
  check('Tauri', 'icônes déclarées', Array.isArray(tauri.bundle?.icon) && tauri.bundle.icon.length >= 3, '')

  const csp = tauri.app?.security?.csp ?? ''
  check('Sécurité', 'CSP présente', Boolean(csp))
  check('Sécurité', 'CSP sans unsafe-eval', !csp.includes('unsafe-eval'))
  check("Sécurité", "CSP sans * en script-src", !/script-src[^;]*\*/.test(csp))
  check('Sécurité', 'Aucun plugin déclaré', Object.keys(tauri.plugins ?? {}).length === 0, '')

  const confStr = JSON.stringify(tauri)
  check(
    'Sécurité',
    'Aucun plugin fs/shell/process/http configuré',
    !/"(fs|shell|process|http)"/.test(confStr),
  )
}

const capabilities = readJson('src-tauri/capabilities/default.json')
if (capabilities) {
  const perms = capabilities.permissions ?? []
  check('Sécurité', 'Capabilities limitées à core:default', perms.length === 1 && perms[0] === 'core:default', perms.join(', '))
  check(
    'Sécurité',
    'Aucun droit fs/shell/process accordé',
    !perms.some((perm) => /^(fs|shell|process|http):/.test(perm)),
    perms.join(', '),
  )
  check('Sécurité', 'Fenêtre ciblée = main', JSON.stringify(capabilities.windows) === '["main"]', '')
}

/* ------------------------------------------------------------------- Rust */

let cargo = null
try {
  cargo = parseToml(read('src-tauri/Cargo.toml'))
  check('Rust', 'Cargo.toml — TOML valide', true)
} catch (error) {
  check('Rust', 'Cargo.toml — TOML valide', false, error.message)
}

if (cargo) {
  check('Rust', 'Crate tauri 2 déclarée', String(cargo.dependencies?.tauri?.version ?? cargo.dependencies?.tauri ?? '').startsWith('2'), JSON.stringify(cargo.dependencies?.tauri))
  check('Rust', 'tauri-build déclaré', Boolean(cargo['build-dependencies']?.['tauri-build']))
  check('Rust', 'serde déclaré', Boolean(cargo.dependencies?.serde))
  const depsStr = JSON.stringify(cargo.dependencies ?? {})
  check(
    'Rust',
    'Aucun accès système dangereux déclaré (fs/shell/process)',
    !/plugin-(fs|shell|process)|windows-registry/.test(depsStr),
  )
  check('Rust', 'SQLite non activé (phase 1)', !/rusqlite|tauri-plugin-sql/.test(depsStr), '')
}

const rustSources = [
  'src-tauri/src/lib.rs',
  'src-tauri/src/state.rs',
  'src-tauri/src/error.rs',
  'src-tauri/src/commands/system.rs',
  'src-tauri/src/db/mod.rs',
  'src-tauri/src/platform/windows/mod.rs',
]

const rustCode = rustSources.map((file) => read(file)).join('\n')

check('Rust', 'Aucune commande de suppression', !/remove_dir_all|remove_file|std::fs::remove/.test(rustCode))
check('Rust', 'Aucune écriture de registre', !/RegDelete|RegSetValue|set_value|create_subkey|delete_subkey/.test(rustCode))
check('Rust', 'Aucune exécution de processus', !/Command::new|ShellExecute|CreateProcess/.test(rustCode))
check('Rust', 'Aucune demande d’élévation', !/runas|requireAdministrator|ShellExecuteW/.test(rustCode))
check('Rust', 'Aucune écriture fichier', !/fs::write|File::create/.test(rustCode))

for (const command of ['app_info', 'engine_status', 'db_status', 'ping']) {
  check('IPC', `commande Rust « ${command} » enregistrée`, new RegExp(`commands::system::${command}`).test(read('src-tauri/src/lib.rs')))
}

const contracts = read('src/ipc/contracts.ts')
for (const command of ['app_info', 'engine_status', 'db_status', 'ping']) {
  check('IPC', `commande déclarée côté TypeScript « ${command} »`, contracts.includes(`'${command}'`))
}

/* ------------------------------------------------------------ Frontend */

const routes = read('src/app/routes.ts')
const appSource = read('src/app/App.tsx')
const expectedRoutes = [
  ['dashboard', '/'],
  ['explorer', '/explorer'],
  ['inventory', '/inventory'],
  ['diskAnalysis', '/disk-analysis'],
  ['applications', '/applications'],
  ['uninstall', '/uninstall'],
  ['monitoring', '/monitoring'],
  ['history', '/history'],
  ['settings', '/settings'],
]

for (const [name, path] of expectedRoutes) {
  check('Écrans', `route ${name} (${path})`, routes.includes(`'${path}'`) && appSource.includes(`ROUTES.${name}`))
}

const screensTest = read('src/__tests__/screens.test.tsx')
check('Écrans', 'test couvrant les 9 écrans', (screensTest.match(/path: '/g) ?? []).length === 9)

check('Frontend', 'Aucun import Next.js restant', !/from ['"]next\//.test(read('src/app/App.tsx') + read('src/main.tsx')))
check('Frontend', 'CSS de la maquette conservé', statSync(join(root, 'src/styles/globals.css')).size > 30_000)
check('Frontend', 'Interface SystemService définie', read('src/services/system-service.ts').includes('export interface SystemService'))
check('Frontend', 'Moteur de démonstration présent', read('src/services/mock/mock-system-service.ts').includes('class MockSystemService'))
check('Frontend', 'Moteur Tauri présent', read('src/services/tauri/tauri-system-service.ts').includes('class TauriSystemService'))
check('Frontend', 'Aucun fetch dans src/', !/fetch\(/.test(read('src/services/mock/mock-system-service.ts')))

/* --------------------------------------------------------------- Icônes */

const icoBuffer = readFileSync(join(root, 'src-tauri/icons/icon.ico'))
const isIco = icoBuffer.readUInt16LE(0) === 0 && icoBuffer.readUInt16LE(2) === 1
check('Icônes', 'icon.ico au format ICO', isIco, `${icoBuffer.length} octets`)
check('Icônes', 'icon.ico non vide', icoBuffer.length > 1000, `${icoBuffer.length} octets`)

const icoCount = icoBuffer.readUInt16LE(4)
check('Icônes', 'icon.ico multi-résolutions', icoCount >= 4, `${icoCount} images`)


/* ------------------------------------------------- Mission 3 : exploration */

const engineFiles = [
  'src-tauri/src/fs_engine/mod.rs',
  'src-tauri/src/fs_engine/entry.rs',
  'src-tauri/src/fs_engine/listing.rs',
  'src-tauri/src/fs_engine/walker.rs',
  'src-tauri/src/fs_engine/paths.rs',
  'src-tauri/src/fs_engine/protected.rs',
  'src-tauri/src/fs_engine/volumes.rs',
  'src-tauri/src/fs_engine/folders.rs',
  'src-tauri/src/fs_engine/error.rs',
  'src-tauri/src/commands/fs.rs',
  'src-tauri/src/commands/mod.rs',
  'src/features/explorer/ExplorerPage.tsx',
  'src/features/explorer/FileTable.tsx',
  'src/features/explorer/PropertiesPanel.tsx',
  'src/features/explorer/use-explorer.ts',
  'src/hooks/use-service-data.ts',
  'src/hooks/use-volumes.ts',
  'docs/FEATURE_EXPLORER.md',
  '.github/workflows/ci.yml',
]

for (const file of engineFiles) {
  check('Moteur de fichiers', `fichier présent — ${file}`, existsSync(join(root, file)))
}

/** Code de production d'un fichier Rust, sans son module de tests. */
function productionOnly(path) {
  const source = read(path)
  const testStart = source.indexOf('#[cfg(test)]')
  return testStart === -1 ? source : source.slice(0, testStart)
}

const engineProduction = engineFiles
  .filter((file) => file.endsWith('.rs'))
  .map((file) => productionOnly(file))
  .join('\n')

check('Moteur de fichiers', 'Aucune écriture/suppression/déplacement dans le moteur',
  !/fs::write|File::create|remove_file|remove_dir_all|fs::rename|fs::copy|create_dir/.test(engineProduction))
check('Moteur de fichiers', 'Aucune API Win32 destructive importée',
  !/DeleteFile|MoveFile|SHFileOperation|RegDelete/.test(engineProduction))
check('Moteur de fichiers', 'Liens jamais suivis (symlink_metadata, pas de follow_links)',
  engineProduction.includes('symlink_metadata') && !/follow_links|follow_links\(true\)|\.metadata\(\).*canonicalize/.test(engineProduction))
check('Moteur de fichiers', 'Dossiers protégés non parcourus (blocks_traversal)',
  engineProduction.includes('blocks_traversal') && engineProduction.includes('is_protected'))
check('Moteur de fichiers', 'Chemins longs Windows (\\\\?\\) pris en charge',
  read('src-tauri/src/fs_engine/paths.rs').includes('\\\\\\\\?\\\\'))
check('Moteur de fichiers', 'Annulation par AtomicBool',
  engineProduction.includes('AtomicBool') && engineProduction.includes('register_scan') && engineProduction.includes('cancel_scan'))
check('Moteur de fichiers', 'Bornes de parcours (profondeur, résultats, entrées)',
  ['max_depth', 'max_results', 'max_entries'].every((field) => read('src-tauri/src/fs_engine/walker.rs').includes(field)))
check('Moteur de fichiers', 'Progression émise sur scan://progress',
  read('src-tauri/src/commands/fs.rs').includes('scan://progress') && read('src/ipc/contracts.ts').includes("'scan://progress'"))
check('Moteur de fichiers', 'Erreurs d’accès exposées (EngineError)',
  ['access_denied', 'not_found', 'not_a_directory'].every((code) => read('src-tauri/src/fs_engine/error.rs').includes(code)))
check('Moteur de fichiers', 'Tests Rust présents (cfg(test) + tempfile)',
  fsEngineTestFiles().filter((file) => read(file).includes('#[cfg(test)]')).length >= 5 && read('src-tauri/Cargo.toml').includes('tempfile'))

function fsEngineTestFiles() {
  return [
    'src-tauri/src/fs_engine/entry.rs',
    'src-tauri/src/fs_engine/listing.rs',
    'src-tauri/src/fs_engine/walker.rs',
    'src-tauri/src/fs_engine/paths.rs',
    'src-tauri/src/fs_engine/protected.rs',
    'src-tauri/src/fs_engine/volumes.rs',
    'src-tauri/src/fs_engine/folders.rs',
    'src-tauri/src/state.rs',
    'src-tauri/src/commands/fs.rs',
  ]
}

for (const command of ['volumes_list', 'user_folders', 'directory_list', 'path_metadata', 'walk_start', 'walk_cancel']) {
  check('IPC', `commande Rust « ${command} » enregistrée`, new RegExp(`commands::fs::${command}`).test(read('src-tauri/src/lib.rs')))
  check('IPC', `commande déclarée côté TypeScript « ${command} »`, contracts.includes(`'${command}'`))
}

const explorerSources = [
  read('src/features/explorer/ExplorerPage.tsx'),
  read('src/features/explorer/FileTable.tsx'),
  read('src/features/explorer/PropertiesPanel.tsx'),
  read('src/features/explorer/use-explorer.ts'),
  read('src/features/explorer/use-paged-listing.ts'),
  read('src/features/explorer/use-row-window.ts'),
  read('src/features/explorer/columns.ts'),
].join('\n')

check('Explorateur', 'L’écran passe par le contrat SystemService',
  explorerSources.includes('useExplorer') && explorerSources.includes('listDirectory'))
check('Explorateur', 'Recherche récursive branchée sur walk()',
  read('src/features/explorer/use-explorer.ts').includes('.walk('))
check('Explorateur', 'Annulation de recherche (AbortController)',
  explorerSources.includes('AbortController') && explorerSources.includes('cancelScan'))
check('Explorateur', 'Aucune action destructive déclenchée depuis l’interface',
  !/service\.(delete|remove|move|rename|write)/.test(explorerSources) &&
  /openAction\(`\$\{action\.name\} — opération non disponible`\)/.test(explorerSources))
check('Explorateur', 'Propriétés réelles (taille, dates, attributs, état)',
  read('src/features/explorer/PropertiesPanel.tsx').includes('describeAttributes') &&
  read('src/features/explorer/PropertiesPanel.tsx').includes('formatBytes'))
check('Explorateur', 'Mode démonstration : arborescence fictive servie par le même contrat',
  read('src/services/mock/mock-system-service.ts').includes('async listDirectory') &&
  read('src/services/mock/mock-system-service.ts').includes('async walk'))
check('Explorateur', 'Moteur Tauri : volumes, dossiers, parcours branchés',
  read('src/services/tauri/tauri-system-service.ts').includes('COMMANDS.directoryList') &&
  read('src/services/tauri/tauri-system-service.ts').includes('COMMANDS.walkStart'))
check('Explorateur', 'Aucune méthode destructive dans le contrat SystemService',
  !/\b(delete|remove|rename|move)(Entry|File|Path|Directory)?\s*\(/.test(read('src/services/system-service.ts')))
check('Explorateur', 'Volumes alimentés par le moteur (inventaire et tableau de bord)',
  read('src/features/inventory/InventoryPage.tsx').includes('useVolumes') &&
  read('src/features/dashboard/DashboardPage.tsx').includes('useVolumes'))
check('CI', 'Workflow GitHub Actions : tests web et compilation Windows',
  read('.github/workflows/ci.yml').includes('windows-latest') &&
  read('.github/workflows/ci.yml').includes('cargo test') &&
  read('.github/workflows/ci.yml').includes('pnpm test'))

/* ------------------------------------------------------------- Applications */

function readTree(directory) {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  const files = []
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relativePath = join(directory, entry.name)
    if (entry.isDirectory()) files.push(...readTree(relativePath))
    else if (entry.name.endsWith('.rs')) files.push(relativePath)
  }
  return files
}

const allRustFiles = readTree('src-tauri/src')
const allRustCode = allRustFiles.map((file) => read(file)).join('\n')

/** Code sans commentaires : une phrase de documentation ne doit pas déclencher
 *  une alerte de sécurité (ni la masquer). */
function stripComments(source) {
  return source
    .split('\n')
    .map((line) => line.replace(/\/\/.*$/, ''))
    .join('\n')
}

const allRustCodeOnly = stripComments(allRustCode)
const applicationsPage = read('src/features/applications/ApplicationsPage.tsx')

check('Applications', 'Inventaire réel : commandes déclarées et exposées',
  allRustCode.includes('commands::apps::apps_list') &&
  allRustCode.includes('commands::apps::apps_sources') &&
  read('src/ipc/contracts.ts').includes("appsList: 'apps_list'") &&
  read('src/ipc/contracts.ts').includes("appsSources: 'apps_sources'"))
check('Applications', 'Le moteur annonce la capacité « applications installées »',
  /installed_apps:\s*true/u.test(allRustCode))
check('Applications', 'Lecture du registre strictement en lecture seule',
  allRustCode.includes('KEY_READ') &&
  !/set_value|create_subkey|delete_subkey|RegSetValue|RegDelete/u.test(allRustCodeOnly) &&
  !/std::process|Command::new|powershell|cmd\.exe/iu.test(allRustCodeOnly))
check('Applications', 'L’écran Applications ne lit plus les fixtures de démonstration',
  /from '@\/hooks\/use-installed-apps'/u.test(applicationsPage) &&
  !/useWorkspace/u.test(applicationsPage) &&
  /ServiceError/u.test(applicationsPage))
check('Applications', 'État du moteur mesuré, plus jamais écrit en dur',
  existsSync(join(root, 'src/hooks/use-engine-diagnostics.ts')) &&
  read('src/hooks/use-engine-diagnostics.ts').includes('service.getCapabilities()') &&
  !/Non connecté/u.test(read('src/app/AppShell.tsx')) &&
  read('src/features/settings/SettingsPage.tsx').includes('Relancer le diagnostic'))
check('Applications', 'Aucune donnée fictive présentée comme réelle hors démonstration',
  read('src/features/applications/ApplicationsPage.tsx').includes('Inventaire indisponible') &&
  read('src/features/dashboard/DashboardPage.tsx').includes('Moteur indisponible'))

/* ---------------------------------------------------------- Mesure d'espace */

/** Concatène les sources TS de l'application (hors tests). */
function readTsTree(directory) {
  const absolute = join(root, directory)
  if (!existsSync(absolute)) return []
  const files = []
  for (const entry of readdirSync(absolute, { withFileTypes: true })) {
    const relativePath = join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === '__tests__') continue
      files.push(...readTsTree(relativePath))
    } else if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(relativePath)
    }
  }
  return files
}

/** Retire le module de tests final : `fs::write` n'y sert qu'à fabriquer une
 *  arborescence temporaire, jamais à modifier les fichiers de l'utilisateur. */
function stripTestModule(source) {
  const marker = source.indexOf('\n#[cfg(test)]')
  return marker === -1 ? source : source.slice(0, marker)
}

const analysisRust = readTree('src-tauri/src/fs_engine')
  .filter((file) => file.endsWith('analysis.rs'))
  .map((file) => stripTestModule(stripComments(read(file))))
  .join('\n')
const analysisCommand = stripTestModule(stripComments(read('src-tauri/src/commands/analysis.rs')))
const screensCode = [
  'src/features/dashboard/DashboardPage.tsx',
  'src/features/disk-analysis/DiskAnalysisPage.tsx',
  'src/features/history/HistoryPage.tsx',
  'src/features/uninstall/UninstallPage.tsx',
  'src/features/monitoring/MonitoringPage.tsx',
]
  .map((file) => read(file))
  .join('\n')
const appTs = readTsTree('src').map((file) => read(file)).join('\n')
const measurementsStore = read('src/store/measurements.tsx')

check('Mesure', 'Commande `analysis_scan` déclarée, exposée et miroitée',
  read('src-tauri/src/lib.rs').includes('commands::analysis::analysis_scan') &&
  contracts.includes("analysisScan: 'analysis_scan'") &&
  read('src/services/system-service.ts').includes('analyze('))
check('Mesure', 'Analyse strictement en lecture : aucune écriture, aucun processus',
  !/fs::write|File::create|remove_file|remove_dir_all|std::process|Command::new|ShellExecute/u.test(analysisRust + analysisCommand))
check('Mesure', 'Une seule boucle de parcours, partagée entre exploration et mesure',
  /pub\(crate\) fn traverse/u.test(read('src-tauri/src/fs_engine/walker.rs')) &&
  !/read_dir/u.test(stripTestModule(analysisRust)))
check('Mesure', 'Aucune mesure de la maquette ne subsiste dans les écrans',
  !/124\s?806|2,1 To|2,16 To|684 Go|578 Go|326 Go|248 éléments|1 284 éléments/u.test(screensCode))
check('Mesure', 'Aucun écran ne consomme plus les fixtures retirées',
  !/useWorkspace|demoResidues|demoHistory/u.test(appTs) &&
  !existsSync(join(root, 'src/data/use-workspace.ts')))
check('Mesure', 'Le moteur de démonstration refuse la mesure au lieu d’inventer un rapport',
  /async analyze\(/u.test(read('src/services/mock/mock-system-service.ts')) &&
  /not_available/u.test(read('src/services/mock/mock-system-service.ts')))
check('Mesure', 'Journal de session uniquement, jamais persisté',
  measurementsStore.includes('journal') &&
  !/localStorage|sessionStorage|indexedDB/u.test(measurementsStore))
check('Mesure', 'Les fonctions absentes sont nommées avec leur lot',
  read('src/features/uninstall/UninstallPage.tsx').includes('lot C2') &&
  read('src/features/monitoring/MonitoringPage.tsx').includes('lot C4') &&
  read('src/features/history/HistoryPage.tsx').includes('lot D'))

/* ------------------------------------------------------------ Installateur */

const ciWorkflow = read('.github/workflows/ci.yml')
const tauriConfig = readJson('src-tauri/tauri.conf.json')

check('Installateur', 'Job d’installateur Windows : push de la branche de session seulement',
  /windows-installer:/u.test(ciWorkflow) &&
  /needs:\s*\[web,\s*rust-windows\]/u.test(ciWorkflow) &&
  /if:\s*github\.event_name == 'push'/u.test(ciWorkflow) &&
  /github\.ref == 'refs\/heads\/arena\/ce96ae0d-boitier-pc-master'/u.test(ciWorkflow))
check('Installateur', 'Bundles MSI et NSIS demandés explicitement',
  /tauri build --bundles msi,nsis/u.test(ciWorkflow) &&
  JSON.stringify(tauriConfig?.bundle?.targets ?? []).includes('nsis'))
check('Installateur', 'Artefacts publiés (MSI, NSIS, empreintes) et échec si vide',
  /upload-artifact@v4/u.test(ciWorkflow) &&
  /bundle\/msi\/\*\.msi/u.test(ciWorkflow) &&
  /bundle\/nsis\/\*\.exe/u.test(ciWorkflow) &&
  /if-no-files-found: error/u.test(ciWorkflow) &&
  /SHA256SUMS\.txt/u.test(ciWorkflow))
check('Installateur', 'WebView2 : bootstrapper embarqué déclaré dans la configuration',
  tauriConfig?.bundle?.windows?.webviewInstallMode?.type === 'embedBootstrapper')
check('Installateur', 'Procédure de téléchargement et limites documentées',
  existsSync(join(root, 'docs/BUILD_INSTALLER.md')) &&
  read('docs/BUILD_INSTALLER.md').includes('SmartScreen') &&
  read('docs/BUILD_INSTALLER.md').includes('SHA256'))

/* ------------------------------------------------------------ Typographie */

const fontsCss = existsSync(join(root, 'src/styles/fonts.css')) ? read('src/styles/fonts.css') : ''
const mainTsx = read('src/main.tsx')
const globalsCss = read('src/styles/globals.css')
function bodies(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/gu, '\\$&')
  const pattern = new RegExp(`${escaped}\\s*\\{([^{}]*)\\}`, 'gu')
  return [...globalsCss.matchAll(pattern)].map((match) => match[1])
}

function ruleBody(selector) {
  return bodies(selector)[0] ?? ''
}

const packageJson = readJson('package.json')
const fontFiles = existsSync(join(root, 'src/assets/fonts'))
  ? readdirSync(join(root, 'src/assets/fonts'))
  : []

check('Typographie', 'Feuille de style des polices présente', fontsCss.length > 0)
check('Typographie', 'Nunito Sans déclarée en police variable (graisses 200 à 1000)',
  (fontsCss.match(/font-family: 'Nunito Sans Variable'/gu) ?? []).length === 2 &&
  (fontsCss.match(/font-weight: 200 1000/gu) ?? []).length === 2 &&
  (fontsCss.match(/format\('woff2-variations'\)/gu) ?? []).length === 2)
check('Typographie', 'Polices embarquées : aucun chargement réseau',
  !/https?:\/\//u.test(fontsCss) && !/@import/u.test(fontsCss) && !/fonts\.googleapis/u.test(globalsCss))
check('Typographie', 'Fichiers de police et licence OFL présents localement',
  fontFiles.filter((name) => name.endsWith('.woff2')).length === 2 &&
  fontFiles.includes('OFL.txt'))
check('Typographie', 'Feuille des polices chargée avant la feuille globale',
  mainTsx.indexOf('@/styles/fonts.css') !== -1 &&
  mainTsx.indexOf('@/styles/fonts.css') < mainTsx.indexOf('@/styles/globals.css'))
check('Typographie', 'Nunito Sans appliquée aux écrans principaux',
  /body \{[^}]*font-family:'Nunito Sans Variable'/u.test(globalsCss) &&
  /--font-read:'Nunito Sans Variable'/u.test(globalsCss))
check('Typographie', 'Barre latérale : Arial conservée, échelle ×1,5 appliquée',
  ruleBody('.sidebar').includes('font-family:Arial,Helvetica,sans-serif') &&
  ruleBody('.sidebar').includes('font-size:18px') &&
  ruleBody('.nav-item').includes('height:42px') &&
  bodies('.nav-item span:nth-child(2)').some((body) => body.includes('font-size:18px')) &&
  ruleBody('.brand strong').includes('font-size:19.5px'))
check('Typographie', 'Paquet @fontsource absent des dépendances',
  !JSON.stringify(packageJson?.dependencies ?? {}).includes('@fontsource') &&
  !JSON.stringify(packageJson?.devDependencies ?? {}).includes('@fontsource'))

/* ------------------------------------------------------- Explorateur EX1 */

const listingRs = read('src-tauri/src/fs_engine/listing.rs')
const explorerHook = read('src/features/explorer/use-explorer.ts')
const pagedHook = read('src/features/explorer/use-paged-listing.ts')
const fileTable = read('src/features/explorer/FileTable.tsx')
const mockService = read('src/services/mock/mock-system-service.ts')
const tauriService = read('src/services/tauri/tauri-system-service.ts')
const domainTypes = read('src/domain/types.ts')

check('Explorateur EX1', 'ADR de cadrage présent (refactorisations et schéma v2)',
  existsSync(join(root, 'docs/ADR_EX1_2026-11-19.md')) &&
  ['R1', 'R2', 'R3', 'R4', 'R5', 'R6', 'R7', 'R8', 'entries_fts'].every((token) =>
    read('docs/ADR_EX1_2026-11-19.md').includes(token)))
check('Explorateur EX1', 'Moteur : pagination déclarée (offset, limit, has_more)',
  listingRs.includes('pub offset: usize') &&
  listingRs.includes('pub limit: Option<usize>') &&
  listingRs.includes('pub has_more: bool') &&
  listingRs.includes('pub matched: usize'))
check('Explorateur EX1', 'Moteur : la page reste bornée par max_entries',
  listingRs.includes('limit.min(options.max_entries)') &&
  listingRs.includes('entries.drain(offset..end)'))
check('Explorateur EX1', 'Moteur : tests de pagination présents',
  ['pagination_deterministe_sans_recouvrement', 'offset_au_dela_de_la_fin_renvoie_une_page_vide', 'sans_pagination_le_listage_est_inchange']
    .every((test) => listingRs.includes(test)))
check('Explorateur EX1', 'Contrats : pagination miroitée côté TypeScript',
  domainTypes.includes('offset?: number') && domainTypes.includes('limit?: number') &&
  domainTypes.includes('hasMore?: boolean') &&
  contracts.includes('hasMore: boolean') && contracts.includes('returned: number'))
check('Explorateur EX1', 'Chargement paginé borné (page ≤ 1 000, ≤ 20 pages)',
  /export const PAGE_SIZE = 1_000/u.test(pagedHook) &&
  /export const MAX_PAGES = 20/u.test(pagedHook) &&
  pagedHook.includes('Math.min(options.pageSize ?? PAGE_SIZE, PAGE_SIZE)'))
check('Explorateur EX1', 'Aucun appel de listage direct hors du chargeur paginé',
  !explorerHook.includes('service.listDirectory') && pagedHook.includes('service.listDirectory'))
check('Explorateur EX1', 'Liste fenêtrée avec repli complet quand la hauteur est inconnue',
  fileTable.includes('useRowWindow') && fileTable.includes('data-entry-row') &&
  fileTable.includes('aria-hidden="true"') &&
  read('src/features/explorer/use-row-window.ts').includes('!rowHeight || !viewport'))
check('Explorateur EX1', 'Colonnes extraites du rendu (préparation EX1.7)',
  existsSync(join(root, 'src/features/explorer/columns.ts')) &&
  read('src/features/explorer/columns.ts').includes('EXPLORER_COLUMNS') &&
  fileTable.includes('EXPLORER_COLUMNS'))
check('Explorateur EX1', 'Démonstration et moteur réel servent la même pagination',
  mockService.includes('hasMore: end < matched') && tauriService.includes('hasMore: payload.hasMore'))
check('Explorateur EX1', 'Aucune exécution de processus dans tout le Rust',
  !/std::process|Command::new|ShellExecute/.test(
    [...engineFiles, 'src-tauri/src/lib.rs', 'src-tauri/src/commands/fs.rs', 'src-tauri/src/commands/analysis.rs']
      .filter((file) => file.endsWith('.rs'))
      .map((file) => read(file))
      .join('\n')))
check('Explorateur EX1', 'Aucune requête SQL destructive dans les migrations',
  !/DROP TABLE|DELETE FROM|TRUNCATE/u.test(read('src-tauri/src/db/migrations/001_init.sql')))

/* ------------------------------------------------------------ Mise en page */

const navigationTsx = read('src/app/navigation.tsx')
const navItemCount = (navigationTsx.match(/route: ROUTES\./gu) ?? []).length
const groupLabelCount = (navigationTsx.match(/label: '/gu) ?? []).length
const px = (selector, property) => {
  const match = new RegExp(`${property}:(\\d+)px`, 'u').exec(ruleBody(selector))
  return match ? Number(match[1]) : 0
}
const sidebarWidth = px('.sidebar', 'width')
const navItemHeight = px('.nav-item', 'height')
const navGroupGap = px('.nav-group', 'margin-bottom')
const brandMark = px('.brand-mark', 'width')
const tableMinWidth = px('.app-table-panel .data-table', 'min-width')
const pagePadding = Number(/padding:(\d+)px (\d+)px/u.exec(bodies('.page-content').find((body) => body.includes('padding:')) ?? '')?.[2] ?? 0)

// Hauteur approximative de la barre latérale, interlignes pris au large (1,4).
const sidebarBudget =
  18 + // padding haut
  16 + // padding bas
  (brandMark + 18 + 1) + // marque + marge + filet
  (Math.ceil(12 * 1.4) + 20 + 2 + 14 + 16) + // bandeau démo + marges
  navItemCount * (navItemHeight + 6) + // rubriques
  groupLabelCount * (Math.ceil(13.5 * 1.4) + 8 + navGroupGap) + // libellés de groupe
  (13 * 2 + Math.max(42, Math.ceil(15 * 1.4) * 2 + 4) + 2) + // carte moteur
  12 + // marge de la carte moteur
  (14 + 42) // profil

check('Mise en page', 'Barre latérale : largeur, hauteurs et marges adaptées à l’échelle ×1,5',
  sidebarWidth === 320 && navItemHeight === 42 &&
  ruleBody('.sidebar').includes('padding:18px 14px 16px'))
check('Mise en page', 'Barre latérale : aucune coupe possible, navigation défilante',
  ruleBody('.sidebar').includes('overflow:hidden') &&
  bodies('.side-nav').some((body) => body.includes('min-height:0') && body.includes('overflow-y:auto')))
check('Mise en page', `Barre latérale : hauteur estimée ${sidebarBudget} px pour 900 px de fenêtre`,
  navItemCount === 9 && groupLabelCount === 3 && sidebarBudget <= 900)
check('Mise en page', 'Applications : toutes les colonnes dimensionnées, aucun écrasement',
  [...globalsCss.matchAll(/\.app-table-panel \.data-table th:nth-child\(\d\) \{ width:\d+px; \}/gu)].length === 7 &&
  ruleBody('.app-table-panel .data-table').includes('table-layout:fixed'))
check('Mise en page', 'Applications : cellules tronquées proprement au lieu de déborder',
  ruleBody('.app-table-panel .data-table td').includes('text-overflow:ellipsis') &&
  ruleBody('.app-table-panel .data-table td').includes('overflow:hidden') &&
  ruleBody('.app-table-panel .data-table th').includes('white-space:normal'))
check('Mise en page', 'Applications : défilement horizontal prévu et visible',
  bodies('.table-wrap').some((body) => body.includes('overflow-x:auto')) &&
  ruleBody('.app-table-panel .table-wrap').includes('overflow-x:auto'))
check('Mise en page', 'Applications : filtres, boutons et recherche passent à la ligne',
  ruleBody('.table-controls').includes('flex-wrap:wrap') &&
  ruleBody('.app-table-panel .table-search').includes('min-width:180px') &&
  ruleBody('.app-table-panel .table-search input').includes('width:100%'))
check('Mise en page', 'Applications : le tableau tient à 1440 × 900 sans débordement de page',
  sidebarWidth + tableMinWidth + pagePadding * 2 <= 1440)
check('Mise en page', 'Écrans principaux : échelle ×1,5 et Nunito Sans préservées',
  ruleBody('.page-heading h1').includes('font-size:37.5px') &&
  ruleBody('.table-wrap td').includes('font-size:13.5px') &&
  ruleBody('.metric-card>strong').includes('font-size:31.5px') &&
  globalsCss.includes("--font-read:'Nunito Sans Variable'"))
check('Mise en page', 'Aucune largeur minimale supérieure à 1010 px dans les écrans',
  Math.max(...[...globalsCss.matchAll(/min-width:(\d+)px/gu)].map((match) => Number(match[1]))) <= 1010)

/* -------------------------------------------------------------- Rapport */


const categories = [...new Set(results.map((result) => result.category))]
let failures = 0

for (const category of categories) {
  const rows = results.filter((result) => result.category === category)
  console.log(`\n${category}`)
  for (const row of rows) {
    if (!row.ok) failures += 1
    const detail = row.detail && row.detail !== 'undefined' ? ` (${String(row.detail).slice(0, 90)})` : ''
    console.log(`  ${row.ok ? '✓' : '✗'} ${row.label}${row.ok ? detail : ` — ${row.detail}`}`)
  }
}

console.log(
  `\n${results.length - failures}/${results.length} contrôles réussis.` +
    (failures === 0 ? ' Socle conforme.' : ` ${failures} contrôle(s) en échec.`),
)
console.log('Rappel : la compilation Rust est vérifiée par la CI GitHub Actions (job « Rust — compilation et tests Windows »).')

process.exit(failures === 0 ? 0 : 1)
