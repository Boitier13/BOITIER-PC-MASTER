import type { AppState, Confidence, HistoryKind } from '@/domain/types'

/**
 * Libellés français affichés par l'interface.
 *
 * Les valeurs de domaine restent des identifiants stables (`high`, `system`…),
 * ce qui évite les comparaisons sur du texte accentué comme dans la maquette.
 * Le rendu est identique à celui d'origine.
 */

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  high: 'Élevée',
  medium: 'Probable',
  low: 'Incertain',
  system: 'Système',
}

export const CONFIDENCE_CLASS: Record<Confidence, string> = {
  high: 'high',
  medium: 'medium',
  low: 'low',
  system: 'system',
}

export const APP_STATE_LABEL: Record<AppState, string> = {
  installed: 'Installé',
  system: 'Système',
}

export const HISTORY_KIND_LABEL: Record<HistoryKind, string> = {
  inventory: 'Inventaire',
  uninstall: 'Désinstallation',
  analysis: 'Analyse',
  monitoring: 'Surveillance',
}

/** Onglets de l'écran « Historique et rapports », dans l'ordre d'affichage. */
export const HISTORY_TABS = ['Tous', 'Inventaire', 'Désinstallation', 'Analyse', 'Surveillance'] as const
export type HistoryTab = (typeof HISTORY_TABS)[number]

export function matchesHistoryTab(tab: HistoryTab, kind: HistoryKind): boolean {
  return tab === 'Tous' || HISTORY_KIND_LABEL[kind] === tab
}
