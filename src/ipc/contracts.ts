/**
 * Miroirs TypeScript des structures Rust sérialisées.
 *
 * Deux familles :
 *  - `commands/system.rs` : informations sur l'application et le moteur ;
 *  - `commands/fs.rs`     : exploration et inventaire des fichiers.
 *
 * Toute modification d'une structure Rust doit être répercutée ici. Ces types
 * décrivent uniquement la frontière IPC : aucun accès direct à `window`, au
 * disque ou au système n'est exposé à l'interface.
 */

export type EngineModePayload = 'demo' | 'system'

export interface AppInfoPayload {
  name: string
  version: string
  platform: string
  arch: string
  engineMode: EngineModePayload
  realSystemAccess: boolean
}

export interface EngineStatusPayload {
  mode: EngineModePayload
  capabilities: {
    volumes: boolean
    fileInventory: boolean
    installedApps: boolean
    uninstall: boolean
    residueScan: boolean
    monitoring: boolean
    reports: boolean
  }
  elevation: 'none' | 'optional' | 'required'
  realSystemAccess: boolean
}

export interface DbStatusPayload {
  ready: boolean
  path: string
  schemaVersion: number
}

/* ------------------------------------------------------------------ */
/* Exploration et inventaire (src-tauri/src/commands/fs.rs)            */
/* ------------------------------------------------------------------ */

export interface FileAttributesPayload {
  readonly: boolean
  hidden: boolean
  system: boolean
  archive: boolean
  directory: boolean
  reparsePoint: boolean
  offline: boolean
  temporary: boolean
  sparse: boolean
  compressed: boolean
  encrypted: boolean
  raw: number
}

export interface FileEntryPayload {
  name: string
  path: string
  parent: string | null
  extension: string | null
  category: string
  sizeBytes: number
  createdAtMs: number | null
  modifiedAtMs: number | null
  accessedAtMs: number | null
  isDirectory: boolean
  isSymlink: boolean
  isProtected: boolean
  accessDenied: boolean
  attributes: FileAttributesPayload
}

export interface DirectoryListingPayload {
  path: string
  parent: string | null
  entries: FileEntryPayload[]
  total: number
  truncated: boolean
  denied: number
  isProtected: boolean
}

export interface VolumePayload {
  letter: string
  label: string
  kind: string
  filesystem: string | null
  mountPoint: string
  totalBytes: number
  freeBytes: number
  usedBytes: number
  isRemovable: boolean
  isSystem: boolean
}

export interface UserFolderPayload {
  id: string
  label: string
  path: string
}

/* ------------------------------------------------------------------ */
/* Inventaire des applications (src-tauri/src/commands/apps.rs)        */
/* ------------------------------------------------------------------ */

export interface InstalledAppPayload {
  id: string
  name: string
  publisher: string | null
  version: string | null
  installedAtMs: number | null
  sizeBytes: number | null
  installLocation: string | null
  uninstallString: string | null
  quietUninstallString: string | null
  productCode: string | null
  installerType: string
  scope: string
  architecture: string
  hasUninstaller: boolean
  registryPath: string
}

export interface AppSourceStatusPayload {
  id: string
  label: string
  accessible: boolean
  entries: number
  denied: number
  error: string | null
}

export interface AppInventoryPayload {
  items: InstalledAppPayload[]
  total: number
  offset: number
  limit: number
  sources: AppSourceStatusPayload[]
  scannedAtMs: number
}

export interface WalkStatsPayload {
  visited: number
  matched: number
  folders: number
  files: number
  denied: number
  skippedProtected: number
  totalSizeBytes: number
  truncated: boolean
  cancelled: boolean
  elapsedMs: number
}

export interface WalkResultPayload {
  root: string
  entries: FileEntryPayload[]
  stats: WalkStatsPayload
}

export interface ScanProgressPayload {
  scanId: string
  visited: number
  matched: number
  current: string
  elapsedMs: number
}

/** Noms des commandes exposées — liste blanche unique côté frontend. */
export const COMMANDS = {
  appInfo: 'app_info',
  engineStatus: 'engine_status',
  dbStatus: 'db_status',
  ping: 'ping',
  volumesList: 'volumes_list',
  userFolders: 'user_folders',
  directoryList: 'directory_list',
  pathMetadata: 'path_metadata',
  walkStart: 'walk_start',
  walkCancel: 'walk_cancel',
  appsList: 'apps_list',
  appsSources: 'apps_sources',
} as const

/** Événements émis par le moteur pendant un parcours. */
export const EVENTS = {
  scanProgress: 'scan://progress',
} as const

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS]
export type EventName = (typeof EVENTS)[keyof typeof EVENTS]
