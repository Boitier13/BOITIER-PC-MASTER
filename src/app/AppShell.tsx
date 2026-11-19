import {
  AlertTriangle,
  Bell,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  Info,
  MoreHorizontal,
  Search,
  ShieldCheck,
  Unplug,
  X,
} from 'lucide-react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { NAV_GROUPS } from '@/app/navigation'
import { ROUTES, ROUTE_LABELS, type RoutePath } from '@/app/routes'
import { useEngineDiagnostics, type EngineDiagnostics } from '@/hooks/use-engine-diagnostics'
import type { ReactNode } from 'react'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useAppState } from '@/store/app-state'

/**
 * Coque de l'application : barre latérale, barre supérieure, zone de contenu,
 * modale d'action et notification.
 *
 * Rendu identique à celui de la maquette, à une exception près : la navigation
 * passe par le routeur (URL réelles) au lieu d'un état local.
 */
export function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const { dark, query, setQuery, dialog, closeDialog, toast, clearToast, notify } = useAppState()
  const engineMode = useEngineMode()
  const demo = engineMode === 'demo'
  const engine = useEngineDiagnostics()

  const engineView = describeEngine(engine)
  const userName = userNameFromPath(engine.homePath)
  const userInitials = userName
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .slice(0, 2)
    .toUpperCase()

  const currentPath = location.pathname as RoutePath
  const currentLabel = ROUTE_LABELS[currentPath] ?? ROUTE_LABELS[ROUTES.dashboard]

  return (
    <div className={`app-shell ${dark ? 'theme-dark' : 'theme-light'}`}>
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">
            <Cpu size={21} />
          </div>
          <div>
            <strong>
              BOITIER <span>PC</span>
            </strong>
            <small>MASTER</small>
          </div>
          <button
            className="icon-button collapse"
            aria-label="Réduire le menu"
            onClick={() => notify('Menu latéral prêt à être réduit dans l’application Windows')}
          >
            <ChevronsUpDown size={15} />
          </button>
        </div>

        <div className="demo-banner">
          <span className="demo-dot" /> {demo ? 'ENVIRONNEMENT DE DÉMO' : 'MOTEUR LOCAL · LECTURE SEULE'}
        </div>

        <nav className="side-nav" aria-label="Navigation principale">
          {NAV_GROUPS.map((group) => (
            <div className="nav-group" key={group.label}>
              <p>{group.label}</p>
              {group.items.map((item) => (
                <button
                  key={item.title}
                  onClick={() => navigate(item.route)}
                  aria-current={location.pathname === item.route ? 'page' : undefined}
                  className={`nav-item ${location.pathname === item.route ? 'active' : ''}`}
                >
                  <item.icon size={17} />
                  <span>{item.title}</span>
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className={`engine-card engine-${engine.state}`} title={engineView.hint}>
            <div className="engine-icon">{engineView.icon}</div>
            <div>
              <strong>{engineView.title}</strong>
              <span>{engineView.detail}</span>
            </div>
            <span className="engine-status" />
          </div>
          <div className="profile" title={engine.homePath ?? 'Profil Windows non lisible'}>
            <div className="avatar">{userInitials || '—'}</div>
            <div>
              <strong>{userName}</strong>
              <span>{demo ? 'Démonstration' : engine.homePath ? 'Profil Windows' : 'Profil non lisible'}</span>
            </div>
            <MoreHorizontal size={18} />
          </div>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb">
            <span>BOITIER PC MASTER</span>
            <ChevronRight size={14} />
            <strong>{currentLabel}</strong>
          </div>
          <div className="top-actions">
            <label className="global-search">
              <Search size={16} />
              <input
                aria-label="Recherche globale"
                placeholder="Rechercher partout..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
              <kbd>⌘ K</kbd>
            </label>
            <span className="top-divider" />
            <button
              className="icon-button notif"
              aria-label="Notifications"
              onClick={() => notify('Aucune nouvelle notification')}
            >
              <Bell size={18} />
              <i />
            </button>
            <button
              className="top-avatar"
              onClick={() => navigate(ROUTES.settings)}
              aria-label="Ouvrir les paramètres"
            >
              AL
            </button>
          </div>
        </header>

        <div className="page-scroll">
          <div className="page-content">
            <div className="mobile-demo">
              <span className="demo-dot" /> {demo ? 'Données de démonstration · Aucune action Windows réelle' : 'Moteur local · Lecture seule · Aucune écriture'}
            </div>
            <Outlet />
            <footer className="page-footer">
              <span>
                BOITIER PC MASTER <b>v0.9.4</b>
              </span>
              <span>
                <ShieldCheck size={13} />{' '}
                {demo
                  ? 'Démonstration locale · Aucune donnée réelle n’est modifiée'
                  : 'Moteur local · Lecture seule · Aucun fichier n’est modifié'}
              </span>
            </footer>
          </div>
        </div>
      </main>

      {toast && (
        <div className="toast-message">
          <Info size={17} />
          {toast}
          <button onClick={clearToast} aria-label="Fermer">
            <X size={15} />
          </button>
        </div>
      )}

      {dialog && (
        <div
          className="modal-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeDialog()
          }}
        >
          <div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close icon-button" onClick={closeDialog} aria-label="Fermer">
              <X size={18} />
            </button>
            <div className="modal-icon">
              <AlertTriangle size={22} />
            </div>
            <h2 id="modal-title">{dialog}</h2>
            <p>
              Cette action n’est pas disponible dans cette version. Aucune opération réelle ne sera effectuée :
              aucun fichier n’est supprimé, déplacé, renommé ou modifié.
            </p>
            <div className="modal-demo-note">
              <Info size={16} /> {demo ? 'Données fictives — aucune modification de Windows' : 'Moteur local en lecture seule — aucune écriture'}
            </div>
            <div className="modal-actions">
              <button className="button secondary" onClick={closeDialog}>
                Annuler
              </button>
              <button
                className="button primary"
                onClick={() => {
                  closeDialog()
                  notify('Action de démonstration enregistrée — aucune opération Windows effectuée')
                }}
              >
                Compris
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/**
 * Libellé de la carte moteur : dérivé de la sonde réelle, jamais écrit en dur.
 */
function describeEngine(engine: EngineDiagnostics): {
  icon: ReactNode
  title: string
  detail: string
  hint: string
} {
  switch (engine.state) {
    case 'demo':
      return {
        icon: <Info size={17} />,
        title: 'Mode démonstration',
        detail: 'Aucune lecture système',
        hint: 'Les données affichées sont fictives et étiquetées comme telles.',
      }
    case 'probing':
      return {
        icon: <Unplug size={17} />,
        title: 'Connexion…',
        detail: 'Vérification du moteur',
        hint: 'Interrogation du moteur système en cours.',
      }
    case 'connected':
      return {
        icon: <ShieldCheck size={17} />,
        title: 'Moteur Rust connecté',
        detail: `Lecture seule · ${engine.volumeCount ?? 0} volume(s)`,
        hint: `Moteur ${engine.info?.version ?? 'inconnu'} — ${engine.info?.platform ?? ''}/${engine.info?.arch ?? ''}`,
      }
    case 'unavailable':
    default:
      return {
        icon: <AlertTriangle size={17} />,
        title: 'Moteur indisponible',
        detail: 'Paramètres › Diagnostic',
        hint: engine.error?.userMessage ?? 'Le moteur système n’a pas répondu.',
      }
  }
}

/** Dernier segment du dossier personnel : C:\Users\alice → alice. */
function userNameFromPath(homePath: string | null): string {
  if (!homePath) return 'Session locale'
  const segments = homePath.split(/[\\/]+/).filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : 'Session locale'
}
