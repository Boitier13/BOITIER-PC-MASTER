import { Activity, ArrowDown, ChevronRight, Database, Download, FileText, TrendingUp, Unplug } from 'lucide-react'
import { PageHeading } from '@/components/PageHeading'
import { HISTORY_KIND_LABEL, HISTORY_TABS, type HistoryTab } from '@/domain/labels'
import { formatDateTime } from '@/lib/format'
import { useMeasurements } from '@/store/measurements'
import { useAppState } from '@/store/app-state'

const TAB_HINTS: Record<Exclude<HistoryTab, 'Tous'>, string> = {
  Inventaire: 'Les inventaires enregistrés arriveront avec la base locale (lot D). Aucun instantané n’est conservé pour l’instant.',
  Désinstallation: 'Aucune désinstallation n’est possible : la fonction arrive au lot C2.',
  Analyse: 'Chaque mesure d’espace réellement exécutée apparaît ici, avec son périmètre et son résultat.',
  Surveillance: 'La surveillance réelle du système arrive au lot C4.',
}

/**
 * Historique et rapports.
 *
 * L'écran ne montre que des opérations **réellement exécutées pendant la
 * session** : aucune ligne d'exemple, aucun compteur figé. Le journal n'est pas
 * persisté et le dit explicitement.
 */
export function HistoryPage() {
  const { journal } = useMeasurements()
  const { historyTab, setHistoryTab } = useAppState()

  const items = journal.filter((entry) => historyTab === 'Tous' || HISTORY_KIND_LABEL[entry.kind] === historyTab)

  const stats: [string, string, typeof Database][] = [
    ['Mesures exécutées', String(journal.length), Database],
    ['Mesures complètes', String(journal.filter((entry) => entry.result === 'Terminé').length), FileText],
    ['Mesures partielles', String(journal.filter((entry) => entry.result === 'Partiel').length), Activity],
    ['Mesures annulées ou en échec', String(journal.filter((entry) => entry.result !== 'Terminé' && entry.result !== 'Partiel').length), Unplug],
  ]

  return (
    <>
      <PageHeading
        eyebrow="SUIVI / ACTIVITÉ"
        title="Historique et rapports"
        description="Opérations réellement exécutées pendant cette session."
        action={
          <button
            className="button secondary"
            disabled
            title="L’export sera disponible avec la base locale (lot D)"
          >
            <Download size={15} /> Exporter
          </button>
        }
      />

      <div className="info-banner">
        <span>
          Journal de session : il n’est conservé que jusqu’à la fermeture de l’application. Aucune opération
          n’y est inscrite si elle n’a pas réellement eu lieu.
        </span>
      </div>

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
              {tab === 'Tous' && <span>{journal.length}</span>}
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
                <th>Périmètre</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td>{formatDateTime(item.atMs)}</td>
                  <td>
                    <strong>{item.name}</strong>
                    <span className="history-kind">{HISTORY_KIND_LABEL[item.kind]}</span>
                  </td>
                  <td>{item.detail}</td>
                  <td>
                    <span className="state-tag">
                      <i />
                      {item.result}
                    </span>
                  </td>
                  <td>Cette session</td>
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <div className="empty-state">
              <Activity size={22} />
              <strong>
                {historyTab === 'Tous' ? 'Aucune opération dans cette session' : 'Aucune opération de ce type'}
              </strong>
              <p>
                {historyTab === 'Tous'
                  ? 'Lancez une mesure d’espace depuis le tableau de bord ou l’analyse de l’espace : elle apparaîtra ici dès qu’elle sera terminée.'
                  : TAB_HINTS[historyTab as Exclude<HistoryTab, 'Tous'>]}
              </p>
            </div>
          )}
        </div>
        <div className="table-footer">
          <span>
            Affichage {items.length} opération{items.length > 1 ? 's' : ''} de cette session · non conservée
            après fermeture
          </span>
          <button
            className="text-link"
            disabled
            title="La comparaison arrive avec la base locale (lot D)"
          >
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
          <span>
            La comparaison de deux inventaires nécessite la base locale : elle est prévue au lot D, aucune
            donnée n’est conservée pour l’instant.
          </span>
        </div>
        <button className="button secondary" disabled title="Disponible au lot D">
          Comparer des inventaires <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}
