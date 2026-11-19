import {
  Activity,
  ArrowDown,
  Check,
  Database,
  ExternalLink,
  File,
  Folder,
  Info,
  Pause,
  Play,
  Zap,
} from 'lucide-react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { useAppState } from '@/store/app-state'

/**
 * Surveillance des installations — état simulé.
 * Aucun instantané, aucun différentiel : l'observation réelle arrive en phase 8.
 */
export function MonitoringPage() {
  const { monitoring, setMonitoring, openAction } = useAppState()

  const steps = [
    'Créer un état de référence',
    'Démarrer la surveillance',
    'Observer les changements',
    'Arrêter et générer un rapport',
  ]

  const descriptions = [
    'Capture de référence des éléments présents avant installation.',
    'Lance une observation visuelle de démonstration.',
    'Peut se poursuivre pendant la configuration initiale.',
    'Résumé structuré des changements observés et supposés.',
  ]

  return (
    <>
      <PageHeading
        eyebrow="OUTILS / OBSERVATION"
        title="Surveillance des installations"
        description="Visualisez les étapes de création d’un rapport de changements."
        action={<DemoLabel />}
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          La surveillance réelle du système n’est pas implémentée. Les étapes et résultats ci-dessous sont
          illustratifs.
        </span>
      </div>

      <div className="monitor-layout">
        <section className="panel monitor-main">
          <div className="panel-heading">
            <div>
              <h2>Nouvelle surveillance</h2>
              <p>Un instantané avant/après permet de repérer les changements.</p>
            </div>
            <span className={`monitor-state ${monitoring ? 'running' : 'idle'}`}>
              <i />
              {monitoring ? 'Surveillance simulée' : 'En attente'}
            </span>
          </div>

          <div className="step-list">
            {steps.map((step, index) => {
              const done = index === 0 || (monitoring && index < 3)
              const current = index === 3 && monitoring
              return (
                <div className={`monitor-step ${done ? 'done' : current ? 'current' : ''}`} key={step}>
                  <div className="step-marker">{done ? <Check size={14} /> : index + 1}</div>
                  <div>
                    <strong>{step}</strong>
                    <p>{descriptions[index]}</p>
                  </div>
                  <span>{index === 0 ? 'Prêt' : monitoring && index === 1 ? 'En cours' : 'À venir'}</span>
                </div>
              )
            })}
          </div>

          <div className="monitor-controls">
            <button className="button secondary" onClick={() => openAction('Créer l’état de référence')}>
              <Database size={15} /> Créer l’état de référence
            </button>
            {!monitoring ? (
              <button className="button primary" onClick={() => setMonitoring(true)}>
                <Play size={15} /> Démarrer la surveillance
              </button>
            ) : (
              <>
                <button
                  className="button secondary"
                  onClick={() => openAction('Poursuivre pendant la configuration')}
                >
                  <ArrowDown size={15} /> Poursuivre pendant la configuration
                </button>
                <button
                  className="button danger"
                  onClick={() => {
                    setMonitoring(false)
                    openAction('Arrêter et générer le rapport')
                  }}
                >
                  <Pause size={15} /> Arrêter et générer le rapport
                </button>
              </>
            )}
          </div>

          <div className="monitor-note">
            <Info size={15} /> État simulé uniquement. Aucune modification système n’est suivie.
          </div>
        </section>

        <aside className="panel monitor-aside">
          <div className="panel-heading">
            <div>
              <h2>Types de changements</h2>
              <p>Éléments inclus dans un rapport</p>
            </div>
          </div>
          {[
            { icon: File, label: 'Fichiers créés, modifiés, supprimés' },
            { icon: Folder, label: 'Dossiers créés' },
            { icon: Database, label: 'Clés et valeurs du registre' },
            { icon: Activity, label: 'Services et processus' },
            { icon: Zap, label: 'Démarrage et tâches planifiées' },
          ].map((change) => (
            <div className="change-type" key={change.label}>
              <change.icon size={16} />
              <span>{change.label}</span>
              <Check size={14} />
            </div>
          ))}
          <div className="observed-key">
            <strong>Dans le rapport</strong>
            <span>
              <i className="observed-dot" /> Changement observé
            </span>
            <span>
              <i className="assumed-dot" /> Association supposée
            </span>
          </div>
        </aside>
      </div>

      <section className="panel sample-report">
        <div className="panel-heading">
          <div>
            <h2>Exemple de rapport</h2>
            <p>Visualisation d’un rapport fictif d’installation · 18 novembre 2026</p>
          </div>
          <button className="button secondary" onClick={() => openAction('Ouvrir le rapport de démonstration')}>
            Ouvrir le rapport <ExternalLink size={14} />
          </button>
        </div>
        <div className="report-stats">
          {[
            ['Fichiers créés', '24', 'observé'],
            ['Dossiers ajoutés', '6', 'observé'],
            ['Entrées registre', '12', 'supposé'],
            ['Services / tâches', '2', 'supposé'],
          ].map(([label, value, kind]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
              <small className={kind}>
                <i />
                {kind === 'observé' ? 'Changement observé' : 'Association supposée'}
              </small>
            </div>
          ))}
        </div>
      </section>
    </>
  )
}
