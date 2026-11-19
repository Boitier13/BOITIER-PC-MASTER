import { AlertTriangle, LockKeyhole, Package, ShieldCheck, Sparkles, Trash2, Unplug } from 'lucide-react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { CONFIDENCE_CLASS, CONFIDENCE_LABEL } from '@/domain/labels'
import { useAppState, type UninstallMode } from '@/store/app-state'

/**
 * Désinstallation avancée.
 *
 * Phase 1 : aucune opération réelle (ni désinstallation, ni suppression, ni
 * accès au registre). Le tableau des résidus reste l'exemple fictif de la
 * maquette. Les garde-fous visuels — éléments système non sélectionnables — sont
 * conservés tels quels.
 */
export function UninstallPage() {
  const { residues } = useWorkspace()
  const { uninstallMode, setUninstallMode, selectedResidues, setSelectedResidues, openAction } = useAppState()

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

  const toggle = (id: string) => {
    setSelectedResidues(
      selectedResidues.includes(id) ? selectedResidues.filter((value) => value !== id) : [...selectedResidues, id],
    )
  }

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
        <button
          className="button primary"
          onClick={() =>
            openAction(
              uninstallMode === 'Standard'
                ? 'Choisir une application'
                : 'Choisir une application à désinstaller',
            )
          }
        >
          <Unplug size={15} /> Choisir une application
        </button>
      </div>

      <section className="panel residues-panel">
        <div className="panel-heading">
          <div>
            <div className="eyebrow">ÉTAPE 2 · EXEMPLE DE RÉSULTATS</div>
            <h2>Résidus potentiels détectés</h2>
            <p>Exemple de résultats fictifs associés à Adobe Photoshop 2025.</p>
          </div>
          <span className="potential-tag">
            <AlertTriangle size={13} /> À examiner
          </span>
        </div>

        <div className="confidence-legend">
          <span>
            <i className="conf-high" /> Confiance élevée
          </span>
          <span>
            <i className="conf-mid" /> Probable
          </span>
          <span>
            <i className="conf-low" /> Incertain
          </span>
          <span>
            <LockKeyhole size={13} /> Élément partagé ou système
          </span>
        </div>

        <div className="table-wrap">
          <table className="data-table residue-table">
            <thead>
              <tr>
                <th>Élément détecté</th>
                <th>Type</th>
                <th>Emplacement</th>
                <th>Application associée</th>
                <th>Confiance</th>
                <th>Action proposée</th>
                <th>Sélection</th>
              </tr>
            </thead>
            <tbody>
              {residues.map((residue) => (
                <tr key={residue.id}>
                  <td>
                    <strong>{residue.name}</strong>
                  </td>
                  <td>{residue.type}</td>
                  <td className="path-cell" title={residue.path}>
                    {residue.path}
                  </td>
                  <td>{residue.appLabel}</td>
                  <td>
                    <span className={`confidence ${CONFIDENCE_CLASS[residue.confidence]}`}>
                      <i />
                      {CONFIDENCE_LABEL[residue.confidence]}
                    </span>
                  </td>
                  <td>{residue.action}</td>
                  <td>
                    <input
                      type="checkbox"
                      aria-label={`Sélectionner ${residue.name}`}
                      disabled={residue.confidence === 'system'}
                      checked={selectedResidues.includes(residue.id)}
                      onChange={() => toggle(residue.id)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="residue-footer">
          <span>
            {selectedResidues.length} élément(s) sélectionné(s) · Les éléments système ne sont pas sélectionnables
          </span>
          <button
            className="button danger"
            disabled={!selectedResidues.length}
            onClick={() => openAction('Confirmer l’examen des résidus')}
          >
            <Trash2 size={15} /> Nettoyer les éléments sélectionnés
          </button>
        </div>
      </section>
    </>
  )
}
