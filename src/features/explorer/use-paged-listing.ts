import { useCallback, useEffect, useRef, useState } from 'react'
import type { DirectoryListing, FileEntry } from '@/domain/types'
import type { SystemService } from '@/services/system-service'

/**
 * Taille de page demandée au moteur pour un dossier.
 *
 * Le moteur applique le tri **avant** de découper : deux pages successives ne
 * peuvent donc ni se recouvrir ni sauter une entrée. La valeur reste modeste
 * pour qu'une réponse IPC ne transporte jamais un dossier entier.
 */
export const PAGE_SIZE = 1_000

/** Garde-fou d'affichage : au-delà, l'écran signale la troncature. */
export const MAX_PAGES = 20

export interface PagedListingState {
  /** Dernière page reçue, enrichie de toutes les entrées déjà chargées. */
  listing: DirectoryListing | null
  /** `true` tant que la première page n'est pas arrivée. */
  loading: boolean
  /** `true` pendant le chargement des pages suivantes. */
  loadingMore: boolean
  error: unknown
  reload: () => void
}

interface Options {
  includeHidden: boolean
  maxEntries: number
  pageSize?: number
}

/**
 * Chargement paginé d'un dossier.
 *
 * Le contrat `SystemService` reste le seul accès au disque : chaque page est une
 * requête bornée (`limit`), et l'écran ne conserve que ce que le moteur a
 * réellement renvoyé. Si le moteur ne renseigne pas `hasMore` (contrat
 * antérieur), une seule page est demandée et le comportement historique est
 * conservé à l'identique.
 */
export function usePagedListing(
  service: SystemService,
  path: string,
  options: Options,
): PagedListingState {
  const includeHidden = options.includeHidden
  const maxEntries = options.maxEntries
  const pageSize = Math.min(options.pageSize ?? PAGE_SIZE, PAGE_SIZE)

  const [listing, setListing] = useState<DirectoryListing | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const [nonce, setNonce] = useState(0)
  const generation = useRef(0)

  useEffect(() => {
    const current = generation.current + 1
    generation.current = current

    if (!path) {
      setListing(null)
      setLoading(false)
      setLoadingMore(false)
      setError(null)
      return
    }

    let cancelled = false
    setListing(null)
    setLoading(true)
    setLoadingMore(false)
    setError(null)

    const load = async () => {
      try {
        let page = await service.listDirectory(path, {
          includeHidden,
          maxEntries,
          offset: 0,
          limit: pageSize,
        })
        if (cancelled || generation.current !== current) return

        let entries: FileEntry[] = page.entries
        setListing({ ...page, entries })
        setLoading(false)
        setLoadingMore(Boolean(page.hasMore))

        let pages = 1
        while (page.hasMore && pages < MAX_PAGES) {
          page = await service.listDirectory(path, {
            includeHidden,
            maxEntries,
            offset: entries.length,
            limit: pageSize,
          })
          if (cancelled || generation.current !== current) return
          if (page.entries.length === 0) break
          entries = entries.concat(page.entries)
          setListing({ ...page, entries })
          setLoadingMore(Boolean(page.hasMore))
          pages += 1
        }

        if (!cancelled && generation.current === current) setLoadingMore(false)
      } catch (reason) {
        if (cancelled || generation.current !== current) return
        setListing(null)
        setError(reason)
        setLoading(false)
        setLoadingMore(false)
      }
    }

    void load()

    return () => {
      cancelled = true
    }
  }, [service, path, includeHidden, maxEntries, pageSize, nonce])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { listing, loading, loadingMore, error, reload }
}
