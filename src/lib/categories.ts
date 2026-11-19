import type { FileCategory } from '@/domain/types'

/**
 * Libellés et couleurs des catégories du moteur.
 *
 * Les identifiants viennent de `category_for` côté Rust (`document`, `image`…) :
 * l'interface ne déduit jamais une catégorie d'une extension, elle affiche celle
 * que le moteur a calculée.
 */
export const CATEGORY_LABELS: Record<FileCategory, string> = {
  folder: 'Dossiers',
  document: 'Documents',
  image: 'Images',
  video: 'Vidéos',
  audio: 'Musique',
  archive: 'Archives',
  application: 'Applications',
  system: 'Système',
  other: 'Autres',
}

export const CATEGORY_COLORS: Record<FileCategory, string> = {
  folder: '#657184',
  document: '#4388ff',
  image: '#8b78ef',
  video: '#20c5d7',
  audio: '#e49b58',
  archive: '#d76e8c',
  application: '#5968db',
  system: '#7a8699',
  other: '#3b4557',
}

/** Produit un dégradé conique à partir de parts réelles, sans valeur inventée. */
export function donutGradient(slices: { bytes: number; color: string }[], total: number): string {
  if (total <= 0 || slices.length === 0) return 'var(--surface-3)'

  let offset = 0
  const stops = slices.map((slice) => {
    const share = (slice.bytes / total) * 100
    const stop = `${slice.color} ${offset.toFixed(2)}% ${(offset + share).toFixed(2)}%`
    offset += share
    return stop
  })
  return `conic-gradient(${stops.join(',')})`
}
