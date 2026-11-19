import type {
  AnalysisReport,
  AnalysisRequest,
  AppInfo,
  AppInventory,
  AppListQuery,
  CleanupPlan,
  DirectoryListing,
  EngineMode,
  FileEntry,
  HistoryEntry,
  InstalledApp,
  ListOptions,
  Residue,
  ScanProgress,
  Settings,
  SnapshotDiff,
  SnapshotSummary,
  SystemCapabilities,
  SystemCapability,
  UninstallPlan,
  UserFolder,
  Volume,
  WalkRequest,
  WalkResult,
} from '@/domain/types'

/**
 * Contrat unique entre l'interface et le moteur système.
 *
 * Deux implémentations coexistent :
 *  - `MockSystemService`   : arborescence de démonstration, aucun accès disque ;
 *  - `TauriSystemService`  : moteur Rust réel, en **lecture seule**.
 *
 * Règles de conception :
 *  - toutes les lectures sont asynchrones (compatibles IPC) ;
 *  - aucune opération destructive n'existe dans ce contrat : il n'y a ni
 *    `delete`, ni `move`, ni `rename`, ni `write`. Une désinstallation ou un
 *    nettoyage ne peuvent être que *planifiés* (`UninstallPlan`,
 *    `CleanupPlan`), et l'exécution n'est prévue par aucune version ;
 *  - une capacité indisponible lève `ServiceError` avec un code stable, que
 *    l'interface traduit en message utilisateur — jamais de silence.
 */

export type ServiceErrorCode =
  | 'not_available' // capacité absente du moteur courant
  | 'unimplemented' // prévu, pas encore développé (phase ultérieure)
  | 'not_tauri' // appel système hors runtime Tauri
  | 'ipc_failure' // la commande Rust a échoué
  | 'invalid_argument'
  | 'not_found' // chemin inexistant
  | 'access_denied' // droits refusés par Windows
  | 'not_a_directory' // chemin valide mais pas un dossier
  | 'cancelled' // parcours annulé par l'utilisateur

export class ServiceError extends Error {
  readonly code: ServiceErrorCode
  readonly capability?: SystemCapability
  /** Code brut renvoyé par le moteur Rust, conservé pour le diagnostic. */
  readonly engineCode?: string

  constructor(
    code: ServiceErrorCode,
    message: string,
    capability?: SystemCapability,
    engineCode?: string,
  ) {
    super(message)
    this.name = 'ServiceError'
    this.code = code
    this.capability = capability
    this.engineCode = engineCode
  }

  /** Message destiné à la modale ou au bandeau de l'interface. */
  get userMessage(): string {
    switch (this.code) {
      case 'not_tauri':
        return "Le moteur système Windows n'est disponible que dans l'application de bureau."
      case 'unimplemented':
        return "Cette opération n'est pas encore implémentée dans le moteur système. Aucune action n'a été effectuée."
      case 'ipc_failure':
        return 'Le moteur système a renvoyé une erreur. Aucune action n’a été effectuée.'
      case 'invalid_argument':
        return 'La demande est invalide et a été refusée par le moteur système.'
      case 'not_found':
        return 'Cet emplacement n’existe plus ou a été renommé.'
      case 'access_denied':
        return 'Windows refuse l’accès à cet emplacement (droits insuffisants). Aucun fichier n’a été modifié.'
      case 'not_a_directory':
        return 'Cet élément n’est pas un dossier.'
      case 'cancelled':
        return 'L’opération a été annulée. Aucun fichier n’a été modifié.'
      case 'not_available':
      default:
        return "Le moteur système Windows n'est pas encore connecté. Cette interface reste une démonstration : aucune opération réelle n'a été effectuée."
    }
  }
}

/** Rappels optionnels d'un parcours (progression + annulation). */
export interface WalkHandlers {
  onProgress?: (progress: ScanProgress) => void
  signal?: AbortSignal
}

export interface SystemService {
  readonly mode: EngineMode

  /** Informations du binaire (nom, version, plateforme) — jamais devinées. */
  getAppInfo(): Promise<AppInfo>
  getCapabilities(): Promise<SystemCapabilities>
  /** Aller-retour IPC minimal : sert au diagnostic de connexion. */
  ping(): Promise<string>

  /* --- Exploration (lecture seule) --------------------------------- */
  listVolumes(): Promise<Volume[]>
  /** Dossiers d'accès rapide (Bureau, Documents, Téléchargements…). */
  listUserFolders(): Promise<UserFolder[]>
  /** Contenu immédiat d'un dossier. */
  listDirectory(path: string, options?: ListOptions): Promise<DirectoryListing>
  /** Métadonnées d'un chemin précis (fichier ou dossier). */
  getEntryMetadata(path: string): Promise<FileEntry>
  /**
   * Parcours récursif borné, avec progression et annulation.
   * Ne modifie rien : c'est un inventaire en lecture seule.
   */
  walk(request: WalkRequest, handlers?: WalkHandlers): Promise<WalkResult>
  /**
   * Mesure d'espace bornée d'une racine, en lecture seule.
   *
   * La racine est toujours désignée par l'appelant : ce contrat n'invente
   * jamais de périmètre. Le rapport indique ce qui n'a pas pu être mesuré.
   */
  analyze(request: AnalysisRequest, handlers?: WalkHandlers): Promise<AnalysisReport>

  /* --- Applications et résidus (phases ultérieures) ----------------- */
  listInstalledApps(query?: AppListQuery): Promise<AppInventory>
  listResidues(appId?: string): Promise<Residue[]>
  listHistory(): Promise<HistoryEntry[]>

  listSnapshots(): Promise<SnapshotSummary[]>
  compareSnapshots(idA: string, idB: string): Promise<SnapshotDiff>

  getSettings(): Promise<Settings>
  saveSettings(settings: Settings): Promise<void>

  /**
   * Prépare une désinstallation mais ne l'exécute pas.
   * Aucune version n'exécute de désinstallation.
   */
  requestUninstall(appId: string): Promise<UninstallPlan>

  /** Prépare un nettoyage (plan + estimation), sans rien supprimer. */
  planCleanup(residueIds: string[]): Promise<CleanupPlan>
}
