import {
  AlertTriangle,
  ArrowUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  FileText,
  Folder,
  HardDrive,
  ListFilter,
  PanelRight,
  Search,
  Trash2,
} from 'lucide-react'
import { Fragment, useEffect, useMemo, useState, type CSSProperties, type FormEvent } from 'react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { CATEGORY_FILTERS, pathSegments } from '@/domain/file-entry'
import type { FileEntry } from '@/domain/types'
import { FileTable } from '@/features/explorer/FileTable'
import { PropertiesPanel } from '@/features/explorer/PropertiesPanel'
import { useExplorer } from '@/features/explorer/use-explorer'
import { useResizableWidth } from '@/features/explorer/use-resizable-width'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { formatCount, formatDuration } from '@/lib/format'
import { useAppState } from '@/store/app-state'

/** Nombre d'éléments affichés par page de l'explorateur. */
const VIEW_PAGE_SIZE = 250

const ACTIONS = [
  { name: 'Ouvrir', icon: ExternalLink },
  { name: 'Copier', icon: Copy },
  { name: 'Déplacer', icon: ArrowUp },
  { name: 'Renommer', icon: FileText },
  { name: 'Supprimer', icon: Trash2 },
] as const

/**
 * Explorateur de fichiers — première fonctionnalité métier réelle.
 *
 * En mode réel, toutes les données proviennent du moteur Rust (`directory_list`,
 * `walk_start`) : tailles en octets, horodatages, attributs Windows, liens et
 * dossiers protégés, erreurs d'accès. Le mode démonstration sert une
 * arborescence fictive mais emprunte **exactement** le même contrat.
 *
 * Aucune action destructive n'existe : les boutons Déplacer / Renommer /
 * Supprimer ouvrent une explication, jamais une opération. Les liens et
 * dossiers protégés ne sont jamais parcourus, conformément au moteur.
 */
export function ExplorerPage() {
  const { openAction, notify, expanded, setExpanded } = useAppState()
  const demo = useEngineMode() === 'demo'
  const [searchInput, setSearchInput] = useState('')

  const explorer = useExplorer({
    initialPath: '',
    onOpenFile: () => openAction('Aperçu de fichier non disponible'),
    onProtected: () => openAction('Dossier protégé — non parcouru'),
    onSymlink: () => openAction('Lien symbolique — non suivi'),
  })

  const [propertiesVisible, setPropertiesVisible] = useState(true)
  const [page, setPage] = useState(1)

  // Largeurs de panneaux réglables (mémorisées localement, aucune donnée système).
  const treeWidth = useResizableWidth({ storageKey: 'explorer.treeWidth', initial: 160, min: 140, max: 320 })
  const propertiesWidth = useResizableWidth({
    storageKey: 'explorer.propertiesWidth',
    initial: 220,
    min: 200,
    max: 420,
    invert: true,
  })

  // Pagination d'affichage : le moteur fournit des pages de 1 000, l'écran
  // présente des pages de 250 éléments, tri et filtres appliqués sur l'ensemble.
  useEffect(() => {
    setPage(1)
  }, [explorer.path, explorer.filter, explorer.sortKey, explorer.sortDirection, explorer.includeHidden])

  const totalEntries = explorer.entries.length
  const pageCount = Math.max(1, Math.ceil(totalEntries / VIEW_PAGE_SIZE))
  const currentPage = Math.min(page, pageCount)
  const visibleEntries = useMemo(
    () => explorer.entries.slice((currentPage - 1) * VIEW_PAGE_SIZE, currentPage * VIEW_PAGE_SIZE),
    [currentPage, explorer.entries],
  )

  useEffect(() => {
    if (page !== currentPage) setPage(currentPage)
  }, [currentPage, page])

  const segments = useMemo(() => pathSegments(explorer.path), [explorer.path])

  const copyPath = async (entry: FileEntry | null) => {
    if (!entry) {
      notify('Sélectionnez d’abord un élément dans la liste.')
      return
    }
    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(entry.path)
        notify('Chemin copié dans le presse-papiers')
        return
      }
      throw new Error('presse-papiers indisponible')
    } catch {
      openAction(`Chemin : ${entry.path}`)
    }
  }

  const openSelected = () => {
    if (!explorer.selected) {
      notify('Sélectionnez d’abord un élément dans la liste.')
      return
    }
    explorer.open(explorer.selected)
  }

  const submitSearch = (event: FormEvent) => {
    event.preventDefault()
    explorer.startScan(searchInput)
  }

  const listing = explorer.listing
  const footerRight = explorer.scan
    ? explorer.scan.status === 'running'
      ? 'Recherche récursive en cours'
      : 'Résultats de recherche'
    : listing
      ? `${formatCount(listing.total)} entrées${listing.truncated ? ' · tronquée' : ''}${
          listing.denied > 0 ? ` · ${listing.denied} refus` : ''
        }`
      : '—'

  return (
    <>
      <PageHeading
        eyebrow="ESPACE DE TRAVAIL / FICHIERS"
        title="Explorateur de fichiers"
        description={
          demo
            ? 'Parcourez une arborescence fictive : dossiers, tailles, dates, attributs, liens et accès refusés.'
            : 'Parcourez vos dossiers en lecture seule : tailles, dates, attributs, liens et accès refusés.'
        }
        action={<DemoLabel />}
      />

      <div className="explorer-toolbar">
        <div className="path-nav">
          <button
            className="icon-button"
            aria-label="Précédent"
            disabled={!explorer.canGoBack}
            onClick={explorer.goBack}
          >
            <ChevronLeft size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Suivant"
            disabled={!explorer.canGoForward}
            onClick={explorer.goForward}
          >
            <ChevronRight size={17} />
          </button>
          <button
            className="icon-button"
            aria-label="Dossier parent"
            disabled={!explorer.canGoUp}
            onClick={explorer.goUp}
          >
            <ArrowUp size={16} />
          </button>
          <div className="path-field" aria-label="Chemin courant">
            <HardDrive size={15} />
            {segments.length === 0 && <span>Chargement…</span>}
            {segments.map((segment, index) => (
              <Fragment key={segment.path}>
                {index > 0 && <ChevronRight size={13} />}
                <button
                  type="button"
                  className={`crumb ${index === segments.length - 1 ? 'current' : ''}`}
                  onClick={() => explorer.navigate(segment.path)}
                  title={segment.path}
                >
                  {segment.name}
                </button>
              </Fragment>
            ))}
          </div>
        </div>

        <div className="explorer-actions">
          {ACTIONS.map((action) => (
            <button
              className="icon-button"
              key={action.name}
              title={action.name}
              aria-label={action.name}
              onClick={() => {
                if (action.name === 'Ouvrir') openSelected()
                else if (action.name === 'Copier') void copyPath(explorer.selected)
                else openAction(`${action.name} — opération non disponible`)
              }}
            >
              <action.icon size={16} />
            </button>
          ))}
        </div>
      </div>

      <div
        className={`explorer-layout ${propertiesVisible ? '' : 'properties-hidden'}`}
        style={
          {
            '--tree-width': `${treeWidth.width}px`,
            '--properties-width': `${propertiesWidth.width}px`,
          } as CSSProperties
        }
      >
        <aside className="tree-panel">
          <div className="tree-title">
            <strong>Emplacements</strong>
            <button
              className="icon-button"
              aria-label="Réduire l’arborescence"
              aria-expanded={expanded}
              onClick={() => setExpanded(!expanded)}
            >
              <ChevronDown size={15} />
            </button>
          </div>

          {expanded && (
            <>
              <p className="tree-label">ACCÈS RAPIDE</p>
              {explorer.folders.map((folder) => (
                <button
                  key={folder.id}
                  className={`tree-item ${explorer.path.toLowerCase() === folder.path.toLowerCase() ? 'selected' : ''}`}
                  onClick={() => explorer.navigate(folder.path)}
                  title={folder.path}
                >
                  <span className="tree-color">
                    <Folder size={15} />
                  </span>
                  {folder.label}
                </button>
              ))}

              <p className="tree-label">CE PC</p>
              {explorer.volumes.map((volume) => (
                <button
                  className={`tree-item ${explorer.path.toLowerCase().startsWith(`${volume.letter.toLowerCase()}\\`) ? 'selected' : ''}`}
                  key={volume.id}
                  onClick={() => explorer.navigate(`${volume.letter}\\`)}
                  title={`${volume.label} · ${volume.filesystem ?? 'système de fichiers inconnu'}`}
                >
                  <HardDrive size={15} />
                  {volume.letter} {volume.label}
                </button>
              ))}
              {explorer.volumes.length === 0 && !explorer.volumesError && (
                <p className="tree-note">Aucun volume détecté pour le moment.</p>
              )}
              {Boolean(explorer.volumesError) && (
                <p className="tree-note error">Volumes indisponibles.</p>
              )}
            </>
          )}
        </aside>

        <button
          type="button"
          className="panel-resizer"
          role="separator"
          aria-orientation="vertical"
          aria-label="Redimensionner le panneau Emplacements"
          title="Glisser pour élargir ou réduire · double-clic pour la largeur par défaut"
          {...treeWidth.handleProps}
        />

        <section className="file-list-panel">
          <div className="file-list-toolbar">
            <strong>Éléments</strong>

            <form className="table-search" onSubmit={submitSearch}>
              <Search size={14} />
              <input
                aria-label="Rechercher dans ce dossier"
                placeholder="Rechercher dans ce dossier"
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
              />
              <button
                type="submit"
                className="icon-button"
                aria-label="Lancer une recherche récursive"
                title="Rechercher dans les sous-dossiers"
              >
                <Search size={14} />
              </button>
            </form>

            <select
              aria-label="Filtrer les éléments"
              value={explorer.filter}
              onChange={(event) => explorer.setFilter(event.target.value as typeof explorer.filter)}
            >
              {CATEGORY_FILTERS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>

            <button
              className="icon-button"
              aria-label={explorer.includeHidden ? 'Masquer les éléments cachés' : 'Afficher les éléments cachés'}
              aria-pressed={explorer.includeHidden}
              title="Éléments cachés et système"
              onClick={explorer.toggleHidden}
            >
              {explorer.includeHidden ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>

            <button className="icon-button" aria-label="Options d’affichage" title="Options d’affichage">
              <ListFilter size={16} />
            </button>

            <button
              type="button"
              className="toolbar-button"
              aria-pressed={propertiesVisible}
              aria-label={propertiesVisible ? 'Masquer le panneau Propriétés' : 'Afficher le panneau Propriétés'}
              title={propertiesVisible ? 'Masquer le panneau Propriétés' : 'Afficher le panneau Propriétés'}
              onClick={() => setPropertiesVisible((value) => !value)}
            >
              <PanelRight size={15} /> Propriétés
            </button>
          </div>

          {explorer.scan && (
            <div className="scan-banner" role="status" aria-live="polite">
              <div className="scan-head">
                <strong>
                  Recherche « {explorer.scan.query} » dans {explorer.scan.root}
                </strong>
                {explorer.scan.status === 'running' ? (
                  <button className="button ghost" onClick={explorer.cancelScan}>
                    Annuler
                  </button>
                ) : (
                  <button className="button ghost" onClick={explorer.exitScan}>
                    Revenir au dossier
                  </button>
                )}
              </div>

              {explorer.scan.status === 'running' && (
                <div className="progress-track" aria-hidden="true">
                  <span className="progress-fill indeterminate" />
                </div>
              )}

              <span className="scan-meta">
                {explorer.scan.status === 'running' &&
                  `${formatCount(explorer.scan.progress?.visited ?? 0)} éléments examinés · ${formatCount(
                    explorer.scan.progress?.matched ?? 0,
                  )} résultats`}
                {explorer.scan.status === 'done' &&
                  `${formatCount(explorer.scan.result?.stats.matched ?? 0)} résultats · ${formatCount(
                    explorer.scan.result?.stats.visited ?? 0,
                  )} éléments examinés · ${formatDuration(explorer.scan.result?.stats.elapsedMs ?? 0)}`}
                {explorer.scan.status === 'cancelled' &&
                  `Recherche annulée · ${formatCount(
                    explorer.scan.result?.stats.matched ?? 0,
                  )} résultats partiels`}
                {explorer.scan.status === 'error' &&
                  (explorer.scan.error?.userMessage ?? 'La recherche a échoué.')}
              </span>

              {explorer.scan.result?.stats.truncated && (
                <span className="scan-warning">Résultats tronqués : 400 éléments maximum par recherche.</span>
              )}
            </div>
          )}

          {explorer.error && (
            <div className="error-banner" role="alert">
              <AlertTriangle size={16} />
              <div>
                <strong>Lecture impossible</strong>
                <span>{explorer.error.userMessage}</span>
                {explorer.error.message && <small>{explorer.error.message}</small>}
              </div>
              <button className="button secondary" onClick={explorer.reload}>
                Réessayer
              </button>
              {explorer.canGoUp && (
                <button className="button ghost" onClick={explorer.goUp}>
                  Dossier parent
                </button>
              )}
            </div>
          )}

          <FileTable
            entries={visibleEntries}
            loading={explorer.loading}
            selectedPath={explorer.selected?.path ?? null}
            sortKey={explorer.sortKey}
            sortDirection={explorer.sortDirection}
            onSort={explorer.toggleSort}
            onSelect={explorer.select}
            onOpen={explorer.open}
            readOnlyLabel="Exploration en lecture seule : aucun fichier n’est modifié."
            loadingMore={explorer.loadingMore}
          />

          <div className="table-footer">
            <span>
              {formatCount(explorer.entries.length)} éléments · {demo ? 'Données fictives' : 'Lecture seule'}
              {explorer.truncated
                ? ` · plafond de ${formatCount(explorer.matchedCount)} éléments atteint`
                : ''}
            </span>
            {pageCount > 1 ? (
              <div className="explorer-pagination" aria-label="Pagination des éléments">
                <span className="pagination-info">
                  {explorer.matchedCount > totalEntries
                    ? `${formatCount(totalEntries)} affichés sur ${formatCount(explorer.matchedCount)}`
                    : `${formatCount(totalEntries)} éléments`}{' '}
                  · page {currentPage} / {pageCount}
                </span>
                {explorer.partiallyLoaded ? (
                  <button
                    type="button"
                    className="pagination-button pagination-all"
                    onClick={explorer.loadAll}
                    title="Charger les éléments restants de ce dossier"
                  >
                    Tout afficher
                  </button>
                ) : null}
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Première page"
                  title="Première page"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(1)}
                >
                  <ChevronsLeft size={16} />
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Page précédente"
                  title="Page précédente"
                  disabled={currentPage <= 1}
                  onClick={() => setPage(currentPage - 1)}
                >
                  <ChevronLeft size={16} />
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Page suivante"
                  title="Page suivante"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(currentPage + 1)}
                >
                  <ChevronRight size={16} />
                </button>
                <button
                  type="button"
                  className="pagination-button"
                  aria-label="Dernière page"
                  title="Dernière page"
                  disabled={currentPage >= pageCount}
                  onClick={() => setPage(pageCount)}
                >
                  <ChevronsRight size={16} />
                </button>
              </div>
            ) : (
              <span>{footerRight}</span>
            )}
          </div>
        </section>

        {propertiesVisible && (
          <button
            type="button"
            className="panel-resizer properties-resizer"
            role="separator"
            aria-orientation="vertical"
            aria-label="Redimensionner le panneau Propriétés"
            title="Glisser pour élargir ou réduire · double-clic pour la largeur par défaut"
            {...propertiesWidth.handleProps}
          />
        )}

        {propertiesVisible && (
          <PropertiesPanel
            entry={explorer.selected}
            demo={demo}
            onOpen={explorer.open}
            onCopyPath={(entry) => void copyPath(entry)}
            onHide={() => setPropertiesVisible(false)}
          />
        )}
      </div>
    </>
  )
}
