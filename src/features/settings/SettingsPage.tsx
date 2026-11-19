import { ChevronRight, Cpu, FileText, Folder, History, Info, Monitor, ShieldCheck, SlidersHorizontal } from 'lucide-react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
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
export function SettingsPage() {
  const { dark, setDark, notify } = useAppState()

  const sections = [
    { icon: Monitor, title: 'Apparence' },
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
                onClick={() =>
                  index === 0
                    ? document.getElementById('appearance')?.scrollIntoView({ behavior: 'smooth' })
                    : notify(`${section.title} — catégorie sélectionnée`)
                }
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

          <section className="panel about-card">
            <div className="brand-mark">
              <Cpu size={21} />
            </div>
            <div>
              <strong>BOITIER PC MASTER</strong>
              <p>Version 0.9.4 · Interface de démonstration</p>
              <span>Explorez. Maîtrisez. Nettoyez.</span>
            </div>
            <button
              className="button secondary"
              onClick={() => notify('BOITIER PC MASTER — version de démonstration 0.9.4')}
            >
              À propos <Info size={14} />
            </button>
          </section>
        </div>
      </div>
    </>
  )
}
