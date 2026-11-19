import { Copy, ExternalLink, FileText, FolderOpen, Info, MoreHorizontal } from 'lucide-react'
import { CATEGORY_LABELS, describeAttributes } from '@/domain/file-entry'
import type { FileEntry } from '@/domain/types'
import { formatBytes, formatDateTime } from '@/lib/format'

interface PropertiesPanelProps {
  entry: FileEntry | null
  demo: boolean
  onOpen: (entry: FileEntry) => void
  onCopyPath: (entry: FileEntry) => void
}

function stateLabel(entry: FileEntry): string {
  if (entry.accessDenied) return 'Accès refusé'
  if (entry.isProtected) return 'Dossier protégé'
  if (entry.isSymlink) return 'Lien (non suivi)'
  return entry.isDirectory ? 'Dossier navigable' : 'Lecture seule'
}

/** Panneau Propriétés : uniquement des métadonnées lues, jamais modifiables. */
export function PropertiesPanel({ entry, demo, onOpen, onCopyPath }: PropertiesPanelProps) {
  return (
    <aside className="properties-panel">
      <div className="properties-title">
        <strong>Propriétés</strong>
        <MoreHorizontal size={17} />
      </div>

      {!entry && (
        <div className="property-empty">
          <Info size={16} />
          <p>Sélectionnez un élément pour afficher ses propriétés réelles.</p>
        </div>
      )}

      {entry && (
        <>
          <div className="property-preview">
            <div className="large-file-icon">{entry.isDirectory ? <FolderOpen size={29} /> : <FileText size={29} />}</div>
            <strong>{entry.name}</strong>
            <span>{entry.type}</span>
          </div>

          <div className="property-details">
            {[
              ['Taille', entry.isDirectory ? '—' : formatBytes(entry.sizeBytes)],
              ['Catégorie', CATEGORY_LABELS[entry.category]],
              ['Modifié le', formatDateTime(entry.modifiedAtMs)],
              ['Créé le', formatDateTime(entry.createdAtMs)],
              ['État', stateLabel(entry)],
              ['Emplacement', entry.parent ?? entry.path],
              ['Chemin', entry.path],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong title={value}>{value}</strong>
              </div>
            ))}
          </div>

          <div className="property-attributes">
            <span>Attributs</span>
            {describeAttributes(entry.attributes).length > 0 ? (
              <div className="attribute-chips">
                {describeAttributes(entry.attributes).map((attribute) => (
                  <span className="attribute-chip" key={attribute}>
                    {attribute}
                  </span>
                ))}
              </div>
            ) : (
              <strong>Aucun attribut particulier</strong>
            )}
          </div>

          <div className="property-actions">
            <button className="button secondary" onClick={() => onOpen(entry)}>
              <ExternalLink size={14} /> {entry.isDirectory ? 'Ouvrir' : 'Détails'}
            </button>
            <button className="button ghost" onClick={() => onCopyPath(entry)}>
              <Copy size={14} /> Chemin
            </button>
          </div>

          <div className="property-note">
            <Info size={14} />{' '}
            {demo
              ? 'Données fictives — aucune lecture du disque.'
              : 'Métadonnées lues sur le disque, en lecture seule. Aucune modification possible.'}
          </div>
        </>
      )}
    </aside>
  )
}
