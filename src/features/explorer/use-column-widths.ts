import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { FileSortKey } from '@/domain/types'

/** Largeurs de colonnes par défaut, en pixels (texte à 13,5 px). */
export const DEFAULT_COLUMN_WIDTHS: Record<FileSortKey, number> = {
  name: 250,
  type: 120,
  size: 110,
  modified: 170,
}

export const COLUMN_MIN_WIDTH = 90
export const COLUMN_MAX_WIDTH = 900

const STORAGE_KEY = 'explorer.columnWidths'

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function readStored(): Record<FileSortKey, number> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_COLUMN_WIDTHS
    const parsed = JSON.parse(raw) as Partial<Record<FileSortKey, number>>
    return (Object.keys(DEFAULT_COLUMN_WIDTHS) as FileSortKey[]).reduce(
      (accumulator, key) => {
        const value = parsed[key]
        accumulator[key] = Number.isFinite(value)
          ? clamp(Number(value), COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH)
          : DEFAULT_COLUMN_WIDTHS[key]
        return accumulator
      },
      { ...DEFAULT_COLUMN_WIDTHS },
    )
  } catch {
    return DEFAULT_COLUMN_WIDTHS
  }
}

export interface ColumnWidths {
  widths: Record<FileSortKey, number>
  /** Poignée de redimensionnement d'une colonne. */
  startResize: (key: FileSortKey, event: PointerEvent<HTMLElement>) => void
  /** Ajuste la colonne à son contenu (double-clic sur la poignée). */
  fitToContent: (key: FileSortKey, table: HTMLElement | null) => void
  /** Réglage au clavier : ←/→ par pas de 16 px, `Home` revient au défaut. */
  resizeWithKeyboard: (key: FileSortKey, event: KeyboardEvent<HTMLElement>) => void
  reset: () => void
}

/**
 * Largeurs des colonnes de l'explorateur, réglables à la souris.
 *
 * Les largeurs sont un **minimum** posé sur la colonne : le tableau garde sa
 * mise en page automatique, donc un nom très long agrandit la colonne au lieu
 * d'être coupé, et un défilement horizontal apparaît si l'ensemble dépasse la
 * largeur du panneau. Rien n'est jamais tronqué définitivement.
 */
export function useColumnWidths(): ColumnWidths {
  const [widths, setWidths] = useState<Record<FileSortKey, number>>(() => readStored())
  const widthsRef = useRef(widths)
  widthsRef.current = widths

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(widths))
    } catch {
      /* stockage indisponible : les largeurs restent valables pour la session */
    }
  }, [widths])

  const startResize = useCallback((key: FileSortKey, event: PointerEvent<HTMLElement>) => {
    event.preventDefault()
    event.stopPropagation()
    const startX = event.clientX
    const startWidth = widthsRef.current[key]

    const onMove = (moveEvent: globalThis.PointerEvent) => {
      const next = clamp(startWidth + (moveEvent.clientX - startX), COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH)
      setWidths((current) => ({ ...current, [key]: next }))
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [])

  const fitToContent = useCallback((key: FileSortKey, table: HTMLElement | null) => {
    const column = (Object.keys(DEFAULT_COLUMN_WIDTHS) as FileSortKey[]).indexOf(key)
    if (!table || column < 0) return

    const cells = Array.from(table.querySelectorAll<HTMLElement>('tbody tr[data-entry-row] td'))
    const widthsOfCells = cells
      .filter((_cell, index) => index % 4 === column)
      .map((cell) => cell.scrollWidth + 24)

    if (widthsOfCells.length === 0) return
    const fitted = clamp(Math.max(...widthsOfCells), COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH)
    setWidths((current) => ({ ...current, [key]: fitted }))
  }, [])

  const resizeWithKeyboard = useCallback((key: FileSortKey, event: KeyboardEvent<HTMLElement>) => {
    const step = 16
    if (event.key === 'Home') {
      event.preventDefault()
      setWidths((current) => ({ ...current, [key]: DEFAULT_COLUMN_WIDTHS[key] }))
      return
    }
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    const delta = event.key === 'ArrowLeft' ? -step : step
    setWidths((current) => ({
      ...current,
      [key]: clamp(current[key] + delta, COLUMN_MIN_WIDTH, COLUMN_MAX_WIDTH),
    }))
  }, [])

  const reset = useCallback(() => setWidths({ ...DEFAULT_COLUMN_WIDTHS }), [])

  return { widths, startResize, fitToContent, resizeWithKeyboard, reset }
}
