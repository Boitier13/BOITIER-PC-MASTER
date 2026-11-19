import { ChevronRight, Cpu, FileText, Folder, History, Info, Monitor, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { useEngineDiagnostics, type EngineState } from '@/hooks/use-engine-diagnostics'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { formatDateTime } from '@/lib/format'
import { useAppState } from '@/store/app-state'

/**
 * Paramètres.
 *
 * Comportements conservés tels quels (audit B8/B9) : les interrupteurs agissent
 * directement sur le DOM (`classList.toggle`) et non sur l'état React ; la
 * langue et la rétention ne sont pas enregistrées ; l'entrée active du menu
 * reste figée sur « Apparence ».
 *
 * Ces éléments seront rebranchés sur `SettingsService` + SQLite en phase 2,
 * avec persistance réelle et `aria-checked` synchronisé.
 */
const ENGINE_STATE_LABEL: Record<EngineState, string> = {
  probing: 'Vérification en cours',
  connected: 'Connecté (moteur Rust)',
  demo: 'Démonstration',
  unavailable: 'Indisponible',
}

const CAPABILITY_LABELS: Array<[string, string]> = [
  ['volumes', 'Volumes'],
  ['fileInventory', 'Fichiers'],
  ['installedApps', 'Applications'],
  ['uninstall', 'Désinstallation'],
  ['residueScan', 'Résidus'],
  ['monitoring', 'Surveillance'],
  ['reports', 'Rapports'],
]

export function SettingsPage() {
  const { dark, setDark, notify } = useAppState()
  const demo = useEngineMode() === 'demo'
  const engine = useEngineDiagnostics()

  const sections = [
    { icon: Monitor, title: 'Apparence' },
    { icon: ShieldCheck, title: 'Diagnostic moteur' },
    { icon: SlidersHorizontal, title: 'Préférences d’analyse' },
    { icon: History, title: 'Historique' },
    { icon: ShieldCheck, title: 'Sécurité et confirmations' },
    { icon: FileText, title: 'Rapports' },
    { icon: Info, title: 'À propos' },
  ]

  return (
    <>
      <PageHeading
        eyebrow="CONFIGURATION"
        title="Paramètres"
        description="Personnalisez votre expérience BOITIER PC MASTER."
        action={<DemoLabel />}
      />

      <div className="settings-layout">
        <nav className="settings-nav">
          {sections.map((section, index) => {
            const Icon = section.icon
            return (
              <button
                className={index === 0 ? 'active' : ''}
                key={section.title}
                onClick={() => {
                  if (index === 0) {
                    document.getElementById('appearance')?.scrollIntoView({ behavior: 'smooth' })
                  } else if (section.title === 'Diagnostic moteur') {
                    document.getElementById('diagnostic')?.scrollIntoView({ behavior: 'smooth' })
                  } else {
                    notify(`${section.title} — catégorie sélectionnée`)
                  }
                }}
              >
                <Icon size={16} />
                {section.title}
                <ChevronRight size={14} />
              </button>
            )
          })}
        </nav>

        <div className="settings-content">
          <section className="panel setting-panel" id="appearance">
            <div className="setting-heading">
              <div className="setting-icon">
                <Monitor size={18} />
              </div>
              <div>
                <h2>Apparence</h2>
                <p>Choisissez le thème de l’application.</p>
              </div>
            </div>
            <div className="setting-option">
              <div>
                <strong>Thème de couleur</strong>
                <span>Le thème est appliqué immédiatement.</span>
              </div>
              <div className="theme-options">
                <button className={!dark ? 'chosen' : ''} onClick={() => setDark(false)}>
                  <span className="theme-preview light-preview" />
                  Clair
                </button>
                <button className={dark ? 'chosen' : ''} onClick={() => setDark(true)}>
                  <span className="theme-preview dark-preview" />
                  Sombre
                </button>
                <button onClick={() => notify('Le thème système sera disponible avec le moteur Windows')}>
                  <span className="theme-preview system-preview" />
                  Système
                </button>
              </div>
            </div>
            <div className="setting-option">
              <div>
                <strong>Langue de l’interface</strong>
                <span>Langue utilisée dans les menus et rapports.</span>
              </div>
              <select defaultValue="Français" aria-label="Langue">
                <option>Français</option>
                <option>English (bientôt)</option>
              </select>
            </div>
          </section>

          <section className="panel setting-panel">
            <div className="setting-heading">
              <div className="setting-icon violet">
                <SlidersHorizontal size={18} />
              </div>
              <div>
                <h2>Préférences d’analyse</h2>
                <p>Paramètres de démonstration pour les futurs inventaires.</p>
              </div>
            </div>
            {[
              ['Inclure les fichiers cachés', 'Les fichiers système ne sont pas modifiés.'],
              ['Demander confirmation avant chaque opération', 'Les éléments sont toujours examinés avant action.'],
              [
                'Exclure les éléments partagés et système',
                'Ces éléments ne seront jamais proposés à la suppression.',
              ],
            ].map(([title, description], index) => (
              <div className="setting-option" key={title}>
                <div>
                  <strong>{title}</strong>
                  <span>{description}</span>
                </div>
                <button
                  role="switch"
                  aria-checked={index !== 0}
                  aria-label={title}
                  className={`toggle ${index !== 0 ? 'on' : ''}`}
                  onClick={(event) => event.currentTarget.classList.toggle('on')}
                >
                  <i />
                </button>
              </div>
            ))}
          </section>

          <section className="panel setting-panel">
            <div className="setting-heading">
              <div className="setting-icon green">
                <FileText size={18} />
              </div>
              <div>
                <h2>Rapports et historique</h2>
                <p>Options de conservation de vos informations.</p>
              </div>
            </div>
            <div className="setting-option">
              <div>
                <strong>Emplacement des rapports</strong>
                <span>Les rapports sont stockés localement dans la future application.</span>
              </div>
              <button className="button secondary" onClick={() => notify('Le moteur Windows n’est pas connecté')}>
                Choisir un dossier <Folder size={14} />
              </button>
            </div>
            <div className="setting-option">
              <div>
                <strong>Conservation de l’historique</strong>
                <span>Supprimer les données après la période sélectionnée.</span>
              </div>
              <select defaultValue="Jamais" aria-label="Conservation de l’historique">
                <option>Jamais</option>
                <option>30 jours</option>
                <option>90 jours</option>
                <option>1 an</option>
              </select>
            </div>
          </section>

          <section className="panel setting-panel" id="diagnostic">
            <div className="setting-heading">
              <div className="setting-icon">
                <ShieldCheck size={18} />
              </div>
              <div>
                <h2>Diagnostic du moteur</h2>
                <p>Mesures réelles de la liaison avec le moteur Rust, sans donnée simulée.</p>
              </div>
            </div>

            <div className="table-wrap">
              <table className="data-table">
                <tbody>
                  <tr>
                    <td>Environnement</td>
                    <td>
                      {engine.runtime === 'tauri'
                        ? 'Application de bureau (Tauri)'
                        : 'Navigateur — hors application de bureau'}
                    </td>
                  </tr>
                  <tr>
                    <td>État du moteur</td>
                    <td>{ENGINE_STATE_LABEL[engine.state]}</td>
                  </tr>
                  <tr>
                    <td>Version du binaire</td>
                    <td>
                      {engine.info
                        ? `${engine.info.name} ${engine.info.version} (${engine.info.platform}/${engine.info.arch})`
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Aller-retour IPC</td>
                    <td>{engine.pingReply ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Volumes lus</td>
                    <td>{engine.volumeCount == null ? '—' : String(engine.volumeCount)}</td>
                  </tr>
                  <tr>
                    <td>Dossier personnel</td>
                    <td>{engine.homePath ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Élévation</td>
                    <td>{engine.capabilities?.elevation ?? '—'}</td>
                  </tr>
                  <tr>
                    <td>Capacités annoncées</td>
                    <td>
                      {engine.capabilities
                        ? CAPABILITY_LABELS.map(
                            ([key, label]) =>
                              `${label} ${engine.capabilities?.capabilities[key as keyof typeof engine.capabilities.capabilities] ? '✓' : '✗'}`,
                          ).join(' · ')
                        : '—'}
                    </td>
                  </tr>
                  <tr>
                    <td>Dernière vérification</td>
                    <td>{formatDateTime(engine.checkedAtMs)}</td>
                  </tr>
                  {engine.error && (
                    <tr>
                      <td>Erreur</td>
                      <td>
                        {engine.error.userMessage} ({engine.error.code})
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <button className="button secondary" onClick={engine.refresh}>
              <ShieldCheck size={14} /> Relancer le diagnostic
            </button>

            {demo && (
              <p className="state-note">
                Mode démonstration : les valeurs ci-dessus décrivent le moteur factice, pas ce PC.
              </p>
            )}
          </section>

          <section className="panel about-card">
            <div className="brand-mark">
              <Cpu size={21} />
            </div>
            <div>
              <strong>BOITIER PC MASTER</strong>
              <p>
                Version {engine.info?.version ?? '—'} ·{' '}
                {demo ? 'Interface de démonstration' : 'Application de bureau, lecture seule'}
              </p>
              <span>Explorez. Maîtrisez. Nettoyez.</span>
            </div>
            <button
              className="button secondary"
              onClick={() =>
                notify(
                  `BOITIER PC MASTER ${engine.info?.version ?? ''} — ${demo ? 'démonstration' : 'moteur local, lecture seule'}`,
                )
              }
            >
              À propos <Info size={14} />
            </button>
          </section>
        </div>
      </div>
    </>
  )
}
