/**
 * Formatage localisé des valeurs du moteur (octets, horodatages UNIX).
 *
 * Base 1024 (comme Windows) et locale française : « 8,4 Mo », « 1,28 Go ».
 * Aucun arrondi abusif : les petites valeurs restent en octets.
 */

const BYTE_UNITS = ['o', 'Ko', 'Mo', 'Go', 'To', 'Po'] as const

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—'
  if (bytes === 0) return '0 o'

  let value = bytes
  let unit = 0
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024
    unit += 1
  }

  const digits = unit === 0 ? 0 : value >= 100 ? 0 : value >= 10 ? 1 : 2
  const formatted = value.toLocaleString('fr-FR', {
    maximumFractionDigits: digits,
    minimumFractionDigits: 0,
  })
  return `${formatted} ${BYTE_UNITS[unit]}`
}

/** Compatibilité : anciennes valeurs exprimées en gigaoctets. */
export function formatGigabytes(value: number): string {
  return formatBytes(value * 1024 ** 3)
}

export function usagePercent(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((used / total) * 100)
}

const DATE_TIME_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
})

const DATE_FORMAT = new Intl.DateTimeFormat('fr-FR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
})

/** Horodatage complet « 19/11/2026 09:42 » ; `—` si inconnu. */
export function formatDateTime(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  return DATE_TIME_FORMAT.format(new Date(ms))
}

/** Date seule « 19/11/2026 » ; `—` si inconnue. */
export function formatDate(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms <= 0) return '—'
  return DATE_FORMAT.format(new Date(ms))
}

/** Durée lisible : « 820 ms », « 2,4 s ». */
export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '—'
  if (ms < 1000) return `${Math.round(ms)} ms`
  return `${(ms / 1000).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} s`
}

/** Nombre d'éléments avec espace insécable fine, comme la maquette. */
export function formatCount(value: number): string {
  return value.toLocaleString('fr-FR')
}
