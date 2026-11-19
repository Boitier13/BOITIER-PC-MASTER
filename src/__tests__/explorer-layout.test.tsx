import { fireEvent, render, screen, within } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { beforeEach, describe, expect, it } from 'vitest'
import { App } from '@/app/App'

/**
 * Mise en page de l'explorateur : panneaux redimensionnables, panneau
 * Propriétés repliable, colonnes ajustables et pagination d'affichage.
 *
 * Ces tests ne vérifient aucune mesure réelle (jsdom ne calcule pas les
 * styles) : ils garantissent que les commandes existent, sont nommées,
 * accessibles et déclenchent les bons états.
 */

function renderExplorer() {
  return render(
    <MemoryRouter initialEntries={['/explorer']}>
      <App />
    </MemoryRouter>,
  )
}

async function waitForTable() {
  return within(await screen.findByRole('table'))
}

beforeEach(() => {
  window.localStorage.clear()
})

describe('explorateur — mise en page', () => {
  it('expose une poignée pour chaque panneau redimensionnable', async () => {
    renderExplorer()
    await waitForTable()

    expect(screen.getByRole('separator', { name: 'Redimensionner le panneau Emplacements' })).toBeInTheDocument()
    expect(screen.getByRole('separator', { name: 'Redimensionner le panneau Propriétés' })).toBeInTheDocument()
  })

  it('permet d’ajuster les colonnes de la liste', async () => {
    renderExplorer()
    const table = await waitForTable()

    const handles = table.getAllByRole('button', { name: /Redimensionner la colonne/ })
    expect(handles).toHaveLength(4)
    expect(handles[0]).toHaveAccessibleName('Redimensionner la colonne Nom')
  })

  it('règle la largeur d’une colonne au clavier', async () => {
    const { container } = renderExplorer()
    await waitForTable()

    const columns = () => Array.from(container.querySelectorAll('colgroup col'))
    expect(columns()[0].getAttribute('style')).toContain('250px')

    const handle = screen.getByRole('button', { name: 'Redimensionner la colonne Nom' })
    fireEvent.keyDown(handle, { key: 'ArrowRight' })
    expect(columns()[0].getAttribute('style')).toContain('266px')

    fireEvent.keyDown(handle, { key: 'Home' })
    expect(columns()[0].getAttribute('style')).toContain('250px')
  })

  it('replie puis rouvre le panneau Propriétés', async () => {
    renderExplorer()
    await waitForTable()

    expect(
      screen.getByRole('separator', { name: 'Redimensionner le panneau Propriétés' }),
    ).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Replier le panneau Propriétés' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Masquer le panneau Propriétés' }))

    expect(
      screen.queryByRole('separator', { name: 'Redimensionner le panneau Propriétés' }),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: 'Replier le panneau Propriétés' }),
    ).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Afficher le panneau Propriétés' }))
    expect(
      screen.getByRole('separator', { name: 'Redimensionner le panneau Propriétés' }),
    ).toBeInTheDocument()
  })

  it('masque la pagination quand une seule page suffit', async () => {
    renderExplorer()
    await waitForTable()

    expect(screen.queryByRole('button', { name: 'Page suivante' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Première page' })).not.toBeInTheDocument()
  })
})
