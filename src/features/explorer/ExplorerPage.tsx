import {
  Archive,
  ArrowDown,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Copy,
  ExternalLink,
  FileText,
  Folder,
  FolderOpen,
  HardDrive,
  Info,
  ListFilter,
  Monitor,
  MoreHorizontal,
  Trash2,
  Video,
} from 'lucide-react'
import { useMemo } from 'react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { useAppState } from '@/store/app-state'

/**
 * Explorateur de fichiers.
 *
 * Comportement conservé à l'identique de la maquette, y compris ses limites
 * connues : icônes de dossier déduites de l'index de ligne (audit B2), fil
 * d'Ariane figé, boutons de navigation inertes (B5). Ces points seront traités
 * avec le moteur réel (phase 3), pas pendant la fondation.
 */
export function ExplorerPage() {
  const { volumes, entries } = useWorkspace()
  const {
    selectedDisk,
    setSelectedDisk,
    selectedFile,
    setSelectedFile,
    query,
    fileFilter,
    setFileFilter,
    expanded,
    setExpanded,
    openAction,
  } = useAppState()

  const files = useMemo(() => {
    const search = query.toLowerCase()
    return entries.filter(
      (entry) =>
        entry.name.toLowerCase().includes(search) &&
        (fileFilter === 'Tous les éléments' || entry.type.includes(fileFilter)),
    )
  }, [entries, query, fileFilter])

  return (
    <>
      <PageHeading
        eyebrow="ESPACE DE TRAVAIL / FICHIERS"
        title="Explorateur de fichiers"
        description="Parcourez l’inventaire simulé de vos fichiers et dossiers."
        action={<DemoLabel />}
      />

      <div className="explorer-toolbar">
        <div className="path-nav">
          <button className="icon-button" aria-label="Précédent">
            <ChevronLeft size={17} />
          </button>
          <button className="icon-button" aria-label="Suivant">
            <ChevronRight size={17} />
          </button>
          <button className="icon-button" aria-label="Dossier parent">
            <ArrowUp size={16} />
          </button>
          <div className="path-field">
            <HardDrive size={15} />
            <span>{selectedDisk}</span>
            <ChevronRight size={13} />
            <span>Utilisateurs</span>
            <ChevronRight size={13} />
            <b>Alexandre</b>
          </div>
        </div>
        <div className="explorer-actions">
          {[
            { name: 'Ouvrir', icon: ExternalLink },
            { name: 'Copier', icon: Copy },
            { name: 'Déplacer', icon: ArrowUp },
            { name: 'Renommer', icon: FileText },
            { name: 'Supprimer', icon: Trash2 },
          ].map((action) => (
            <button
              className="icon-button"
              key={action.name}
              title={action.name}
              aria-label={action.name}
              onClick={() => openAction(action.name)}
            >
              <action.icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <div className="explorer-layout">
        <aside className="tree-panel">
          <div className="tree-title">
            <strong>Emplacements</strong>
            <button className="icon-button" aria-label="Réduire l’arborescence" onClick={() => setExpanded(!expanded)}>
              <ChevronDown size={15} />
            </button>
          </div>
          {expanded && (
            <>
              <p className="tree-label">ACCÈS RAPIDE</p>
              {['Bureau', 'Téléchargements', 'Documents', 'Images'].map((label, index) => (
                <button key={label} className="tree-item">
                  <span className="tree-color">
                    {index === 0 ? <Monitor size={15} /> : index === 2 ? <FileText size={15} /> : <Folder size={15} />}
                  </span>
                  {label}
                </button>
              ))}
              <p className="tree-label">CE PC</p>
              {volumes.map((volume) => (
                <button
                  className={`tree-item ${selectedDisk === volume.letter ? 'selected' : ''}`}
                  key={volume.id}
                  onClick={() => setSelectedDisk(volume.letter)}
                >
                  <HardDrive size={15} />
                  {volume.letter} {volume.label}
                </button>
              ))}
            </>
          )}
        </aside>

        <section className="file-list-panel">
          <div className="file-list-toolbar">
            <strong>Éléments</strong>
            <select
              aria-label="Filtrer les éléments"
              value={fileFilter}
              onChange={(event) => setFileFilter(event.target.value)}
            >
              <option>Tous les éléments</option>
              <option>Document</option>
              <option>Archive</option>
              <option>Vidéo</option>
            </select>
            <button className="icon-button" aria-label="Options d’affichage">
              <ListFilter size={16} />
            </button>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {['Nom', 'Type', 'Taille', 'Date de modification'].map((heading, index) => (
                    <th key={heading} onClick={() => {}}>
                      {heading}
                      {index === 0 && <ArrowDown size={12} />}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {files.map((file, index) => (
                  <tr
                    className={selectedFile.name === file.name ? 'selected-row' : ''}
                    key={file.id}
                    onClick={() => setSelectedFile(file)}
                    onDoubleClick={() => openAction('Ouvrir le dossier')}
                  >
                    <td>
                      <span className={`file-icon ${index < 3 ? 'folder' : ''}`}>
                        {index < 3 ? (
                          <Folder size={16} />
                        ) : file.type.includes('Vidéo') ? (
                          <Video size={16} />
                        ) : file.type.includes('Archive') ? (
                          <Archive size={16} />
                        ) : (
                          <FileText size={16} />
                        )}
                      </span>
                      <strong>{file.name}</strong>
                    </td>
                    <td>{file.type}</td>
                    <td>{file.sizeLabel}</td>
                    <td>{file.modifiedAt.split(' ').slice(0, 1).join(' ')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="table-footer">
            <span>{files.length} éléments · Données fictives</span>
            <span>Inventaire du 19/11/2026</span>
          </div>
        </section>

        <aside className="properties-panel">
          <div className="properties-title">
            <strong>Propriétés</strong>
            <MoreHorizontal size={17} />
          </div>
          <div className="property-preview">
            <div className="large-file-icon">
              <FolderOpen size={29} />
            </div>
            <strong>{selectedFile.name}</strong>
            <span>{selectedFile.type}</span>
          </div>
          <div className="property-details">
            {[
              ['Taille', selectedFile.sizeLabel],
              ['Modifié le', selectedFile.modifiedAt],
              ['Emplacement', selectedFile.path],
              ['Disponibilité', 'Inventorié'],
            ].map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="property-note">
            <Info size={14} /> Ces propriétés proviennent d’un jeu de données fictif.
          </div>
        </aside>
      </div>
    </>
  )
}
