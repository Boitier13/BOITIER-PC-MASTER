import { render, screen } from '@testing-library/react'
import { HashRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

/**
 * Vérifie le montage réellement utilisé par `main.tsx` (HashRouter), que les
 * autres tests remplacent par un MemoryRouter.
 */
describe('Démarrage de l’application', () => {
  it('monte l’application avec HashRouter et affiche le tableau de bord', async () => {
    render(
      <HashRouter>
        <App />
      </HashRouter>,
    )

    // Le prénom vient du profil lu par le moteur : l'affichage est asynchrone.
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(/^Bonjour/)
    expect(document.querySelector('.app-shell')).toBeInTheDocument()
  })
})
