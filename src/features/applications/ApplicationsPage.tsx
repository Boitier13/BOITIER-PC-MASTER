import {
  Activity,
  AlertTriangle,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Filter,
  Info,
  Search,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useInstalledApps } from '@/hooks/use-installed-apps'
import { formatBytes, formatCount, formatDate, formatDateTime } from '@/lib/format'
import { ServiceError } from '@/services/system-service'
import { useAppState } from '@/store/app-state'

const INSTALLER_LABELS: Record<string, string> = {
  msi: 'MSI',
  exe: 'EXE',
  msix: 'MSIX',
  unknown: 'Inconnu',
}

/**
 * Applications installées.
 *
 * En mode réel, la table provient exclusivement de `apps_list` (registre
 * Windows, lecture seule). En mode démonstration, elle affiche les fixtures et
 * l'annonce explicitement. Aucune donnée fictive n'est présentée comme réelle :
 * en cas d'échec du moteur, un bandeau d'erreur remplace la table.
 */
export function ApplicationsPage() {
  const demo = useEngineMode() === 'demo'
  const { query: search, setQuery: setGlobalQuery, openAction } = useAppState()
  const { inventory, loading, error, query, setSearch, setScope, setSort, setOffset, reload } =
    useInstalledApps()
  const [selected, setSelected] = useState<string | null>(null)

  // Le champ de recherche global et celui de l'écran partagent la même saisie.
  const searchValue = query.search ?? search

  const rows = inventory?.items ?? []
  const total = inventory?.total ?? 0
  const offset = inventory?.offset ?? 0
  const limit = inventory?.limit ?? rows.length
  const selectedApp = useMemo(() => rows.find((app) => app.id === selected) ?? null, [rows, selected])

  const serviceError = error instanceof ServiceError ? error : null
  const unavailableSources = (inventory?.sources ?? []).filter((source) => !source.accessible)

  return (
    <>
      <PageHeading
        eyebrow="APPLICATIONS / INVENTAIRE"
        title="Applications installées"
        description={
          demo
            ? 'Inventaire fictif : aucune lecture du registre Windows.'
            : 'Inventaire lu dans le registre Windows de ce PC, en lecture seule.'
        }
        action={<DemoLabel />}
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          {demo
            ? 'Données de démonstration. Les actions « Désinstaller » et « Informations » ne lancent aucune commande Windows.'
            : 'Applications lues sur ce PC (registre Windows). Aucune désinstallation n’est exécutée : l’application ne fait que lire et afficher.'}
        </span>
      </div>

      {Boolean(error) && (
        <div className="error-banner" role="alert">
          <AlertTriangle size={16} />
          <div>
            <strong>Inventaire indisponible</strong>
            <span>
              {serviceError?.userMessage ?? 'Le moteur n’a pas pu lire la liste des applications.'}
            </span>
            {serviceError?.message && <small>{serviceError.message}</small>}
          </div>
        </div>
      )}

      {!error && inventory && inventory.sources.length > 0 && (
        <div className="state-note">
          {inventory.sources
            .map(
              (source) =>
                `${source.label} : ${source.accessible ? `${formatCount(source.entries)} entrée(s)` : 'inaccessible'}` +
                (source.denied > 0 ? ` · ${formatCount(source.denied)} refus` : ''),
            )
            .join('  ·  ')}
          {`  ·  lecture ${formatDateTime(inventory.scannedAtMs)}`}
          {unavailableSources.length > 0 && (
            <>
              {' — '}
              {unavailableSources.map((source) => source.error).filter(Boolean).join(' ')}
            </>
          )}
        </div>
      )}

      <div className="panel app-table-panel">
        <div className="table-controls">
          <label className="table-search">
            <Search size={15} />
            <input
              placeholder="Rechercher une application..."
              aria-label="Rechercher une application"
              value={searchValue}
              onChange={(event) => {
                setSearch(event.target.value)
                setGlobalQuery(event.target.value)
              }}
            />
          </label>

          <button
            className={`button ${query.scope === undefined ? 'primary' : 'secondary'}`}
            onClick={() => setScope(undefined)}
          >
            <Filter size={15} /> Toutes
          </button>
          <button
            className={`button ${query.scope === 'machine' ? 'primary' : 'secondary'}`}
            onClick={() => setScope('machine')}
          >
            Machine
          </button>
          <button
            className={`button ${query.scope === 'user' ? 'primary' : 'secondary'}`}
            onClick={() => setScope('user')}
          >
            Utilisateur
          </button>

          <span className="toolbar-spacer" />
          <button className="button secondary" onClick={reload} disabled={loading}>
            <Activity size={15} /> Actualiser
          </button>
          <span className="results-count">
            {loading
              ? 'Lecture…'
              : error
                ? 'Indisponible'
                : `${formatCount(total)} application${total > 1 ? 's' : ''}`}
          </span>
        </div>

        {loading ? (
          <div className="state-note">Lecture du registre des applications en cours…</div>
        ) : rows.length === 0 ? (
          <div className="state-note">
            {error
              ? 'Aucune donnée affichée : le moteur n’a pas répondu.'
              : 'Aucune application ne correspond à cette recherche.'}
          </div>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {[
                    { label: 'Application', sort: 'name' as const },
                    { label: 'Éditeur', sort: null },
                    { label: 'Version', sort: null },
                    { label: 'Date d’installation', sort: 'date' as const },
                    { label: 'Taille', sort: 'size' as const },
                    { label: 'Type', sort: null },
                    { label: 'Emplacement', sort: null },
                  ].map((column) => (
                    <th key={column.label}>
                      {column.sort ? (
                        <button
                          className="text-link"
                          onClick={() => setSort(column.sort as 'name' | 'size' | 'date')}
                          aria-label={`Trier par ${column.label}`}
                        >
                          {column.label}
                          <ChevronsUpDown size={12} />
                        </button>
                      ) : (
                        column.label
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((app, index) => (
                  <tr
                    key={app.id}
                    className={selected === app.id ? 'selected-row' : ''}
                    onClick={() => setSelected(app.id)}
                  >
                    <td>
                      <span className={`app-logo app-${index % 5}`}>{app.name.charAt(0)}</span>
                      <strong>{app.name}</strong>
                      <span className="type-tag">{app.scope === 'user' ? 'Utilisateur' : 'Machine'}</span>
                    </td>
                    <td>{app.publisher ?? '—'}</td>
                    <td>{app.version ?? '—'}</td>
                    <td>{formatDate(app.installedAtMs)}</td>
                    <td>{app.sizeBytes == null ? '—' : `≈ ${formatBytes(app.sizeBytes)}`}</td>
                    <td>
                      <span className="type-tag">{INSTALLER_LABELS[app.installerType] ?? 'Inconnu'}</span>
                    </td>
                    <td title={app.installLocation ?? app.registryPath}>
                      {app.installLocation ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            {demo ? 'Données de démonstration' : 'Registre Windows · lecture seule'}
            {` · ${formatCount(rows.length)} affichée${rows.length > 1 ? 's' : ''} sur ${formatCount(total)}`}
            {inventory && inventory.total > inventory.items.length
              ? ` · ${formatCount(offset + 1)}–${formatCount(offset + rows.length)}`
              : ''}
          </span>
          <div>
            <button
              className="icon-button"
              aria-label="Page précédente"
              disabled={offset === 0 || loading}
              onClick={() => setOffset(Math.max(0, offset - limit))}
            >
              <ChevronLeft size={16} />
            </button>
            <span className="page-number">{Math.floor(offset / Math.max(1, limit)) + 1}</span>
            <button
              className="icon-button"
              aria-label="Page suivante"
              disabled={loading || offset + rows.length >= total}
              onClick={() => setOffset(offset + limit)}
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="selection-bar">
        <span>
          {selectedApp ? (
            <>
              Sélection : <strong>{selectedApp.name}</strong>
              {selectedApp.version ? ` · ${selectedApp.version}` : ''}
            </>
          ) : (
            'Sélectionnez une application pour afficher ses options'
          )}
        </span>
        <div>
          <button
            className="button secondary"
            disabled={!selectedApp}
            onClick={() => openAction('Désinstaller l’application')}
          >
            Désinstaller
          </button>
          <button
            className="button ghost"
            disabled={!selectedApp}
            onClick={() => openAction('Informations sur l’application')}
          >
            Informations
          </button>
        </div>
      </div>

      {selectedApp && (
        <div className="state-note">
          {`Portée : ${selectedApp.scope === 'user' ? 'utilisateur courant' : 'ordinateur'} · `}
          {`Architecture : ${selectedApp.architecture} · `}
          {`Installateur : ${INSTALLER_LABELS[selectedApp.installerType] ?? 'inconnu'} · `}
          {selectedApp.hasUninstaller
            ? 'Désinstalleur présent (jamais exécuté par cette version)'
            : 'Aucun désinstalleur déclaré par Windows'}
          {selectedApp.uninstallString ? ` · Commande déclarée : ${selectedApp.uninstallString}` : ''}
        </div>
      )}
    </>
  )
}
