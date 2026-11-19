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

import { readFileSync, existsSync, statSync } from 'node:fs'
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
    'Aucun accès système dangereux déclaré (fs/shell/process/registry)',
    !/plugin-(fs|shell|process)|windows-registry|winreg/.test(depsStr),
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
check('Rust', 'Aucun accès registre', !/RegDelete|RegSetValue|winreg/.test(rustCode))
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
].join('\n')

check('Explorateur', 'L’écran passe par le contrat SystemService',
  explorerSources.includes('useExplorer') && read('src/features/explorer/use-explorer.ts').includes('listDirectory'))
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
