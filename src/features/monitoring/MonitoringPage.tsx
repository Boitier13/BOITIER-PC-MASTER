import {
  Activity,
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
 * Surveillance des installations — **non disponible**.
 *
 * L'écran décrit le flux prévu et reste inerte : aucun instantané n'est pris,
 * aucune observation n'est enregistrée. Les compteurs d'un rapport ne peuvent
 * donc pas exister et ne sont pas affichés.
 */
export function MonitoringPage() {
  const { openAction } = useAppState()

  const steps = [
    {
      title: 'Créer un état de référence',
      description: 'Capture de référence des éléments présents avant l’installation.',
    },
    {
      title: 'Démarrer la surveillance',
      description: 'Observation des fichiers, dossiers et entrées de registre concernés.',
    },
    {
      title: 'Observer les changements',
      description: 'L’observation peut se poursuivre pendant la configuration initiale.',
    },
    {
      title: 'Arrêter et générer un rapport',
      description: 'Résumé structuré des changements observés et des associations supposées.',
    },
  ]

  return (
    <>
      <PageHeading
        eyebrow="OUTILS / OBSERVATION"
        title="Surveillance des installations"
        description="Voici comment fonctionnera la surveillance, une fois disponible."
        action={<DemoLabel />}
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          La surveillance réelle n’est pas implémentée (lot C4). Aucun instantané n’est pris et aucun rapport
          n’est produit : cet écran décrit le futur flux, sans résultat simulé.
        </span>
      </div>

      <div className="monitor-layout">
        <section className="panel monitor-main">
          <div className="panel-heading">
            <div>
              <h2>Nouvelle surveillance</h2>
              <p>Un instantané avant/après permettra de repérer les changements.</p>
            </div>
            <span className="monitor-state idle">
              <i />
              Non disponible
            </span>
          </div>

          <div className="step-list">
            {steps.map((step, index) => (
              <div className="monitor-step" key={step.title}>
                <div className="step-marker">{index + 1}</div>
                <div>
                  <strong>{step.title}</strong>
                  <p>{step.description}</p>
                </div>
                <span>À venir</span>
              </div>
            ))}
          </div>

          <div className="monitor-controls">
            <button
              className="button secondary"
              disabled
              title="Disponible au lot C4"
              onClick={() => openAction('Créer l’état de référence')}
            >
              <Database size={15} /> Créer l’état de référence
            </button>
            <button className="button primary" disabled title="Disponible au lot C4">
              <Play size={15} /> Démarrer la surveillance
            </button>
            <button className="button danger" disabled title="Disponible au lot C4">
              <Pause size={15} /> Arrêter et générer le rapport
            </button>
          </div>

          <div className="monitor-note">
            <Info size={15} /> Aucune observation n’est enregistrée. Rien n’est modifié sur le système.
          </div>
        </section>

        <aside className="panel monitor-aside">
          <div className="panel-heading">
            <div>
              <h2>Types de changements</h2>
              <p>Éléments prévus dans un futur rapport</p>
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
            <h2>Rapport de surveillance</h2>
            <p>Aucun rapport n’a été produit</p>
          </div>
          <button className="button secondary" disabled title="Disponible au lot C4">
            Ouvrir le rapport <ExternalLink size={14} />
          </button>
        </div>
        <div className="empty-state">
          <File size={22} />
          <strong>Aucun rapport disponible</strong>
          <p>
            Les rapports de surveillance seront produits au lot C4. D’ici là, aucun compteur de changements
            n’est affiché : il n’en existe aucun.
          </p>
        </div>
      </section>
    </>
  )
}
