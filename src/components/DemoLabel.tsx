import { useEngineMode } from '@/hooks/use-engine-mode'

/**
 * Étiquette d'origine des données affichées.
 *
 * En mode démonstration : « DONNÉES DE DÉMO ». En mode réel : « LECTURE
 * RÉELLE · LECTURE SEULE ». L'étiquette ne prétend jamais à une donnée réelle
 * quand le moteur de démonstration est actif, et inversement.
 */
export function DemoLabel() {
  const mode = useEngineMode()
  return (
    <span className="demo-label">
      <span className="demo-dot" /> {mode === 'demo' ? 'DONNÉES DE DÉMO' : 'LECTURE RÉELLE · LECTURE SEULE'}
    </span>
  )
}
