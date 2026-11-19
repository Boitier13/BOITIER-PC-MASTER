/**
 * Modèle de domaine de BOITIER PC MASTER.
 *
 * Ces types sont partagés par l'interface, le moteur de démonstration et, à
 * terme, le moteur Windows réel (commandes Tauri). Ils ne dépendent d'aucune
 * bibliothèque : ni React, ni Tauri.
 *
 * Phase 1 : les tailles et dates restent des libellés localisés (`sizeLabel`,
 * `modifiedAt`) afin de préserver à l'identique l'affichage existant. Le passage
 * à des octets (`u64`) et à l'ISO 8601 est prévu en phase 2, en même temps que
 * le stockage SQLite.
 */

export type EngineMode = 'demo' | 'system'

/** Niveau de confiance d'un résidu potentiel. */
export type Confidence = 'high' | 'medium' | 'low' | 'system'

/** Nature d'un élément détecté. */
export type ElementType = 'file' | 'folder' | 'registry' | 'shared' | 'service' | 'task'

export interface Volume {
  id: string
  letter: string
  label: string
  kind: string
  totalGb: number
  usedGb: number
  freeGb: number
  accent: string
}

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

export interface FileEntry {
  id: string
  name: string
  /** Libellé de type affiché (« Document PDF », « Dossier de fichiers »…). */
  type: string
  /**
   * Donnée prête pour l'explorateur réel. Volontairement NON utilisée par
   * l'affichage de la phase 1 : la maquette déduisait le type de l'index de la
   * ligne (bug B2 de l'audit), comportement conservé à l'identique.
   */
  isDirectory: boolean
  sizeLabel: string
  modifiedAt: string
  path: string
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

export interface EntryQuery extends PageOptions {
  search?: string
  /** Filtre de type tel que proposé par l'explorateur (libellé). */
  typeFilter?: string
  volumeId?: string
  minSizeGb?: number
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
