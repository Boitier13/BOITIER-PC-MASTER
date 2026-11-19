import { withEntryType } from '@/domain/file-entry'
import type {
  AppQuery,
  CleanupPlan,
  DirectoryListing,
  EngineMode,
  FileCategory,
  FileEntry,
  HistoryEntry,
  InstalledApp,
  ListOptions,
  Paged,
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
  type DirectoryListingPayload,
  type EngineStatusPayload,
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

function mapWalkResult(payload: WalkResultPayload): WalkResult {
  return {
    root: payload.root,
    entries: payload.entries.map(mapEntry),
    stats: { ...payload.stats },
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

  async listInstalledApps(query?: AppQuery): Promise<Paged<InstalledApp>> {
    throw this.notImplemented('installedApps', query)
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
