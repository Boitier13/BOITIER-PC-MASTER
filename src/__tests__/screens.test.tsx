import { render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

/**
 * Vérification exigée par la mission : les **neuf écrans** de la maquette sont
 * toujours présents, à la même adresse, avec le même titre.
 */

export const SCREENS = [
  { path: '/', title: 'Bonjour, Alexandre', breadcrumb: 'Tableau de bord' },
  { path: '/explorer', title: 'Explorateur de fichiers', breadcrumb: 'Explorateur de fichiers' },
  { path: '/inventory', title: 'Inventaire des disques', breadcrumb: 'Inventaire des disques' },
  { path: '/disk-analysis', title: 'Analyse de l’espace', breadcrumb: 'Analyse de l’espace' },
  { path: '/applications', title: 'Applications installées', breadcrumb: 'Applications installées' },
  { path: '/uninstall', title: 'Désinstallation avancée', breadcrumb: 'Désinstallation avancée' },
  {
    path: '/monitoring',
    title: 'Surveillance des installations',
    breadcrumb: 'Surveillance des installations',
  },
  { path: '/history', title: 'Historique et rapports', breadcrumb: 'Historique et rapports' },
  { path: '/settings', title: 'Paramètres', breadcrumb: 'Paramètres' },
] as const

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Les neuf écrans de la maquette', () => {
  it('expose exactement neuf entrées de navigation', () => {
    renderAt('/')
    const nav = screen.getByRole('navigation', { name: 'Navigation principale' })
    expect(within(nav).getAllByRole('button')).toHaveLength(9)
  })

  it.each(SCREENS)('affiche « $breadcrumb » sur $path', ({ path, title, breadcrumb }) => {
    const { container } = renderAt(path)

    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(title)
    expect(container.querySelector('.breadcrumb strong')).toHaveTextContent(breadcrumb)
    expect(container.querySelector('.page-footer')).toBeInTheDocument()
  })

  it('ramène au tableau de bord pour une URL inconnue', () => {
    renderAt('/inexistant')
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Bonjour, Alexandre')
  })

  it('conserve la mention de démonstration permanente', () => {
    const { container } = renderAt('/applications')
    expect(container.querySelector('.demo-banner')).toHaveTextContent('ENVIRONNEMENT DE DÉMO')
    expect(container.querySelector('.mobile-demo')).toHaveTextContent('Données de démonstration')
    expect(container.querySelector('.page-footer')).toHaveTextContent('Aucune donnée réelle n’est modifiée')
  })
})
