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
          <span className="demo-dot" /> ENVIRONNEMENT DE DÉMO
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
                  {item.title === 'Désinstallation avancée' && <span className="nav-count">3</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="engine-card">
            <div className="engine-icon">
              <Unplug size={17} />
            </div>
            <div>
              <strong>Moteur système</strong>
              <span>Non connecté</span>
            </div>
            <span className="engine-status" />
          </div>
          <div className="profile">
            <div className="avatar">AL</div>
            <div>
              <strong>Alexandre Laurent</strong>
              <span>Administrateur</span>
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
              <span className="demo-dot" /> Données de démonstration · Aucune action Windows réelle
            </div>
            <Outlet />
            <footer className="page-footer">
              <span>
                BOITIER PC MASTER <b>v0.9.4</b>
              </span>
              <span>
                <ShieldCheck size={13} /> Démonstration locale · Aucune donnée réelle n’est modifiée
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
              Le moteur système Windows n’est pas encore connecté. Cette interface est une démonstration :
              aucune opération réelle ne sera effectuée.
            </p>
            <div className="modal-demo-note">
              <Info size={16} /> Données fictives — aucune modification de Windows
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
