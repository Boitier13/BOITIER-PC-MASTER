import { Activity, ArrowDown, ChevronRight, Database, Download, FileText, TrendingUp, Unplug } from 'lucide-react'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { HISTORY_KIND_LABEL, HISTORY_TABS, matchesHistoryTab, type HistoryTab } from '@/domain/labels'
import type { HistoryKind } from '@/domain/types'
import { useAppState } from '@/store/app-state'

/**
 * Historique et rapports.
 * Compteurs et badge « 24 » conservés tels quels (audit B11) : ils ne
 * correspondent pas aux lignes réellement présentes.
 */
export function HistoryPage() {
  const { history } = useWorkspace()
  const { historyTab, setHistoryTab, openAction } = useAppState()

  const items = history.filter((entry) => matchesHistoryTab(historyTab, entry.kind))

  const stats: [string, string, typeof Database][] = [
    ['Inventaires enregistrés', '12', Database],
    ['Désinstallations', '8', Unplug],
    ['Surveillances', '5', Activity],
    ['Rapports disponibles', '24', FileText],
  ]

  return (
    <>
      <PageHeading
        eyebrow="SUIVI / ACTIVITÉ"
        title="Historique et rapports"
        description="Consultez les opérations et rapports de démonstration."
        action={
          <button className="button secondary" onClick={() => openAction('Exporter les rapports')}>
            <Download size={15} /> Exporter
          </button>
        }
      />

      <div className="history-stats">
        {stats.map(([label, value, Icon]) => (
          <div className="history-stat" key={label}>
            <Icon size={17} />
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div className="panel history-panel">
        <div className="history-tabs" role="tablist">
          {HISTORY_TABS.map((tab) => (
            <button
              role="tab"
              aria-selected={historyTab === tab}
              key={tab}
              onClick={() => setHistoryTab(tab as HistoryTab)}
              className={historyTab === tab ? 'selected' : ''}
            >
              {tab}
              {tab === 'Tous' && <span>24</span>}
            </button>
          ))}
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>
                  Date <ArrowDown size={12} />
                </th>
                <th>Opération</th>
                <th>Éléments concernés</th>
                <th>Résultat</th>
                <th>Rapport</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{item.date}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="history-kind">{HISTORY_KIND_LABEL[item.kind as HistoryKind]}</span>
                  </td>
                  <td>{item.detail}</td>
                  <td>
                    <span className="state-tag">
                      <i />
                      {item.result}
                    </span>
                  </td>
                  <td>
                    <button className="report-link" onClick={() => openAction(`Rapport : ${item.name}`)}>
                      Détails <ChevronRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span>Affichage {items.length} opérations récentes · Données fictives</span>
          <button className="text-link" onClick={() => openAction('Comparer deux inventaires')}>
            Comparer deux inventaires <ChevronRight size={14} />
          </button>
        </div>
      </div>

      <div className="comparison-callout">
        <div className="comparison-icon">
          <TrendingUp size={19} />
        </div>
        <div>
          <strong>Suivez l’évolution de vos disques</strong>
          <span>Comparez deux inventaires enregistrés pour visualiser les changements.</span>
        </div>
        <button className="button secondary" onClick={() => openAction('Comparer deux inventaires')}>
          Comparer des inventaires <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}
