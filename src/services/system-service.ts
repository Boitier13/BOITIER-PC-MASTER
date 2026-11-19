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
  SystemCapability,
  UninstallPlan,
  Volume,
} from '@/domain/types'

/**
 * Contrat unique entre l'interface et le moteur système.
 *
 * Deux implémentations coexistent :
 *  - `MockSystemService`  : données de démonstration, aucun accès système ;
 *  - `TauriSystemService` : commandes Rust (moteur Windows réel, à venir).
 *
 * Règles de conception :
 *  - toutes les lectures sont asynchrones (compatibles IPC) ;
 *  - aucune opération destructive n'est exposée sans plan préalable explicite
 *    (`UninstallPlan`, `CleanupPlan`) ;
 *  - une capacité non disponible lève `ServiceError` avec un code stable, que
 *    l'interface traduit en message utilisateur — jamais de silence.
 */

export type ServiceErrorCode =
  | 'not_available' // capacité absente du moteur courant
  | 'unimplemented' // prévu, pas encore développé (phase ultérieure)
  | 'not_tauri' // appel système hors runtime Tauri
  | 'ipc_failure' // la commande Rust a échoué
  | 'invalid_argument'

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly capability?: SystemCapability

  constructor(code: ServiceErrorCode, message: string, capability?: SystemCapability) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.capability = capability
  }

  /** Message destiné à la modale de l'interface. */
  get userMessage(): string {
    switch (this.code) {
      case 'not_tauri':
        return "Le moteur système Windows n'est disponible que dans l'application de bureau."
      case 'unimplemented':
        return "Cette opération n'est pas encore implémentée dans le moteur système. Aucune action n'a été effectuée."
      case 'ipc_failure':
        return "Le moteur système a renvoyé une erreur. Aucune action n'a été effectuée."
      case 'invalid_argument':
        return 'La demande est invalide et a été refusée par le moteur système.'
      case 'not_available':
      default:
        return "Le moteur système Windows n'est pas encore connecté. Cette interface reste une démonstration : aucune opération réelle n'a été effectuée."
    }
  }
}

export interface SystemService {
  readonly mode: EngineMode

  getCapabilities(): Promise<SystemCapabilities>
  ping(): Promise<string>

  listVolumes(): Promise<Volume[]>
  listEntries(query: EntryQuery): Promise<Paged<FileEntry>>
  searchEntries(query: EntryQuery): Promise<Paged<FileEntry>>

  listInstalledApps(query?: AppQuery): Promise<Paged<InstalledApp>>
  listResidues(appId?: string): Promise<Residue[]>
  listHistory(): Promise<HistoryEntry[]>

  listSnapshots(): Promise<SnapshotSummary[]>
  compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  /**
   * Prépare une désinstallation mais ne l'exécute pas.
   * Phase 1 : déclaré, non implémenté — aucune commande n'est lancée.
   */
  requestUninstall(appId: string): Promise<UninstallPlan>

  /** Prépare un nettoyage (plan + estimation), sans rien supprimer. */
  planCleanup(residueIds: string[]): Promise<CleanupPlan>
}
