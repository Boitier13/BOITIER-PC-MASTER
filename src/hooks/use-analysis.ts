import { useMeasurements } from '@/store/measurements'
import type { AnalysisReport } from '@/domain/types'
import { formatBytes, formatCount } from '@/lib/format'

/**
 * Couverture d'une mesure, formulée pour l'écran.
 *
 * Une mesure partielle reste affichable, mais jamais sans sa mention : c'est
 * précisément ce qui distingue une lecture réelle d'un chiffre inventé.
 */
export function coverageLabel(report: AnalysisReport): string {
  if (report.cancelled) return 'Mesure annulée — résultats partiels'
  if (report.truncated) return 'Mesure partielle — plafond d’entrées atteint'
  return 'Mesure complète'
}

/** Détail des entrées vues, refusées et non parcourues. */
export function coverageDetail(report: AnalysisReport): string {
  const parts = [`${formatCount(report.visited)} entrées visitées`]
  if (report.denied > 0) parts.push(`${formatCount(report.denied)} refusées par Windows`)
  if (report.skippedProtected > 0) {
    parts.push(`${formatCount(report.skippedProtected)} dossiers protégés non parcourus`)
  }
  return parts.join(' · ')
}

/**
 * Écart entre l'espace mesuré et l'espace utilisé annoncé par Windows.
 *
 * Il n'est calculé que si un volume de référence est fourni : sans référence,
 * il n'y a rien à comparer, et donc rien à afficher.
 */
export function measuredAgainstUsed(
  report: AnalysisReport,
  usedBytes: number | null,
): string | null {
  if (usedBytes === null || usedBytes <= 0) return null
  if (report.totalSizeBytes >= usedBytes) return null
  return `mesuré ${formatBytes(report.totalSizeBytes)} sur ${formatBytes(usedBytes)} utilisés — l’écart correspond aux fichiers système, protégés ou hors périmètre`
}

export { useMeasurements }
