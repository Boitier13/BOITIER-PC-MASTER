import { demoWorkspace } from '@/data/workspace'
import {
  DEMO_NODES,
  DEMO_TREE,
  DEMO_USER_FOLDERS,
  DEMO_VOLUMES,
  DEMO_VOLUME_ROOTS,
  demoEntryFromSpec,
  type DemoNodeSpec,
} from '@/data/demo-tree'
import { joinPath, normalizePathKey, parentPathOf } from '@/domain/file-entry'
import { DEFAULT_SETTINGS } from '@/domain/types'
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
  Paged,
  Residue,
  Settings,
  SnapshotDiff,
  SnapshotSummary,
  SystemCapabilities,
  UninstallPlan,
  UserFolder,
  Volume,
  WalkOptions,
  WalkRequest,
  WalkResult,
  WalkStats,
} from '@/domain/types'
import { ServiceError, type SystemService, type WalkHandlers } from '@/services/system-service'

const NOT_IMPLEMENTED_CAPABILITIES: SystemCapabilities['capabilities'] = {
  volumes: false,
  fileInventory: false,
  installedApps: false,
  uninstall: false,
  residueScan: false,
  monitoring: false,
  reports: false,
}

const DEFAULT_LIST_OPTIONS = {
  includeHidden: false,
  includeSystem: true,
  directoriesFirst: true,
  maxEntries: 5_000,
}

/** Dossiers protégés sans contenu lisible dans la démonstration. */
const PROTECTED_PATHS = new Set(
  DEMO_NODES.filter((node) => node.kind === 'dir' && node.protected).map((node) =>
    normalizePathKey(joinPath(node.parent, node.name)),
  ),
)

const DENIED_PATHS = new Set(
  DEMO_NODES.filter((node) => node.denied).map((node) => normalizePathKey(joinPath(node.parent, node.name))),
)

const ROOT_KEYS = new Set(DEMO_VOLUME_ROOTS.map((root) => normalizePathKey(root)))

function paginate<T>(items: T[], offset = 0, limit = items.length): Paged<T> {
  return {
    items: items.slice(offset, offset + limit),
    total: items.length,
    offset,
    limit,
  }
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds)
  })
}

function fullPathOf(spec: DemoNodeSpec): string {
  return joinPath(spec.parent, spec.name)
}

function matchesSearch(entry: FileEntry, search: string): boolean {
  return entry.name.toLowerCase().includes(search)
}

function sortEntries(entries: FileEntry[], directoriesFirst: boolean): FileEntry[] {
  return [...entries].sort((left, right) => {
    if (directoriesFirst && left.isDirectory !== right.isDirectory) {
      return left.isDirectory ? -1 : 1
    }
    return left.name.localeCompare(right.name, 'fr', { numeric: true, sensitivity: 'base' })
  })
}

/**
 * Moteur de démonstration.
 *
 * Il n'accède à aucun disque : il sert une arborescence fictive, mais il
 * applique **les mêmes règles** que le moteur Windows (tri dossiers d'abord,
 * filtres, plafond, dossiers protégés, accès refusés, liens non suivis,
 * progression et annulation). Les écrans se comportent donc identiquement dans
 * les deux modes.
 */
export class MockSystemService implements SystemService {
  readonly mode: EngineMode = 'demo'
  private settings: Settings = { ...DEFAULT_SETTINGS }
  private readonly workspace = demoWorkspace

  async getAppInfo(): Promise<AppInfo> {
    return {
      name: 'BOITIER PC MASTER',
      version: '0.1.0',
      platform: 'demo',
      arch: 'web',
      engineMode: 'demo',
      realSystemAccess: false,
    }
  }

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
    return [...DEMO_VOLUMES]
  }

  async listUserFolders(): Promise<UserFolder[]> {
    return [...DEMO_USER_FOLDERS]
  }

  async listDirectory(path: string, options: ListOptions = {}): Promise<DirectoryListing> {
    // Normalisation explicite : `limit` absent signifie « tout ce qui est
    // retenu », et non « page vide ». Les défauts ne doivent jamais être
    // écrasés par une propriété explicitement indéfinie.
    const settings = {
      includeHidden: options.includeHidden ?? DEFAULT_LIST_OPTIONS.includeHidden,
      includeSystem: options.includeSystem ?? DEFAULT_LIST_OPTIONS.includeSystem,
      directoriesFirst: options.directoriesFirst ?? DEFAULT_LIST_OPTIONS.directoriesFirst,
      maxEntries: options.maxEntries ?? DEFAULT_LIST_OPTIONS.maxEntries,
      offset: Math.max(0, options.offset ?? 0),
      limit: options.limit,
    }
    const key = normalizePathKey(path)

    if (!key) {
      throw new ServiceError('invalid_argument', 'Chemin vide.', undefined, 'invalid_path')
    }

    const fileNode = DEMO_NODES.find((node) => normalizePathKey(fullPathOf(node)) === key)
    if (fileNode && fileNode.kind === 'file') {
      throw new ServiceError('not_a_directory', `Ce chemin n’est pas un dossier : ${path}`, undefined, 'not_a_directory')
    }

    const specs = DEMO_TREE[key]
    const isKnown = Boolean(specs) || ROOT_KEYS.has(key)

    if (!isKnown) {
      if (DENIED_PATHS.has(key) || PROTECTED_PATHS.has(key)) {
        throw new ServiceError('access_denied', `Accès refusé : ${path}`, undefined, 'access_denied')
      }
      throw new ServiceError('not_found', `Chemin introuvable : ${path}`, undefined, 'not_found')
    }

    const raw = specs ?? []
    let entries = raw.map((spec) => demoEntryFromSpec(spec))

    if (!settings.includeHidden) {
      entries = entries.filter((entry) => !entry.attributes.hidden)
    }
    if (!settings.includeSystem) {
      entries = entries.filter((entry) => !entry.attributes.system)
    }

    // Même sémantique que le moteur Rust : tri puis découpe déterministe, page
    // bornée par `maxEntries` pour qu'aucune requête ne renvoie tout le dossier.
    const sorted = sortEntries(entries, settings.directoriesFirst)
    const truncated = sorted.length > settings.maxEntries
    const retained = truncated ? sorted.slice(0, settings.maxEntries) : sorted
    const matched = retained.length
    const offset = Math.min(settings.offset, matched)
    const pageSize = Math.min(settings.limit ?? matched, settings.maxEntries)
    const end = Math.min(offset + pageSize, matched)
    const page = retained.slice(offset, end)

    return {
      path,
      parent: parentPathOf(path),
      entries: page,
      total: raw.length,
      truncated,
      denied: raw.filter((spec) => spec.denied === true).length,
      isProtected: PROTECTED_PATHS.has(key),
      matched,
      offset,
      returned: page.length,
      hasMore: end < matched,
    }
  }

  async getEntryMetadata(path: string): Promise<FileEntry> {
    const key = normalizePathKey(path)
    const spec = DEMO_NODES.find((node) => normalizePathKey(fullPathOf(node)) === key)
    if (spec) return demoEntryFromSpec(spec)

    if (ROOT_KEYS.has(key)) {
      return demoEntryFromSpec({
        parent: path,
        name: path,
        kind: 'dir',
        modifiedAtMs: Date.UTC(2026, 10, 19, 9, 0),
      })
    }

    throw new ServiceError('not_found', `Chemin introuvable : ${path}`, undefined, 'not_found')
  }

  async walk(request: WalkRequest, handlers: WalkHandlers = {}): Promise<WalkResult> {
    const started = Date.now()
    const options: Required<WalkOptions> = {
      maxDepth: 12,
      maxResults: 2_000,
      maxEntries: 200_000,
      includeHidden: false,
      includeSystem: true,
      search: '',
      category: 'all',
      minSizeBytes: 0,
      directoriesOnly: false,
      ...request.options,
    }

    const rootKey = normalizePathKey(request.root)
    if (!DEMO_TREE[rootKey] && !ROOT_KEYS.has(rootKey)) {
      throw new ServiceError('not_found', `Chemin introuvable : ${request.root}`, undefined, 'not_found')
    }

    const search = options.search.trim().toLowerCase()
    const visited: { spec: DemoNodeSpec; depth: number }[] = []
    const stack: { key: string; depth: number }[] = [{ key: rootKey, depth: 0 }]
    let skippedProtected = 0

    while (stack.length > 0) {
      const { key, depth } = stack.pop()!
      for (const spec of DEMO_TREE[key] ?? []) {
        visited.push({ spec, depth })
        if (spec.kind === 'dir' && depth < options.maxDepth) {
          const childKey = normalizePathKey(fullPathOf(spec))
          if (PROTECTED_PATHS.has(childKey) || DENIED_PATHS.has(childKey)) {
            skippedProtected += 1
            continue
          }
          stack.push({ key: childKey, depth: depth + 1 })
        }
      }
    }

    const found: FileEntry[] = []
    let cancelled = false
    let truncated = false
    let denied = 0
    let processed = 0

    for (let index = 0; index < visited.length; index += 1) {
      if (handlers.signal?.aborted) {
        cancelled = true
        break
      }

      if (index % 3 === 0) {
        await delay(8)
        handlers.onProgress?.({
          scanId: request.scanId,
          visited: index,
          matched: found.length,
          current: fullPathOf(visited[index].spec),
          elapsedMs: Date.now() - started,
        })
      }

      processed = index + 1
      const { spec } = visited[index]
      if (spec.denied) {
        denied += 1
        continue
      }

      const entry = demoEntryFromSpec(spec)
      if (!options.includeHidden && entry.attributes.hidden) continue
      if (!options.includeSystem && entry.attributes.system) continue
      if (options.directoriesOnly && !entry.isDirectory) continue
      if (options.category !== 'all' && entry.category !== options.category) continue
      if (options.minSizeBytes > 0 && (entry.isDirectory || entry.sizeBytes < options.minSizeBytes)) continue
      if (search && !matchesSearch(entry, search)) continue

      if (found.length >= options.maxResults) {
        truncated = true
        break
      }
      found.push(entry)
    }

    found.sort((left, right) =>
      left.path.localeCompare(right.path, 'fr', { numeric: true, sensitivity: 'base' }),
    )

    const stats: WalkStats = {
      visited: processed,
      matched: found.length,
      folders: found.filter((entry) => entry.isDirectory).length,
      files: found.filter((entry) => !entry.isDirectory).length,
      denied,
      skippedProtected,
      totalSizeBytes: found.reduce((total, entry) => total + (entry.isDirectory ? 0 : entry.sizeBytes), 0),
      truncated,
      cancelled,
      elapsedMs: Date.now() - started,
    }

    return { root: request.root, entries: found, stats }
  }

  /**
   * Inventaire de démonstration : mêmes filtres et même forme de réponse que
   * le moteur réel, mais aucune lecture du registre.
   */
  async listInstalledApps(query: AppListQuery = {}): Promise<AppInventory> {
    const search = (query.search ?? '').trim().toLowerCase()
    const filtered = this.workspace.apps.filter((app) => {
      if (query.scope && app.scope !== query.scope) return false
      if (!search) return true
      const haystack = `${app.name} ${app.publisher ?? ''} ${app.version ?? ''}`.toLowerCase()
      return haystack.includes(search)
    })
    const sorted = [...filtered].sort((left, right) => {
      if (query.sort === 'size') return (right.sizeBytes ?? 0) - (left.sizeBytes ?? 0)
      if (query.sort === 'date') return (right.installedAtMs ?? 0) - (left.installedAtMs ?? 0)
      return left.name.localeCompare(right.name, 'fr')
    })
    const page = paginate(sorted, query.offset, query.limit ?? sorted.length)
    return {
      ...page,
      sources: [
        {
          id: 'demo',
          label: 'Données de démonstration',
          accessible: true,
          entries: sorted.length,
          denied: 0,
          error: null,
        },
      ],
      scannedAtMs: Date.now(),
    }
  }

  /**
   * Aucune mesure réelle en démonstration.
   *
   * Le moteur de démonstration ne produit volontairement **aucun** rapport :
   * afficher un exemple chiffré reviendrait à présenter une invention comme une
   * mesure. L'interface traduit cette erreur en état d'indisponibilité.
   */
  async analyze(request: AnalysisRequest): Promise<AnalysisReport> {
    throw new ServiceError(
      'not_available',
      `La mesure réelle de « ${request.root} » n'est pas disponible en mode démonstration.`,
      'fileInventory',
    )
  }

  /**
   * Aucun résidu : l'analyse n'existe pas encore (lot C2). Renvoyer un exemple
   * reviendrait à présenter une invention comme un résultat d'analyse.
   */
  async listResidues(): Promise<Residue[]> {
    return []
  }

  /** Aucun historique persistant : le journal de session est tenu par l'interface. */
  async listHistory(): Promise<HistoryEntry[]> {
    return []
  }

  async listSnapshots(): Promise<SnapshotSummary[]> {
    // Aucun instantané conservé : la persistance (SQLite) arrive en phase 4.
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
