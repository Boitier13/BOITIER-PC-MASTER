/**
 * Formatage localisé — identique au rendu de la maquette.
 * Le moteur réel fournira des octets (u64) ; la conversion d'unité sera alors
 * centralisée ici (base 1024 pour les capacités, comme Windows).
 */

export function formatGigabytes(value: number): string {
  return `${value.toLocaleString('fr-FR')} Go`
}

export function usagePercent(used: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((used / total) * 100)
}
