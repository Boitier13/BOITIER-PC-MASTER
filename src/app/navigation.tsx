import {
  Activity,
  AppWindow,
  FolderOpen,
  HardDrive,
  History,
  LayoutDashboard,
  Settings,
  Unplug,
} from 'lucide-react'
import type { ComponentType } from 'react'
import { ROUTES, type RoutePath } from '@/app/routes'

/**
 * Navigation latérale — groupes et libellés identiques à la maquette validée.
 * Seul changement : chaque entrée porte une route au lieu d'un état local.
 */

type NavIcon = ComponentType<{ size?: number }>

interface NavItem {
  title: string
  route: RoutePath
  icon: NavIcon
}

interface NavGroup {
  label: string
  items: NavItem[]
}

/**
 * Alias conservé de la maquette : l'écran « Surveillance des installations »
 * utilisait cette enveloppe, qui rend l'icône `Activity` (audit B17).
 * Conservé pour ne rien retirer visuellement ; le rendu est identique.
 */
function EyeIcon({ size = 18 }: { size?: number }) {
  return <Activity size={size} />
}

export const NAV_GROUPS: NavGroup[] = [
  {
    label: 'ESPACE DE TRAVAIL',
    items: [
      { title: 'Tableau de bord', route: ROUTES.dashboard, icon: LayoutDashboard },
      { title: 'Explorateur de fichiers', route: ROUTES.explorer, icon: FolderOpen },
      { title: 'Inventaire des disques', route: ROUTES.inventory, icon: HardDrive },
      { title: 'Analyse de l’espace', route: ROUTES.diskAnalysis, icon: Activity },
    ],
  },
  {
    label: 'APPLICATIONS',
    items: [
      { title: 'Applications installées', route: ROUTES.applications, icon: AppWindow },
      { title: 'Désinstallation avancée', route: ROUTES.uninstall, icon: Unplug },
      { title: 'Surveillance des installations', route: ROUTES.monitoring, icon: EyeIcon },
    ],
  },
  {
    label: 'SUIVI',
    items: [
      { title: 'Historique et rapports', route: ROUTES.history, icon: History },
      { title: 'Paramètres', route: ROUTES.settings, icon: Settings },
    ],
  },
]
