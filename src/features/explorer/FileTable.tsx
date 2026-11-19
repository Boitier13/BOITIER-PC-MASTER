import {
  Archive,
  ArrowDown,
  ArrowUp,
  FileText,
  Folder,
  Image as ImageIcon,
  Link2,
  Lock,
  Music,
  ShieldAlert,
  Video,
} from 'lucide-react'
import { useRef } from 'react'
import type { FileEntry, FileSortKey, SortDirection } from '@/domain/types'
import { EXPLORER_COLUMN_COUNT, EXPLORER_COLUMNS } from '@/features/explorer/columns'
import { useRowWindow } from '@/features/explorer/use-row-window'
import { formatBytes, formatDate } from '@/lib/format'

function EntryIcon({ entry }: { entry: FileEntry }) {
  const size = 16
  if (entry.isDirectory) return <Folder size={size} />
  switch (entry.category) {
    case 'image':
      return <ImageIcon size={size} />
    case 'video':
      return <Video size={size} />
    case 'audio':
      return <Music size={size} />
    case 'archive':
      return <Archive size={size} />
    default:
      return <FileText size={size} />
  }
}

interface FileTableProps {
  entries: FileEntry[]
  loading: boolean
  selectedPath: string | null
  sortKey: FileSortKey
  sortDirection: SortDirection
  onSort: (key: FileSortKey) => void
  onSelect: (entry: FileEntry) => void
  onOpen: (entry: FileEntry) => void
  readOnlyLabel: string
  /** `true` pendant le chargement des pages suivantes (gros dossiers). */
  loadingMore?: boolean
}

/**
 * Tableau des éléments d'un dossier.
 *
 * Les dossiers sont toujours regroupés en tête (comme dans l'explorateur
 * Windows). Les éléments protégés, liens et accès refusés restent visibles et
 * sont signalés par un badge : masquer une erreur d'accès serait trompeur.
 */
export function FileTable({
  entries,
  loading,
  selectedPath,
  sortKey,
  sortDirection,
  onSort,
  onSelect,
  onOpen,
  readOnlyLabel,
  loadingMore = false,
}: FileTableProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const rows = useRowWindow(scrollRef, entries.length)
  const visible = rows.windowed ? entries.slice(rows.start, rows.end) : entries

  const spacerHeight = (rowCount: number) => rowCount * rows.rowHeight

  return (
    <div className="table-wrap" ref={scrollRef}>
      <table aria-rowcount={entries.length}>
        <thead>
          <tr>
            {EXPLORER_COLUMNS.map((column) => {
              const active = sortKey === column.key
              return (
                <th
                  key={column.key}
                  aria-sort={active ? (sortDirection === 'asc' ? 'ascending' : 'descending') : 'none'}
                  onClick={() => onSort(column.key)}
                >
                  <button
                    type="button"
                    className="column-sort"
                    aria-label={`Trier par ${column.label}`}
                  >
                    {column.label}
                    {active ? (
                      sortDirection === 'asc' ? (
                        <ArrowUp size={12} />
                      ) : (
                        <ArrowDown size={12} />
                      )
                    ) : null}
                  </button>
                </th>
              )
            })}
          </tr>
        </thead>
        <tbody>
          {loading && (
            <tr className="state-row">
              <td colSpan={EXPLORER_COLUMN_COUNT}>Lecture du dossier en cours…</td>
            </tr>
          )}

          {!loading && entries.length === 0 && (
            <tr className="state-row">
              <td colSpan={EXPLORER_COLUMN_COUNT}>Aucun élément à afficher dans ce dossier.</td>
            </tr>
          )}

          {!loading && rows.windowed && rows.start > 0 && (
            <tr aria-hidden="true" className="row-spacer">
              <td
                colSpan={EXPLORER_COLUMN_COUNT}
                style={{ height: spacerHeight(rows.start), padding: 0, border: 0 }}
              />
            </tr>
          )}

          {!loading &&
            visible.map((entry) => (
              <tr
                data-entry-row="true"
                className={selectedPath === entry.path ? 'selected-row' : ''}
                key={entry.path}
                onClick={() => onSelect(entry)}
                onDoubleClick={() => onOpen(entry)}
                title={entry.path}
              >
                <td>
                  <span className={`file-icon ${entry.isDirectory ? 'folder' : ''}`}>
                    <EntryIcon entry={entry} />
                  </span>
                  <strong>{entry.name}</strong>
                  {entry.isProtected && (
                    <span className="file-badge protected" title="Dossier protégé — jamais parcouru">
                      <ShieldAlert size={11} />
                    </span>
                  )}
                  {entry.isSymlink && (
                    <span className="file-badge link" title="Lien symbolique — jamais suivi">
                      <Link2 size={11} />
                    </span>
                  )}
                  {entry.accessDenied && (
                    <span className="file-badge denied" title="Accès refusé par Windows">
                      <Lock size={11} />
                    </span>
                  )}
                </td>
                <td>{entry.type}</td>
                <td>{entry.isDirectory ? '—' : formatBytes(entry.sizeBytes)}</td>
                <td>{formatDate(entry.modifiedAtMs)}</td>
              </tr>
            ))}

          {!loading && rows.windowed && rows.end < entries.length && (
            <tr aria-hidden="true" className="row-spacer">
              <td
                colSpan={EXPLORER_COLUMN_COUNT}
                style={{ height: spacerHeight(entries.length - rows.end), padding: 0, border: 0 }}
              />
            </tr>
          )}

          {!loading && loadingMore && (
            <tr className="state-row">
              <td colSpan={EXPLORER_COLUMN_COUNT}>Chargement de la suite du dossier…</td>
            </tr>
          )}
        </tbody>
      </table>
      <span className="visually-hidden">{readOnlyLabel}</span>
    </div>
  )
}
