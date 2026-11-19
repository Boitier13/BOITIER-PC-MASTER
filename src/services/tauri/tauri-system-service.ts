import { withEntryType } from '@/domain/file-entry'
import type {
  AnalysisReport,
  AnalysisRequest,
  AppInfo,
  AppInventory,
  AppListQuery,
  CleanupPlan,
  DirectoryListing,
  EngineMode,
  FileCategory,
  FileEntry,
  HistoryEntry,
  InstalledApp,
  ListOptions,
  Residue,
  Settings,
  SnapshotDiff,
  SnapshotSummary,
  SystemCapabilities,
  UninstallPlan,
  UserFolder,
  Volume,
  WalkRequest,
  WalkResult,
} from '@/domain/types'
import {
  COMMANDS,
  EVENTS,
  type AnalysisReportPayload,
  type AnalysisRequestPayload,
  type AppInventoryPayload,
  type AppInfoPayload,
  type DirectoryListingPayload,
  type EngineStatusPayload,
  type InstalledAppPayload,
  type FileEntryPayload,
  type ScanProgressPayload,
  type UserFolderPayload,
  type VolumePayload,
  type WalkResultPayload,
} from '@/ipc/contracts'
import { invokeCommand, listenEvent } from '@/ipc/client'
import { ServiceError, type SystemService, type WalkHandlers } from '@/services/system-service'

const VOLUME_ACCENTS = ['#4388ff', '#20c5d7', '#8b78ef', '#e5a345', '#65ca98', '#d978c8']

const VOLUME_KIND_LABELS: Record<string, string> = {
  ssd: 'SSD',
  hdd: 'Disque dur',
  removable: 'Disque amovible',
  unknown: 'Disque local',
}

const KNOWN_CATEGORIES: FileCategory[] = [
  'folder',
  'document',
  'image',
  'video',
  'audio',
  'archive',
  'application',
  'system',
  'other',
]

function mapCategory(value: string): FileCategory {
  return (KNOWN_CATEGORIES as string[]).includes(value) ? (value as FileCategory) : 'other'
}

function mapEntry(payload: FileEntryPayload): FileEntry {
  return withEntryType({
    name: payload.name,
    path: payload.path,
    parent: payload.parent,
    extension: payload.extension,
    category: mapCategory(payload.category),
    sizeBytes: payload.sizeBytes,
    createdAtMs: payload.createdAtMs,
    modifiedAtMs: payload.modifiedAtMs,
    accessedAtMs: payload.accessedAtMs,
    isDirectory: payload.isDirectory,
    isSymlink: payload.isSymlink,
    isProtected: payload.isProtected,
    accessDenied: payload.accessDenied,
    attributes: { ...payload.attributes },
  })
}

function mapListing(payload: DirectoryListingPayload): DirectoryListing {
  return {
    path: payload.path,
    parent: payload.parent,
    entries: payload.entries.map(mapEntry),
    total: payload.total,
    truncated: payload.truncated,
    denied: payload.denied,
    isProtected: payload.isProtected,
  }
}

function mapAnalysis(payload: AnalysisReportPayload): AnalysisReport {
  return {
    root: payload.root,
    scannedAtMs: payload.scannedAtMs,
    elapsedMs: payload.elapsedMs,
    files: payload.files,
    folders: payload.folders,
    totalSizeBytes: payload.totalSizeBytes,
    visited: payload.visited,
    denied: payload.denied,
    skippedProtected: payload.skippedProtected,
    truncated: payload.truncated,
    cancelled: payload.cancelled,
    byCategory: payload.byCategory.map((item) => ({
      category: mapCategory(item.category),
      files: item.files,
      bytes: item.bytes,
    })),
    topFolders: payload.topFolders.map((folder) => ({ ...folder })),
    largestFiles: payload.largestFiles.map((file) => ({
      ...file,
      category: mapCategory(file.category),
    })),
  }
}

function mapWalkResult(payload: WalkResultPayload): WalkResult {
  return {
    root: payload.root,
    entries: payload.entries.map(mapEntry),
    stats: { ...payload.stats },
  }
}

const INSTALLER_TYPES: InstalledApp['installerType'][] = ['msi', 'exe', 'msix', 'unknown']

function mapInstallerType(value: string): InstalledApp['installerType'] {
  return (INSTALLER_TYPES as string[]).includes(value) ? (value as InstalledApp['installerType']) : 'unknown'
}

function mapScope(value: string): InstalledApp['scope'] {
  return value === 'user' ? 'user' : 'machine'
}

function mapArchitecture(value: string): InstalledApp['architecture'] {
  return value === 'x86' || value === 'arm64' ? value : value === 'x64' ? 'x64' : 'unknown'
}

function mapApp(payload: InstalledAppPayload): InstalledApp {
  return {
    id: payload.id,
    name: payload.name,
    publisher: payload.publisher,
    version: payload.version,
    installedAtMs: payload.installedAtMs,
    sizeBytes: payload.sizeBytes,
    installLocation: payload.installLocation,
    uninstallString: payload.uninstallString,
    quietUninstallString: payload.quietUninstallString,
    productCode: payload.productCode,
    installerType: mapInstallerType(payload.installerType),
    scope: mapScope(payload.scope),
    architecture: mapArchitecture(payload.architecture),
    hasUninstaller: payload.hasUninstaller,
    registryPath: payload.registryPath,
  }
}

function mapInventory(payload: AppInventoryPayload): AppInventory {
  return {
    items: payload.items.map(mapApp),
    total: payload.total,
    offset: payload.offset,
    limit: payload.limit,
    sources: payload.sources.map((source) => ({ ...source })),
    scannedAtMs: payload.scannedAtMs,
  }
}

/**
 * Moteur Windows réel (Tauri 2) — **lecture seule**.
 *
 * Commandes branchées en phase 3 :
 *  - `volumes_list`, `user_folders` : inventaire des lecteurs et accès rapides ;
 *  - `directory_list`, `path_metadata` : exploration d'un dossier ;
 *  - `walk_start`, `walk_cancel` : parcours récursif annulable, avec progression.
 *
 * Aucune commande d'écriture, de suppression, de déplacement ou de renommage
 * n'existe côté Rust : ce service ne peut donc pas modifier le disque, même en
 * cas de bug de l'interface.
 */
export class TauriSystemService implements SystemService {
  readonly mode: EngineMode = 'system'

  async getAppInfo(): Promise<AppInfo> {
    return invokeCommand<AppInfoPayload>(COMMANDS.appInfo)
  }

  async getCapabilities(): Promise<SystemCapabilities> {
    const status = await invokeCommand<EngineStatusPayload>(COMMANDS.engineStatus)
    return {
      mode: status.mode,
      capabilities: status.capabilities,
      elevation: status.elevation,
      realSystemAccess: status.realSystemAccess,
    }
  }

  async ping(): Promise<string> {
    return invokeCommand<string>(COMMANDS.ping)
  }

  async listVolumes(): Promise<Volume[]> {
    const payloads = await invokeCommand<VolumePayload[]>(COMMANDS.volumesList)
    return payloads.map((payload, index) => ({
      id: `volume-${(payload.letter || payload.mountPoint).replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || index}`,
      letter: payload.letter || payload.mountPoint,
      label: payload.label,
      kind: VOLUME_KIND_LABELS[payload.kind] ?? payload.kind,
      kindCode: payload.kind,
      filesystem: payload.filesystem,
      totalBytes: payload.totalBytes,
      usedBytes: payload.usedBytes,
      freeBytes: payload.freeBytes,
      isRemovable: payload.isRemovable,
      accent: VOLUME_ACCENTS[index % VOLUME_ACCENTS.length],
    }))
  }

  async listUserFolders(): Promise<UserFolder[]> {
    const payloads = await invokeCommand<UserFolderPayload[]>(COMMANDS.userFolders)
    return payloads.map((payload) => ({ id: payload.id, label: payload.label, path: payload.path }))
  }

  async listDirectory(path: string, options?: ListOptions): Promise<DirectoryListing> {
    const payload = await invokeCommand<DirectoryListingPayload>(COMMANDS.directoryList, {
      path,
      options: options ?? null,
    })
    return mapListing(payload)
  }

  async getEntryMetadata(path: string): Promise<FileEntry> {
    const payload = await invokeCommand<FileEntryPayload>(COMMANDS.pathMetadata, { path })
    return mapEntry(payload)
  }

  async walk(request: WalkRequest, handlers: WalkHandlers = {}): Promise<WalkResult> {
    const { onProgress, signal } = handlers
    const unlisten = onProgress
      ? await listenEvent<ScanProgressPayload>(EVENTS.scanProgress, (payload) => {
          if (payload.scanId === request.scanId) onProgress(payload)
        })
      : () => {}

    const abort = () => {
      void invokeCommand<boolean>(COMMANDS.walkCancel, { scanId: request.scanId }).catch(() => {
        /* L'annulation est un meilleur effort : le parcours reste borné. */
      })
    }

    signal?.addEventListener('abort', abort)

    try {
      const payload = await invokeCommand<WalkResultPayload>(COMMANDS.walkStart, {
        scanId: request.scanId,
        root: request.root,
        options: request.options ?? null,
      })
      return mapWalkResult(payload)
    } catch (error) {
      if (signal?.aborted) {
        throw new ServiceError('cancelled', 'Parcours annulé.', undefined, 'cancelled')
      }
      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
      unlisten()
    }
  }

  /**
   * Mesure d'espace agrégée (`analysis_scan`).
   *
   * Même canal de progression et même jeton d'annulation que l'exploration :
   * `walk_cancel` arrête indifféremment un parcours ou une mesure.
   */
  async analyze(request: AnalysisRequest, handlers: WalkHandlers = {}): Promise<AnalysisReport> {
    const { onProgress, signal } = handlers
    const scanId = `analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

    const unlisten = onProgress
      ? await listenEvent<ScanProgressPayload>(EVENTS.scanProgress, (payload) => {
          if (payload.scanId === scanId) onProgress(payload)
        })
      : () => {}

    const abort = () => {
      void invokeCommand<boolean>(COMMANDS.walkCancel, { scanId }).catch(() => {
        /* Meilleur effort : la mesure reste bornée par `maxEntries`. */
      })
    }

    signal?.addEventListener('abort', abort)

    try {
      const payload: AnalysisRequestPayload = { root: request.root }
      if (request.maxEntries !== undefined) payload.maxEntries = request.maxEntries
      if (request.maxDepth !== undefined) payload.maxDepth = request.maxDepth
      const report = await invokeCommand<AnalysisReportPayload>(COMMANDS.analysisScan, {
        scanId,
        request: payload,
      })
      return mapAnalysis(report)
    } catch (error) {
      if (signal?.aborted) {
        throw new ServiceError('cancelled', 'Mesure annulée.', undefined, 'cancelled')
      }
      throw error
    } finally {
      signal?.removeEventListener('abort', abort)
      unlisten()
    }
  }

  /**
   * Inventaire réel des applications (registre Windows, lecture seule).
   *
   * Le filtrage, le tri et la pagination sont faits par le moteur : l'interface
   * n'a jamais à manipuler l'inventaire complet d'un poste chargé.
   */
  async listInstalledApps(query: AppListQuery = {}): Promise<AppInventory> {
    const payload = await invokeCommand<AppInventoryPayload>(COMMANDS.appsList, { query })
    return mapInventory(payload)
  }

  async listResidues(appId?: string): Promise<Residue[]> {
    throw this.notImplemented('residueScan', appId)
  }

  async listHistory(): Promise<HistoryEntry[]> {
    throw this.notImplemented('reports')
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    throw this.notImplemented('reports')
  }

  async compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff> {
    throw this.notImplemented('reports', idA, idB)
  }

  async getSettings(): Promise<Settings> {
    throw this.notImplemented('reports')
  }

  async saveSettings(settings: Settings): Promise<void> {
    throw this.notImplemented('reports', settings.theme)
  }

  async requestUninstall(appId: string): Promise<UninstallPlan> {
    throw this.notImplemented('uninstall', appId)
  }

  async planCleanup(residueIds: string[]): Promise<CleanupPlan> {
    throw this.notImplemented('residueScan', residueIds.length)
  }

  private notImplemented(
    capability: keyof SystemCapabilities['capabilities'],
    ..._context: unknown[]
  ): ServiceError {
    return new ServiceError(
      'unimplemented',
      `Commande système non implémentée dans cette phase : ${capability}`,
      capability,
    )
  }
}
