import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { parentPathOf } from '@/domain/file-entry'
import type {
  DirectoryListing,
  FileCategory,
  FileEntry,
  FileSortKey,
  ListOptions,
  ScanProgress,
  SortDirection,
  WalkResult,
} from '@/domain/types'
import { useServiceData } from '@/hooks/use-service-data'
import { useVolumes } from '@/hooks/use-volumes'
import { ServiceError } from '@/services/system-service'
import { useSystemService } from '@/store/system-service-context'

export type ScanStatus = 'running' | 'done' | 'cancelled' | 'error'

export interface ScanState {
  query: string
  root: string
  status: ScanStatus
  progress: ScanProgress | null
  result: WalkResult | null
  error: ServiceError | null
}

export interface ExplorerController {
  /* navigation */
  path: string
  listing: DirectoryListing | null
  loading: boolean
  error: ServiceError | null
  navigate: (path: string) => void
  goBack: () => void
  goForward: () => void
  goUp: () => void
  canGoBack: boolean
  canGoForward: boolean
  canGoUp: boolean
  parentPath: string | null
  reload: () => void

  /* volumes et dossiers rapides */
  volumes: ReturnType<typeof useVolumes>['volumes']
  folders: ReturnType<typeof useVolumes>['folders']
  volumesError: unknown

  /* affichage */
  entries: FileEntry[]
  filter: FileCategory | 'all'
  setFilter: (value: FileCategory | 'all') => void
  includeHidden: boolean
  toggleHidden: () => void
  sortKey: FileSortKey
  sortDirection: SortDirection
  toggleSort: (key: FileSortKey) => void

  /* sélection et ouverture */
  selected: FileEntry | null
  select: (entry: FileEntry | null) => void
  open: (entry: FileEntry) => void

  /* recherche récursive */
  scan: ScanState | null
  startScan: (query: string) => void
  cancelScan: () => void
  exitScan: () => void
}

interface Options {
  /** Chemin de départ (dossier d'accueil ou racine du premier volume). */
  initialPath: string
  onOpenFile: (entry: FileEntry) => void
  onProtected: (entry: FileEntry) => void
  onSymlink: (entry: FileEntry) => void
}

const LIST_OPTIONS: ListOptions = { directoriesFirst: true, maxEntries: 5_000 }

const EMPTY_ENTRIES: FileEntry[] = []

function compareEntries(
  left: FileEntry,
  right: FileEntry,
  key: FileSortKey,
  direction: SortDirection,
): number {
  const sign = direction === 'asc' ? 1 : -1

  if (left.isDirectory !== right.isDirectory) {
    return left.isDirectory ? -1 : 1
  }

  switch (key) {
    case 'size':
      return (left.sizeBytes - right.sizeBytes) * sign
    case 'modified':
      return ((left.modifiedAtMs ?? 0) - (right.modifiedAtMs ?? 0)) * sign
    case 'type':
      return (
        left.type.localeCompare(right.type, 'fr', { sensitivity: 'base' }) ||
        left.name.localeCompare(right.name, 'fr', { numeric: true, sensitivity: 'base' })
      ) * sign
    case 'name':
    default:
      return left.name.localeCompare(right.name, 'fr', { numeric: true, sensitivity: 'base' }) * sign
  }
}

/**
 * Logique de l'explorateur (navigation, chargement, tri, recherche).
 *
 * Séparée du rendu pour rester testable et pour garantir que **toutes** les
 * interactions passent par `SystemService` : l'écran ne touche jamais au disque
 * lui-même et ne peut donc pas modifier un fichier.
 */
export function useExplorer(options: Options): ExplorerController {
  const service = useSystemService()
  const { volumes, folders, error: volumesError } = useVolumes()

  const fallbackPath = useMemo(() => {
    const home = folders.find((folder) => folder.id === 'home')
    if (home) return home.path
    const first = volumes[0]
    return first ? `${first.letter.replace(/\\+$/, '')}\\` : ''
  }, [folders, volumes])

  const [stack, setStack] = useState<string[]>([options.initialPath || ''])
  const [cursor, setCursor] = useState(0)
  const [filter, setFilter] = useState<FileCategory | 'all'>('all')
  const [includeHidden, setIncludeHidden] = useState(false)
  const [sortKey, setSortKey] = useState<FileSortKey>('name')
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc')
  const [selected, setSelected] = useState<FileEntry | null>(null)
  const [scan, setScan] = useState<ScanState | null>(null)

  const currentPath = stack[cursor] ?? ''
  const abortRef = useRef<AbortController | null>(null)

  // Résolution du chemin initial dès que les volumes sont connus.
  useEffect(() => {
    if (!currentPath && fallbackPath) {
      setStack([fallbackPath])
      setCursor(0)
    }
  }, [currentPath, fallbackPath])

  const listing = useServiceData<DirectoryListing | null>(
    () =>
      currentPath
        ? service.listDirectory(currentPath, { ...LIST_OPTIONS, includeHidden })
        : Promise.resolve(null),
    [currentPath, includeHidden, service],
  )

  const navigate = useCallback((nextPath: string) => {
    if (!nextPath) return
    abortRef.current?.abort()
    setScan(null)
    setSelected(null)
    setStack((previous) => [...previous.slice(0, cursor + 1), nextPath])
    setCursor((value) => value + 1)
  }, [cursor])

  const goBack = useCallback(() => {
    if (cursor <= 0) return
    abortRef.current?.abort()
    setScan(null)
    setSelected(null)
    setCursor(cursor - 1)
  }, [cursor])

  const goForward = useCallback(() => {
    if (cursor >= stack.length - 1) return
    abortRef.current?.abort()
    setScan(null)
    setSelected(null)
    setCursor(cursor + 1)
  }, [cursor, stack.length])

  const parentPath = currentPath ? parentPathOf(currentPath) : null

  const goUp = useCallback(() => {
    if (parentPath) navigate(parentPath)
  }, [navigate, parentPath])

  const toggleSort = useCallback((key: FileSortKey) => {
    setSortKey((previousKey) => {
      if (previousKey === key) {
        setSortDirection((previous) => (previous === 'asc' ? 'desc' : 'asc'))
        return previousKey
      }
      setSortDirection('asc')
      return key
    })
  }, [])

  const baseEntries = scan?.result?.entries ?? listing.data?.entries ?? EMPTY_ENTRIES

  const entries = useMemo(() => {
    const filtered = filter === 'all'
      ? baseEntries
      : baseEntries.filter((entry) => entry.category === filter)
    return [...filtered].sort((left, right) => compareEntries(left, right, sortKey, sortDirection))
  }, [baseEntries, filter, sortDirection, sortKey])

  const startScan = useCallback((query: string) => {
    const trimmed = query.trim()
    if (!trimmed || !currentPath) return

    abortRef.current?.abort()
    const controller = new AbortController()
    abortRef.current = controller

    const root = currentPath
    setScan({
      query: trimmed,
      root,
      status: 'running',
      progress: null,
      result: null,
      error: null,
    })

    service
      .walk(
        {
          scanId: `scan-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          root,
          options: { search: trimmed, maxResults: 400, includeHidden },
        },
        {
          signal: controller.signal,
          onProgress: (progress) => {
            setScan((previous) =>
              previous && previous.status === 'running' ? { ...previous, progress } : previous,
            )
          },
        },
      )
      .then((result) => {
        if (controller.signal.aborted && !result.stats.cancelled) return
        setScan((previous) =>
          previous
            ? {
                ...previous,
                status: result.stats.cancelled ? 'cancelled' : 'done',
                result,
              }
            : previous,
        )
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) {
          setScan((previous) => (previous ? { ...previous, status: 'cancelled' } : previous))
          return
        }
        setScan((previous) =>
          previous
            ? {
                ...previous,
                status: 'error',
                error:
                  error instanceof ServiceError
                    ? error
                    : new ServiceError('ipc_failure', 'La recherche a échoué.'),
              }
            : previous,
        )
      })
  }, [currentPath, includeHidden, service])

  const cancelScan = useCallback(() => {
    abortRef.current?.abort()
    setScan((previous) =>
      previous && previous.status === 'running'
        ? { ...previous, status: 'cancelled' }
        : previous,
    )
  }, [])

  const exitScan = useCallback(() => {
    abortRef.current?.abort()
    setScan(null)
    setSelected(null)
  }, [])

  // Annulation de la recherche en cours au démontage de l'écran.
  useEffect(() => () => abortRef.current?.abort(), [])

  const openEntry = useCallback(
    (entry: FileEntry) => {
      if (entry.isProtected) {
        options.onProtected(entry)
        return
      }
      if (entry.isSymlink) {
        options.onSymlink(entry)
        return
      }
      if (entry.isDirectory) {
        navigate(entry.path)
        return
      }
      options.onOpenFile(entry)
    },
    [navigate, options],
  )

  return {
    path: currentPath,
    listing: listing.data,
    loading: listing.loading,
    error: listing.error instanceof ServiceError ? listing.error : null,
    navigate,
    goBack,
    goForward,
    goUp,
    canGoBack: cursor > 0,
    canGoForward: cursor < stack.length - 1,
    canGoUp: Boolean(parentPath),
    parentPath,
    reload: listing.reload,
    volumes,
    folders,
    volumesError,
    entries,
    filter,
    setFilter,
    includeHidden,
    toggleHidden: () => setIncludeHidden((value) => !value),
    sortKey,
    sortDirection,
    toggleSort,
    selected,
    select: setSelected,
    open: openEntry,
    scan,
    startScan,
    cancelScan,
    exitScan,
  }
}
