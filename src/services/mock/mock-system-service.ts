import { demoWorkspace } from '@/data/workspace'
import { DEFAULT_SETTINGS } from '@/domain/types'
import type {
  AppQuery,
  CleanupPlan,
  EngineMode,
  EntryQuery,
  FileEntry,
  HistoryEntry,
  InstalledApp,
  Paged,
  Residue,
  Settings,
  SnapshotDiff,
  SnapshotSummary,
  SystemCapabilities,
  UninstallPlan,
  Volume,
} from '@/domain/types'
import { ServiceError, type SystemService } from '@/services/system-service'

const NOT_IMPLEMENTED_CAPABILITIES: SystemCapabilities['capabilities'] = {
  volumes: false,
  fileInventory: false,
  installedApps: false,
  uninstall: false,
  residueScan: false,
  monitoring: false,
  reports: false,
}

function paginate<T>(items: T[], offset = 0, limit = items.length): Paged<T> {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
  }
}

/**
 * Moteur de démonstration.
 *
 * Le comportement est strictement celui de la maquette validée : mêmes
 * collections, mêmes filtres par sous-chaîne, aucun accès au système, aucun
 * appel réseau.
 */
export class MockSystemService implements SystemService {
  readonly mode: EngineMode = 'demo'
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private readonly workspace = demoWorkspace

  async getCapabilities(): Promise<SystemCapabilities> {
    return {
      mode: 'demo',
      capabilities: { ...NOT_IMPLEMENTED_CAPABILITIES },
      elevation: 'none',
      realSystemAccess: false,
    }
  }

  async ping(): Promise<string> {
    return 'demo'
  }

  async listVolumes(): Promise<Volume[]> {
    return [...this.workspace.volumes]
  }

  async listEntries(query: EntryQuery): Promise<Paged<FileEntry>> {
    return this.searchEntries(query)
  }

  async searchEntries(query: EntryQuery): Promise<Paged<FileEntry>> {
    const search = (query.search ?? '').trim().toLowerCase()
    const typeFilter = query.typeFilter ?? 'Tous les éléments'

    const filtered = this.workspace.entries.filter((entry) => {
      const matchesSearch = entry.name.toLowerCase().includes(search)
      const matchesType = typeFilter === 'Tous les éléments' || entry.type.includes(typeFilter)
      return matchesSearch && matchesType
    })

    return paginate(filtered, query.offset, query.limit)
  }

  async listInstalledApps(query: AppQuery = {}): Promise<Paged<InstalledApp>> {
    const search = (query.search ?? '').trim().toLowerCase()
    const filtered = this.workspace.apps.filter((app) =>
      `${app.name} ${app.publisher}`.toLowerCase().includes(search),
    )
    return paginate(filtered, query.offset, query.limit)
  }

  async listResidues(): Promise<Residue[]> {
    return [...this.workspace.residues]
  }

  async listHistory(): Promise<HistoryEntry[]> {
    return [...this.workspace.history]
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    // Aucun instantané conservé : la persistance (SQLite) arrive en phase 2.
    return []
  }

  async compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff> {
    throw new ServiceError('unimplemented', 'La comparaison d’instantanés n’est pas encore disponible.')
  }

  async getSettings(): Promise<Settings> {
    return { ...this.settings }
  }

  async saveSettings(settings: Settings): Promise<void> {
    this.settings = { ...settings }
  }

  async requestUninstall(appId: string): Promise<UninstallPlan> {
    throw new ServiceError('unimplemented', 'La désinstallation réelle n’est pas encore implémentée.', 'uninstall')
  }

  async planCleanup(residueIds: string[]): Promise<CleanupPlan> {
    throw new ServiceError('unimplemented', 'Le nettoyage de résidus n’est pas encore implémenté.', 'residueScan')
  }
}
