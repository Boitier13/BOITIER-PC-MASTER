import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'

/**
 * Chargement asynchrone d'une donnée du moteur (volumes, dossier…).
 *
 * Gère les trois états nécessaires à un écran honnête : chargement, erreur,
 * donnée. Les réponses obsolètes (navigation rapide) sont ignorées grâce au
 * compteur de génération ; le résultat est effacé pendant un rechargement pour
 * ne jamais afficher « comme si » une lecture avait réussi.
 */
export interface ServiceDataState<T> {
  data: T | null
  loading: boolean
  error: unknown
  reload: () => void
}

export function useServiceData<T>(
  loader: () => Promise<T>,
  deps: DependencyList,
  options: { keepPreviousData?: boolean } = {},
): ServiceDataState<T> {
  const keepPreviousData = options.keepPreviousData ?? false
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<unknown>(null)
  const [nonce, setNonce] = useState(0)
  const generation = useRef(0)

  const loaderRef = useRef(loader)
  loaderRef.current = loader

  useEffect(() => {
    const current = generation.current + 1
    generation.current = current

    setLoading(true)
    setError(null)
    if (!keepPreviousData) setData(null)

    loaderRef
      .current()
      .then((value) => {
        if (generation.current !== current) return
        setData(value)
        setLoading(false)
      })
      .catch((reason: unknown) => {
        if (generation.current !== current) return
        setError(reason)
        setData(null)
        setLoading(false)
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, nonce, keepPreviousData])

  const reload = useCallback(() => setNonce((value) => value + 1), [])

  return { data, loading, error, reload }
}
