import type { FileSortKey } from '@/domain/types'

/**
 * Colonnes de l'explorateur, isolées du rendu (EX1.1, refactorisation R3).
 *
 * Ce tableau est la seule source de vérité pour l'ordre, le libellé et le tri :
 * la personnalisation des colonnes (EX1.7) n'aura qu'à filtrer cette liste,
 * sans toucher au tableau ni aux tests d'affichage.
 */
export interface ExplorerColumn {
  key: FileSortKey
  label: string
}

export const EXPLORER_COLUMNS: readonly ExplorerColumn[] = [
  { key: 'name', label: 'Nom' },
  { key: 'type', label: 'Type' },
  { key: 'size', label: 'Taille' },
  { key: 'modified', label: 'Date de modification' },
]

export const EXPLORER_COLUMN_COUNT = EXPLORER_COLUMNS.length
