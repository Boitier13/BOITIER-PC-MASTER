import type { EngineMode, SystemCapabilities } from '@/domain/types'
import type {
  AppQuery,
  CleanupPlan,
  EntryQuery,
  FileEntry,
  HistoryEntry,
  InstalledApp,
  Paged,
  Residue,
  Settings,
  SnapshotDiff,
  SnapshotSummary,
  UninstallPlan,
  Volume,
} from '@/domain/types'
import { COMMANDS, type EngineStatusPayload } from '@/ipc/contracts'
import { invokeCommand } from '@/ipc/client'
import { ServiceError, type SystemService } from '@/services/system-service'

/**
 * Moteur Windows réel (Tauri 2).
 *
 * Phase 1 — périmètre volontairement limité :
 *  - `getCapabilities` et `ping` interrogent réellement le socle Rust ;
 *  - toute lecture système lève `ServiceError('unimplemented')`, traduite par
 *    l'interface en message explicite. Aucun accès disque, registre, processus
 *    ou privilège n'est demandé à ce stade.
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
    throw this.notImplemented('volumes')
  }

  async listEntries(query: EntryQuery): Promise<Paged<FileEntry>> {
    throw this.notImplemented('fileInventory')
  }

  async searchEntries(query: EntryQuery): Promise<Paged<FileEntry>> {
    throw this.notImplemented('fileInventory')
  }

  async listInstalledApps(query?: AppQuery): Promise<Paged<InstalledApp>> {
    throw this.notImplemented('installedApps')
  }

  async listResidues(appId?: string): Promise<Residue[]> {
    throw this.notImplemented('residueScan')
  }

  async listHistory(): Promise<HistoryEntry[]> {
    throw this.notImplemented('reports')
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    throw this.notImplemented('reports')
  }

  async compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff> {
    throw this.notImplemented('reports')
  }

  async getSettings(): Promise<Settings> {
    throw this.notImplemented('reports')
  }

  async saveSettings(settings: Settings): Promise<void> {
    throw this.notImplemented('reports')
  }

  async requestUninstall(appId: string): Promise<UninstallPlan> {
    throw this.notImplemented('uninstall')
  }

  async planCleanup(residueIds: string[]): Promise<CleanupPlan> {
    throw this.notImplemented('residueScan')
  }

  private notImplemented(capability: keyof SystemCapabilities['capabilities']): ServiceError {
    return new ServiceError(
      'unimplemented',
      `Commande système non implémentée en phase 1 : ${capability}`,
      capability,
    )
  }
}
