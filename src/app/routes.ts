/**
 * Routes de l'application.
 *
 * La maquette utilisait un état local (`useState`) : aucune URL, aucun lien
 * profond, rechargement -> retour au tableau de bord (audit B25). Le routeur
 * rétablit des URL réelles, avec historique et boutons précédent/suivant.
 */
export const ROUTES = {
  dashboard: '/',
  explorer: '/explorer',
  inventory: '/inventory',
  diskAnalysis: '/disk-analysis',
  applications: '/applications',
  uninstall: '/uninstall',
  monitoring: '/monitoring',
  history: '/history',
  settings: '/settings',
} as const

export type RoutePath = (typeof ROUTES)[keyof typeof ROUTES]

/** Libellés affichés dans le fil d'Ariane, identiques à ceux de la maquette. */
export const ROUTE_LABELS: Record<RoutePath, string> = {
  '/': 'Tableau de bord',
  '/explorer': 'Explorateur de fichiers',
  '/inventory': 'Inventaire des disques',
  '/disk-analysis': 'Analyse de l’espace',
  '/applications': 'Applications installées',
  '/uninstall': 'Désinstallation avancée',
  '/monitoring': 'Surveillance des installations',
  '/history': 'Historique et rapports',
  '/settings': 'Paramètres',
}
