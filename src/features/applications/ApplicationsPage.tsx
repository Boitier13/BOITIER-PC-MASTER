import { Activity, ChevronDown, ChevronLeft, ChevronRight, ChevronsUpDown, Filter, Info, Search, Unplug } from 'lucide-react'
import { useMemo, useState } from 'react'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { APP_STATE_LABEL } from '@/domain/labels'
import { useAppState } from '@/store/app-state'

/**
 * Applications installées.
 *
 * La recherche utilise volontairement l'état global `query`, comme dans la
 * maquette (audit B1) : la corrélation avec l'explorateur sera corrigée lors du
 * branchement du moteur réel (phase 5), pas pendant la fondation.
 */
export function ApplicationsPage() {
  const { apps } = useWorkspace()
  const { query, setQuery, openAction } = useAppState()
  const [selected, setSelected] = useState('')

  const rows = useMemo(() => {
    const search = query.toLowerCase()
    return apps.filter((app) => `${app.name} ${app.publisher}`.toLowerCase().includes(search))
  }, [apps, query])

  return (
    <>
      <PageHeading
        eyebrow="APPLICATIONS / INVENTAIRE"
        title="Applications installées"
        description="Inventaire fictif des logiciels de cet environnement."
        action={
          <button className="button secondary" onClick={() => openAction('Actualiser l’inventaire')}>
            <Activity size={15} /> Actualiser l’inventaire
          </button>
        }
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          Applications d’exemple. Les actions Désinstaller et Informations ne lancent aucune commande Windows.
        </span>
      </div>

      <div className="panel app-table-panel">
        <div className="table-controls">
          <label className="table-search">
            <Search size={15} />
            <input
              placeholder="Rechercher une application..."
              aria-label="Rechercher une application"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <button className="button secondary" onClick={() => openAction('Filtrer par éditeur')}>
            <Filter size={15} /> Filtres <ChevronDown size={14} />
          </button>
          <span className="toolbar-spacer" />
          <span className="results-count">{rows.length} applications</span>
        </div>

        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                {['Application', 'Éditeur', 'Version', 'Date d’installation', 'Taille', 'Type', 'État'].map(
                  (heading) => (
                    <th key={heading}>
                      {heading}
                      <ChevronsUpDown size={12} />
                    </th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {rows.map((app, index) => (
                <tr key={app.id} className={selected === app.id ? 'selected-row' : ''} onClick={() => setSelected(app.id)}>
                  <td>
                    <span className={`app-logo app-${index % 5}`}>{app.name.charAt(0)}</span>
                    <strong>{app.name}</strong>
                  </td>
                  <td>{app.publisher}</td>
                  <td>{app.version}</td>
                  <td>{app.installedAt}</td>
                  <td>{app.sizeLabel}</td>
                  <td>
                    <span className="type-tag">{app.installerType}</span>
                  </td>
                  <td>
                    <span className={`state-tag ${app.state === 'system' ? 'system' : ''}`}>
                      <i />
                      {APP_STATE_LABEL[app.state]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="table-footer">
          <span>Affichage de {rows.length} résultats · Données de démonstration</span>
          <div>
            <button className="icon-button" aria-label="Page précédente">
              <ChevronLeft size={16} />
            </button>
            <span className="page-number">1</span>
            <button className="icon-button" aria-label="Page suivante">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>

      <div className="selection-bar">
        <span>
          {selected ? (
            <>
              Sélection : <strong>{rows.find((app) => app.id === selected)?.name ?? ''}</strong>
            </>
          ) : (
            'Sélectionnez une application pour afficher ses options'
          )}
        </span>
        <div>
          <button
            className="button secondary"
            disabled={!selected}
            onClick={() => openAction('Informations détaillées')}
          >
            <Info size={15} /> Informations
          </button>
          <button
            className="button danger"
            disabled={!selected}
            onClick={() => openAction('Désinstaller l’application')}
          >
            <Unplug size={15} /> Désinstaller
          </button>
        </div>
      </div>
    </>
  )
}
