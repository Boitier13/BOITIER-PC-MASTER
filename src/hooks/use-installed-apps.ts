import { useCallback, useEffect, useState } from 'react'
import type { AppInventory, AppListQuery } from '@/domain/types'
import { useServiceData } from '@/hooks/use-service-data'
import { useSystemService } from '@/store/system-service-context'

/** Taille de page par défaut (le moteur borne à 500). */
const PAGE_SIZE = 100

export interface InstalledAppsState {
  inventory: AppInventory | null
  loading: boolean
  error: unknown
  query: AppListQuery
  setSearch: (value: string) => void
  setScope: (scope: 'machine' | 'user' | undefined) => void
  setSort: (sort: NonNullable<AppListQuery['sort']>) => void
  setOffset: (offset: number) => void
  reload: () => void
}

/**
 * Inventaire des applications, filtré et paginé **par le moteur**.
 *
 * La recherche est différée de 250 ms pour ne pas interroger le registre à
 * chaque frappe. Aucune donnée n'est conservée entre deux lectures : l'écran
 * affiche exactement ce que le moteur vient de renvoyer.
 */
export function useInstalledApps(): InstalledAppsState {
  const service = useSystemService()
  const [query, setQuery] = useState<AppListQuery>({
    limit: PAGE_SIZE,
    offset: 0,
    sort: 'name',
  })
  const [debounced, setDebounced] = useState<AppListQuery>(query)

  useEffect(() => {
    const timer = window.setTimeout(() => setDebounced(query), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const { data, loading, error, reload } = useServiceData<AppInventory>(
    () => service.listInstalledApps(debounced),
    [service, debounced.search, debounced.scope, debounced.sort, debounced.offset, debounced.limit],
  )

  const setSearch = useCallback((value: string) => {
    setQuery((current) => ({ ...current, search: value, offset: 0 }))
  }, [])

  const setScope = useCallback((scope: 'machine' | 'user' | undefined) => {
    setQuery((current) => ({ ...current, scope, offset: 0 }))
  }, [])

  const setSort = useCallback((sort: NonNullable<AppListQuery['sort']>) => {
    setQuery((current) => ({ ...current, sort, offset: 0 }))
  }, [])

  const setOffset = useCallback((offset: number) => {
    setQuery((current) => ({ ...current, offset: Math.max(0, offset) }))
  }, [])

  return { inventory: data, loading, error, query, setSearch, setScope, setSort, setOffset, reload }
}
