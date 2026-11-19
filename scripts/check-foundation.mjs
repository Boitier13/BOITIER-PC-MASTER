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
console.log('Rappel : la compilation Rust doit être vérifiée avec `cargo check` sur une machine disposant de Rust.')

process.exit(failures === 0 ? 0 : 1)
