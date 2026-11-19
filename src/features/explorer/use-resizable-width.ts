import { useCallback, useEffect, useState, type KeyboardEvent, type PointerEvent } from 'react'

const MIN_DELTA = 16

function readStored(key: string, fallback: number): number {
  try {
    const raw = window.localStorage.getItem(key)
    const value = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(value) ? value : fallback
  } catch {
    return fallback
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export interface ResizableWidthOptions {
  /** Clé de mémorisation locale (aucune donnée système). */
  storageKey: string
  initial: number
  min: number
  max: number
  /** `true` quand la poignée est à droite du panneau (on inverse le sens). */
  invert?: boolean
}

export interface ResizableWidth {
  width: number
  /** Propriétés à étaler sur la poignée de redimensionnement. */
  handleProps: {
    onPointerDown: (event: PointerEvent<HTMLElement>) => void
    onKeyDown: (event: KeyboardEvent<HTMLElement>) => void
    onDoubleClick: () => void
  }
}

/**
 * Largeur d'un panneau réglable à la souris (et au clavier).
 *
 * La valeur est bornée (`min`/`max`) et mémorisée dans le stockage local de
 * l'application : aucun accès système, aucune donnée personnelle, et un
 * effacement du stockage ramène simplement aux largeurs par défaut.
 */
export function useResizableWidth(options: ResizableWidthOptions): ResizableWidth {
  const { storageKey, initial, min, max, invert = false } = options
  const [width, setWidth] = useState(() => clamp(readStored(storageKey, initial), min, max))

  useEffect(() => {
    try {
      window.localStorage.setItem(storageKey, String(Math.round(width)))
    } catch {
      /* stockage indisponible : la largeur reste valable pour la session */
    }
  }, [storageKey, width])

  const onPointerDown = useCallback(
    (event: PointerEvent<HTMLElement>) => {
      event.preventDefault()
      const startX = event.clientX
      const startWidth = width
      const direction = invert ? -1 : 1

      const onMove = (moveEvent: globalThis.PointerEvent) => {
        setWidth(clamp(startWidth + (moveEvent.clientX - startX) * direction, min, max))
      }
      const onUp = () => {
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }

      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [invert, max, min, width],
  )

  const onKeyDown = useCallback(
    (event: KeyboardEvent<HTMLElement>) => {
      const direction = invert ? -1 : 1
      if (event.key === 'ArrowLeft') {
        event.preventDefault()
        setWidth((value) => clamp(value - MIN_DELTA * direction, min, max))
      } else if (event.key === 'ArrowRight') {
        event.preventDefault()
        setWidth((value) => clamp(value + MIN_DELTA * direction, min, max))
      } else if (event.key === 'Home') {
        event.preventDefault()
        setWidth(initial)
      }
    },
    [invert, initial, max, min],
  )

  const onDoubleClick = useCallback(() => setWidth(initial), [initial])

  return { width, handleProps: { onPointerDown, onKeyDown, onDoubleClick } }
}
