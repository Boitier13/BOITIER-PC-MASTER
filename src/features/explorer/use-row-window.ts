import { useEffect, useState, type RefObject } from 'react'

/** Lignes rendues au-delà de la zone visible, pour un défilement sans trou. */
const OVERSCAN = 12

/** En dessous de ce nombre, tout est rendu : le fenêtrage n'apporte rien. */
export const WINDOW_THRESHOLD = 200

export interface RowWindow {
  /** Première ligne à rendre. */
  start: number
  /** Dernière ligne à rendre (exclue). */
  end: number
  /** Hauteur mesurée d'une ligne, en pixels (0 si inconnue). */
  rowHeight: number
  /** `false` quand toutes les lignes sont rendues sans fenêtrage. */
  windowed: boolean
}

/**
 * Fenêtrage des lignes d'un tableau : seules les lignes proches de la zone
 * visible sont montées dans le DOM.
 *
 * Le calcul s'appuie sur le conteneur défilant réel. Si la hauteur ne peut pas
 * être mesurée (rendu sans moteur de mise en page, environnement de test), le
 * fenêtrage est **désactivé** et toutes les lignes sont rendues : le rendu et
 * les tests restent strictement identiques à l'existant.
 */
export function useRowWindow(
  ref: RefObject<HTMLElement | null>,
  count: number,
): RowWindow {
  const [state, setState] = useState<RowWindow>({
    start: 0,
    end: count,
    rowHeight: 0,
    windowed: false,
  })

  useEffect(() => {
    const element = ref.current
    if (!element) {
      setState({ start: 0, end: count, rowHeight: 0, windowed: false })
      return
    }

    const measure = () => {
      const row = element.querySelector<HTMLTableRowElement>('tbody tr[data-entry-row]')
      const rowHeight = row ? row.getBoundingClientRect().height : 0
      const viewport = element.clientHeight

      if (!rowHeight || !viewport || count <= WINDOW_THRESHOLD) {
        setState({ start: 0, end: count, rowHeight, windowed: false })
        return
      }

      const visible = Math.ceil(viewport / rowHeight) + OVERSCAN * 2
      const start = Math.max(0, Math.floor(element.scrollTop / rowHeight) - OVERSCAN)
      setState({
        start,
        end: Math.min(count, start + visible),
        rowHeight,
        windowed: true,
      })
    }

    measure()
    element.addEventListener('scroll', measure, { passive: true })

    const observer =
      typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(() => measure())
    observer?.observe(element)

    return () => {
      element.removeEventListener('scroll', measure)
      observer?.disconnect()
    }
  }, [ref, count])

  return state
}
