import { AlertTriangle, ArrowRight, LockKeyhole, Package, ShieldCheck, Sparkles, Trash2, Unplug } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { CONFIDENCE_CLASS, CONFIDENCE_LABEL } from '@/domain/labels'
import type { Confidence } from '@/domain/types'
import { ROUTES } from '@/app/routes'
import { useAppState, type UninstallMode } from '@/store/app-state'

/** Légende des niveaux de confiance, conservée pour la future analyse (lot C2). */
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low', 'system']

/**
 * Désinstallation avancée.
 *
 * Aucune analyse de résidus n'a lieu pour l'instant : l'écran ne montre donc
 * **aucun** résultat. Il conserve la sélection du mode, les garde-fous et la
 * description de ce qui sera proposé au lot C2, sans jamais simuler de résidu.
 */
export function UninstallPage() {
  const navigate = useNavigate()
  const { uninstallMode, setUninstallMode } = useAppState()

  const modes: {
    name: UninstallMode
    sub: string
    description: string
    icon: typeof Package
  }[] = [
    {
      name: 'Standard',
      sub: 'Désinstallation classique',
      description: 'Lance le désinstallateur officiel. Aucun résidu n’est recherché.',
      icon: Package,
    },
    {
      name: 'Avancé',
      sub: 'Mode recommandé',
      description: 'Désinstalle, puis propose d’examiner les résidus potentiels.',
      icon: Sparkles,
    },
    {
      name: 'Approfondi',
      sub: 'Analyse poussée',
      description: 'Recherche étendue avec niveaux de confiance et validation requise.',
      icon: ShieldCheck,
    },
  ]

  return (
    <>
      <PageHeading
        eyebrow="APPLICATIONS / NETTOYAGE"
        title="Désinstallation avancée"
        description="Choisissez le niveau d’analyse souhaité avant toute intervention."
        action={<DemoLabel />}
      />

      <div className="uninstall-disclaimer">
        <ShieldCheck size={19} />
        <div>
          <strong>Vous gardez le contrôle à chaque étape</strong>
          <p>
            Les éléments détectés ne sont jamais supprimés automatiquement. Éléments partagés ou système toujours
            exclus des suppressions.
          </p>
        </div>
      </div>

      <div className="info-banner">
        <AlertTriangle size={17} />
        <span>
          L’analyse de résidus et la désinstallation ne sont pas encore disponibles (lot C2). Cet écran ne
          présente donc aucun résultat : rien n’est simulé, rien n’est supprimé.
        </span>
      </div>

      <div className="mode-grid">
        {modes.map((mode, index) => (
          <button
            key={mode.name}
            className={`mode-card ${uninstallMode === mode.name ? 'selected' : ''}`}
            onClick={() => setUninstallMode(mode.name)}
          >
            <div className="mode-card-top">
              <div className="mode-icon">
                <mode.icon size={19} />
              </div>
              {index === 1 && <span className="recommended">RECOMMANDÉ</span>}
              <span className={`radio-dot ${uninstallMode === mode.name ? 'checked' : ''}`}>
                {uninstallMode === mode.name && <i />}
              </span>
            </div>
            <strong>{mode.name}</strong>
            <span className="mode-subtitle">{mode.sub}</span>
            <p>{mode.description}</p>
          </button>
        ))}
      </div>

      <div className="uninstall-start">
        <div>
          <strong>Prêt à examiner une application ?</strong>
          <span>
            Mode sélectionné : <b>{uninstallMode}</b> · Aucune désinstallation réelle ne sera lancée.
          </span>
        </div>
        <button className="button primary" onClick={() => navigate(ROUTES.applications)}>
          <Unplug size={15} /> Voir les applications installées <ArrowRight size={14} />
        </button>
      </div>

      <section className="panel residues-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">ÉTAPE 2 · ANALYSE DES RÉSIDUS</div>
            <h2>Résidus potentiels</h2>
            <p>Aucune analyse n’a été effectuée : la détection réelle arrive au lot C2.</p>
          </div>
          <span className="potential-tag">
            <AlertTriangle size={13} /> Non disponible
          </span>
        </div>

        <div className="confidence-legend">
          <span>
            <i className="conf-high" /> {CONFIDENCE_LABEL.high}
          </span>
          <span>
            <i className="conf-mid" /> {CONFIDENCE_LABEL.medium}
          </span>
          <span>
            <i className="conf-low" /> {CONFIDENCE_LABEL.low}
          </span>
          <span>
            <LockKeyhole size={13} /> {CONFIDENCE_LABEL.system} · jamais sélectionnable
          </span>
        </div>

        <div className="empty-state">
          <Trash2 size={22} />
          <strong>Aucun résidu analysé</strong>
          <p>
            Quand l’analyse existera, chaque élément proposé portera son niveau de confiance
            (<span className={`confidence ${CONFIDENCE_CLASS.medium}`}>Probable</span>, etc.) et restera soumis à
            votre validation. Aucun exemple n’est affiché en attendant.
          </p>
        </div>

        <div className="residue-footer">
          <span>0 élément sélectionné · Les éléments système ne sont pas sélectionnables</span>
          <button className="button danger" disabled title="Disponible au lot C2">
            <Trash2 size={15} /> Nettoyer les éléments sélectionnés
          </button>
        </div>
      </section>
    </>
  )
}
