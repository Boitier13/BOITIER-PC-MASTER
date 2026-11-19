/**
 * Modèle de domaine de BOITIER PC MASTER.
 *
 * Ces types sont partagés par l'interface, le moteur de démonstration et le
 * moteur Windows réel (commandes Tauri). Ils ne dépendent que de TypeScript :
 * ni React, ni Tauri.
 *
 * Depuis la phase 3, les fichiers portent des **octets** (`sizeBytes`) et des
 * **horodatages UNIX en millisecondes** : c'est la forme native du moteur Rust,
 * directement comparable, stockable en SQLite et exploitable pour les futurs
 * inventaires datés. Le formatage localisé reste entièrement côté interface.
 */

export type EngineMode = 'demo' | 'system'

/** Niveau de confiance d'un résidu potentiel. */
export type Confidence = 'high' | 'medium' | 'low' | 'system'

/** Nature d'un élément détecté. */
export type ElementType = 'file' | 'folder' | 'registry' | 'shared' | 'service' | 'task'

/** Catégorie stable d'un fichier (miroir de `fs_engine::paths::category_for`). */
export type FileCategory =
  | 'folder'
  | 'document'
  | 'image'
  | 'video'
  | 'audio'
  | 'archive'
  | 'application'
  | 'system'
  | 'other'

/** Attributs de fichier (miroir de `fs_engine::entry::FileAttributes`). */
export interface FileAttributes {
  readonly: boolean
  hidden: boolean
  system: boolean
  archive: boolean
  directory: boolean
  /** Lien symbolique, jonction ou point d'analyse. */
  reparsePoint: boolean
  offline: boolean
  temporary: boolean
  sparse: boolean
  compressed: boolean
  encrypted: boolean
  /** Valeur brute `FILE_ATTRIBUTE_*` (0 hors Windows). */
  raw: number
}

export interface Volume {
  id: string
  letter: string
  label: string
  /** Libellé lisible du média (« SSD NVMe », « Disque amovible »…). */
  kind: string
  /** Code stable (`ssd`, `hdd`, `removable`, `unknown`). */
  kindCode?: string
  filesystem?: string | null
  totalBytes: number
  usedBytes: number
  freeBytes: number
  isRemovable?: boolean
  accent: string
}

/** Dossier d'accès rapide proposé par le moteur (`user_folders`). */
export interface UserFolder {
  id: string
  label: string
  path: string
}

export interface FileEntry {
  name: string
  path: string
  parent: string | null
  extension: string | null
  category: FileCategory
  /** Libellé de type affiché (« Document PDF », « Dossier de fichiers »…). */
  type: string
  sizeBytes: number
  createdAtMs: number | null
  modifiedAtMs: number | null
  accessedAtMs: number | null
  isDirectory: boolean
  isSymlink: boolean
  /** Dossier ou fichier système sensible : affiché, jamais parcouru. */
  isProtected: boolean
  /** Métadonnées illisibles (droits refusés) : l'entrée reste visible. */
  accessDenied: boolean
  attributes: FileAttributes
}

/** Options de listage d'un dossier. */
export interface ListOptions {
  includeHidden?: boolean
  includeSystem?: boolean
  directoriesFirst?: boolean
  maxEntries?: number
}

export interface DirectoryListing {
  path: string
  parent: string | null
  entries: FileEntry[]
  /** Nombre d'entrées réellement présentes (avant filtres et plafond). */
  total: number
  truncated: boolean
  denied: number
  isProtected: boolean
}

/** Options d'un parcours récursif (recherche, inventaire). */
export interface WalkOptions {
  maxDepth?: number
  maxResults?: number
  maxEntries?: number
  includeHidden?: boolean
  includeSystem?: boolean
  search?: string
  category?: FileCategory | 'all'
  minSizeBytes?: number
  directoriesOnly?: boolean
}

export interface WalkStats {
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

export interface WalkResult {
  root: string
  entries: FileEntry[]
  stats: WalkStats
}

/** Progression d'un parcours en cours. */
export interface ScanProgress {
  scanId: string
  visited: number
  matched: number
  current: string
  elapsedMs: number
}

export interface WalkRequest {
  /** Identifiant opaque, généré par l'interface (sert à l'annulation). */
  scanId: string
  root: string
  options?: WalkOptions
}

/** Ordre d'affichage de l'explorateur. */
export type FileSortKey = 'name' | 'type' | 'size' | 'modified'
export type SortDirection = 'asc' | 'desc'

export type AppState = 'installed' | 'system'

export interface InstalledApp {
  id: string
  name: string
  publisher: string
  version: string
  installedAt: string
  sizeLabel: string
  installerType: string
  state: AppState
}

export interface Residue {
  id: string
  name: string
  type: string
  path: string
  appLabel: string
  confidence: Confidence
  action: string
}

export type HistoryKind = 'inventory' | 'uninstall' | 'analysis' | 'monitoring'

export interface HistoryEntry {
  id: string
  date: string
  name: string
  detail: string
  result: string
  kind: HistoryKind
}

export interface SnapshotSummary {
  id: string
  label: string
  createdAt: string
  scope: string
  entryCount: number
}

export interface SnapshotDiff {
  snapshotId: string
  comparedToId: string
  added: number
  removed: number
  modified: number
  sizeDeltaBytes: number
}

export interface UninstallPlan {
  appId: string
  /** Commande prévue, toujours affichée à l'utilisateur avant exécution. */
  command: string
  requiresElevation: boolean
  expectedResidues: number
}

export interface CleanupPlan {
  residueIds: string[]
  estimatedBytes: number
  recoverable: boolean
  blockedReason?: string
}

export type SystemCapability =
  | 'volumes'
  | 'fileInventory'
  | 'installedApps'
  | 'uninstall'
  | 'residueScan'
  | 'monitoring'
  | 'reports'

export interface SystemCapabilities {
  mode: EngineMode
  capabilities: Record<SystemCapability, boolean>
  elevation: 'none' | 'optional' | 'required'
  /** Vrai uniquement lorsqu'un accès réel au système est possible. */
  realSystemAccess: boolean
}

export interface PageOptions {
  offset?: number
  limit?: number
}

export interface Paged<T> {
  items: T[]
  total: number
  offset: number
  limit: number
}

export interface AppQuery extends PageOptions {
  search?: string
  publisher?: string
}

export interface Settings {
  theme: 'dark' | 'light'
  language: 'fr' | 'en'
  includeHiddenFiles: boolean
  confirmBeforeAction: boolean
  excludeSharedAndSystem: boolean
  reportsFolder: string | null
  historyRetention: 'never' | '30d' | '90d' | '1y'
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'dark',
  language: 'fr',
  includeHiddenFiles: false,
  confirmBeforeAction: true,
  excludeSharedAndSystem: true,
  reportsFolder: null,
  historyRetention: 'never',
}
