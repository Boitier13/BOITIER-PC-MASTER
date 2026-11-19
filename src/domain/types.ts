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
  /** Plafond du moteur ; borne également `limit`. */
  maxEntries?: number
  /** Décalage de pagination, appliqué après le tri du moteur. */
  offset?: number
  /** Taille de page demandée (défaut : tout ce qui est retenu). */
  limit?: number
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
  /** Entrées retenues après filtres et plafond, avant pagination. */
  matched?: number
  /** Décalage effectif de la page renvoyée. */
  offset?: number
  /** Nombre d'entrées renvoyées dans cette page. */
  returned?: number
  /** `true` s'il reste des entrées après cette page. */
  hasMore?: boolean
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

/* ------------------------------------------------------------------ */
/* Mesure d'espace (commande `analysis_scan`)                          */
/* ------------------------------------------------------------------ */

/**
 * Rapport de mesure d'une racine.
 *
 * Un rapport n'est **jamais** présenté comme complet par défaut : `truncated`,
 * `cancelled`, `denied` et `skippedProtected` disent ce qui n'a pas été vu.
 */
export interface AnalysisReport {
  root: string
  scannedAtMs: number
  elapsedMs: number
  files: number
  folders: number
  totalSizeBytes: number
  visited: number
  denied: number
  skippedProtected: number
  truncated: boolean
  cancelled: boolean
  byCategory: AnalysisCategory[]
  topFolders: AnalysisFolder[]
  largestFiles: AnalysisFile[]
}

export interface AnalysisCategory {
  category: FileCategory
  files: number
  bytes: number
}

/** Dossier classé par la taille de son contenu **direct** mesuré. */
export interface AnalysisFolder {
  path: string
  bytes: number
  files: number
}

export interface AnalysisFile {
  name: string
  path: string
  bytes: number
  modifiedAtMs: number | null
  category: FileCategory
}

export interface AnalysisRequest {
  /** Racine explicite : aucun parcours n'est lancé sans elle. */
  root: string
  maxEntries?: number
  maxDepth?: number
}

/**
 * Opération réellement exécutée pendant la session.
 *
 * Alimente l'historique : rien n'y entre qui n'ait été mesuré. L'ensemble n'est
 * pas persisté et disparaît à la fermeture de l'application.
 */
export interface SessionEntry {
  id: string
  atMs: number
  kind: HistoryKind
  name: string
  detail: string
  result: string
}

/** Ordre d'affichage de l'explorateur. */
export type FileSortKey = 'name' | 'type' | 'size' | 'modified'
export type SortDirection = 'asc' | 'desc'

export type AppState = 'installed' | 'system'

/**
 * Application installée, telle que lue dans le registre Windows.
 *
 * Toutes les valeurs peuvent être inconnues : une information absente reste
 * `null`, elle n'est jamais remplacée par une valeur plausible.
 */
export interface InstalledApp {
  /** Identifiant stable : ruche + chemin exact de la clé de registre. */
  id: string
  name: string
  publisher: string | null
  version: string | null
  /** `InstallDate` (AAAAMMJJ) converti en millisecondes epoch. */
  installedAtMs: number | null
  /** Taille déclarée par Windows (`EstimatedSize`), en octets. */
  sizeBytes: number | null
  installLocation: string | null
  uninstallString: string | null
  quietUninstallString: string | null
  productCode: string | null
  installerType: 'msi' | 'exe' | 'msix' | 'unknown'
  scope: 'machine' | 'user'
  architecture: 'x64' | 'x86' | 'arm64' | 'unknown'
  hasUninstaller: boolean
  /** Chemin de la clé de registre, pour le diagnostic uniquement. */
  registryPath: string
}

/** État d'une ruche de registre interrogée. */
export interface AppSourceStatus {
  id: string
  label: string
  accessible: boolean
  entries: number
  /** Sous-clés refusées par Windows (ACL) : jamais bloquant. */
  denied: number
  error: string | null
}

/** Page d'inventaire, accompagnée de la provenance des données. */
export interface AppInventory extends Paged<InstalledApp> {
  sources: AppSourceStatus[]
  scannedAtMs: number
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
  quietCommand: string | null
  productCode: string | null
  installerType: InstalledApp['installerType']
  requiresElevation: boolean
  expectedResidues: number
  /** Avertissements affichés tels quels (commande absente, chemin introuvable…). */
  warnings: string[]
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

/** Informations du binaire, telles que renvoyées par le moteur Rust. */
export interface AppInfo {
  name: string
  version: string
  platform: string
  arch: string
  engineMode: EngineMode
  realSystemAccess: boolean
}

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

export interface AppListQuery extends PageOptions {
  /** Recherche sur le nom, l'éditeur et la version (accents ignorés). */
  search?: string
  publisher?: string
  scope?: 'machine' | 'user'
  architecture?: 'x64' | 'x86' | 'arm64'
  sort?: 'name' | 'size' | 'date'
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
