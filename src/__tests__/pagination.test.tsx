import { act, fireEvent, render, renderHook, screen, waitFor, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import type { DirectoryListing, FileEntry, ListOptions, Volume } from '@/domain/types'
import { MAX_PAGES, PAGE_SIZE, usePagedListing } from '@/features/explorer/use-paged-listing'
import { ServiceError, type SystemService } from '@/services/system-service'

/**
 * Pagination de l'explorateur (EX1.1).
 *
 * Deux garanties sont vérifiées ici :
 *  1. le moteur est interrogé par pages bornées, sans recouvrement ni doublon ;
 *  2. l'écran affiche bien la totalité des pages chargées, et retombe sur le
 *     comportement historique si le service ne renseigne pas `hasMore`.
 */

const ROOT = 'C:\\Dossier'

function entry(index: number): FileEntry {
  return {
    name: `fichier-${String(index).padStart(5, '0')}.txt`,
    path: `${ROOT}\\fichier-${String(index).padStart(5, '0')}.txt`,
    parent: ROOT,
    extension: '.txt',
    category: 'document',
    type: 'Document texte',
    sizeBytes: 1024 + index,
    createdAtMs: Date.UTC(2026, 0, 1),
    modifiedAtMs: Date.UTC(2026, 10, 19),
    accessedAtMs: null,
    isDirectory: false,
    isSymlink: false,
    isProtected: false,
    accessDenied: false,
    attributes: {
      readonly: false,
      hidden: false,
      system: false,
      archive: true,
      directory: false,
      reparsePoint: false,
      offline: false,
      temporary: false,
      sparse: false,
      compressed: false,
      encrypted: false,
      raw: 32,
    },
  }
}

interface PagedServiceOptions {
  total: number
  /** Si faux, la réponse omet `hasMore` (contrat antérieur). */
  withHasMore?: boolean
}

function pagedService(options: PagedServiceOptions) {
  const all = Array.from({ length: options.total }, (_, index) => entry(index))
  const calls: ListOptions[] = []

  const listDirectory = vi.fn(async (_path: string, listOptions: ListOptions = {}) => {
    calls.push(listOptions)

    const offset = listOptions.offset ?? 0
    const limit = listOptions.limit ?? all.length
    const page = all.slice(offset, offset + limit)
    const hasMore = offset + limit < all.length

    const listing: DirectoryListing = {
      path: ROOT,
      parent: null,
      entries: page,
      total: all.length,
      truncated: false,
      denied: 0,
      isProtected: false,
      matched: all.length,
      offset,
      returned: page.length,
      ...(options.withHasMore === false ? {} : { hasMore }),
    }
    return listing
  })

  const service = {
    mode: 'system',
    getAppInfo: () =>
      Promise.resolve({
        name: 'BOITIER PC MASTER',
        version: '0.1.0',
        platform: 'windows',
        arch: 'x86_64',
        engineMode: 'system',
        realSystemAccess: true,
      }),
    getCapabilities: () =>
      Promise.resolve({
        mode: 'system',
        capabilities: {
          volumes: true,
          fileInventory: true,
          installedApps: false,
          uninstall: false,
          residueScan: false,
          monitoring: false,
          reports: false,
        },
        elevation: 'none',
        realSystemAccess: true,
      }),
    ping: () => Promise.resolve('pong'),
    listVolumes: () =>
      Promise.resolve<Volume[]>([
        {
          id: 'volume-c',
          letter: 'C:',
          label: 'Système',
          kind: 'SSD',
          kindCode: 'ssd',
          filesystem: 'NTFS',
          totalBytes: 512 * 1024 ** 3,
          usedBytes: 0,
          freeBytes: 512 * 1024 ** 3,
          isRemovable: false,
          accent: '#4388ff',
        },
      ]),
    listUserFolders: () => Promise.resolve([{ id: 'home', label: 'Profil', path: ROOT }]),
    listDirectory,
  } as unknown as SystemService

  return { service, calls, listDirectory }
}

describe('Pagination du listage (EX1.1)', () => {
  it('charge toutes les pages par requêtes bornées, sans recouvrement', async () => {
    const total = 2_500
    const { service, calls } = pagedService({ total })

    const { result } = renderHook(() =>
      usePagedListing(service, ROOT, { includeHidden: false, maxEntries: 5_000 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.listing?.entries.length).toBe(total))

    const entries = result.current.listing?.entries ?? []
    expect(entries).toHaveLength(total)
    expect(new Set(entries.map((item) => item.path)).size).toBe(total)

    expect(calls.map((options) => options.offset)).toEqual([0, PAGE_SIZE, PAGE_SIZE * 2])
    expect(calls.every((options) => (options.limit ?? 0) <= PAGE_SIZE)).toBe(true)
    expect(result.current.loadingMore).toBe(false)
  })

  it('ne demande qu’une page quand le service ne renseigne pas hasMore', async () => {
    const { service, calls } = pagedService({ total: 2_500, withHasMore: false })

    const { result } = renderHook(() =>
      usePagedListing(service, ROOT, { includeHidden: false, maxEntries: 5_000 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(result.current.listing?.entries.length).toBe(PAGE_SIZE))

    expect(calls).toHaveLength(1)
    expect(result.current.loadingMore).toBe(false)
  })

  it('borne le nombre de pages pour ne jamais boucler indéfiniment', async () => {
    const { service, calls } = pagedService({ total: PAGE_SIZE * (MAX_PAGES + 5) })

    const { result } = renderHook(() =>
      usePagedListing(service, ROOT, { includeHidden: false, maxEntries: 5_000 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    await waitFor(() => expect(calls.length).toBe(MAX_PAGES))
    expect(result.current.listing?.entries.length).toBe(PAGE_SIZE * MAX_PAGES)
  })

  it('pagine l’affichage, puis atteint le dernier élément chargé', async () => {
    const { service } = pagedService({ total: 1_500 })

    render(
      <MemoryRouter initialEntries={['/explorer']}>
        <App service={service} />
      </MemoryRouter>,
    )

    const table = within(await screen.findByRole('table'))
    expect(await table.findByText('fichier-00000.txt')).toBeInTheDocument()
    expect(await screen.findByText(/page 1 \/ 6/)).toBeInTheDocument()
    expect(table.queryByText('fichier-01499.txt')).not.toBeInTheDocument()

    // 1 500 éléments chargés, 250 par page : la dernière page existe et mène au dernier fichier.
    fireEvent.click(screen.getByRole('button', { name: 'Dernière page' }))
    expect(await screen.findByText(/page 6 \/ 6/)).toBeInTheDocument()
    expect(await table.findByText('fichier-01499.txt')).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Première page' }))
    expect(await screen.findByText(/page 1 \/ 6/)).toBeInTheDocument()
    expect(await table.findByText('fichier-00000.txt')).toBeInTheDocument()
  })

  it('ne monte jamais plus d’une page de lignes dans le DOM', async () => {
    const { service } = pagedService({ total: 1_500 })

    render(
      <MemoryRouter initialEntries={['/explorer']}>
        <App service={service} />
      </MemoryRouter>,
    )

    const table = within(await screen.findByRole('table'))
    expect(await screen.findByText(/page 1 \/ 6/)).toBeInTheDocument()

    // 1 500 éléments chargés, 250 par page : le DOM reste borné au fenêtrage.
    const dataRows = () =>
      screen.getAllByRole('row').filter((row) => row.querySelector('strong') !== null)
    expect(dataRows().length).toBe(250)

    fireEvent.click(screen.getByRole('button', { name: 'Dernière page' }))
    expect(await screen.findByText(/page 6 \/ 6/)).toBeInTheDocument()
    expect(dataRows().length).toBe(250)
    expect(table.getByText('fichier-01499.txt')).toBeInTheDocument()
  })

  it('« Tout afficher » lève le plafond de pages sans dépasser la borne de sécurité', async () => {
    const { service, calls } = pagedService({ total: 25_000 })

    const { result } = renderHook(() =>
      usePagedListing(service, ROOT, { includeHidden: false, maxEntries: 50_000 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.listing?.entries).toHaveLength(MAX_PAGES * PAGE_SIZE)
    expect(result.current.truncated).toBe(true)
    expect(calls).toHaveLength(MAX_PAGES)

    act(() => result.current.loadAll())

    await waitFor(() => expect(result.current.listing?.entries ?? []).toHaveLength(25_000))
    expect(result.current.truncated).toBe(false)
    expect(calls.length).toBe(25)
    // Poursuite par documents contigus : aucun recouvrement d'offset.
    expect(calls.map((call) => call.offset)).toStrictEqual(
      Array.from({ length: 25 }, (_, index) => index * PAGE_SIZE),
    )
  })

  it('signale une erreur de moteur sans afficher de liste vide trompeuse', async () => {
    const { service } = pagedService({ total: 10 })
    const failing = {
      ...service,
      listDirectory: () =>
        Promise.reject(new ServiceError('access_denied', 'Accès refusé par Windows.')),
    } as unknown as SystemService

    const { result } = renderHook(() =>
      usePagedListing(failing, ROOT, { includeHidden: false, maxEntries: 5_000 }),
    )

    await waitFor(() => expect(result.current.loading).toBe(false))
    expect(result.current.listing).toBeNull()
    expect(result.current.error).toBeInstanceOf(ServiceError)
  })
})
