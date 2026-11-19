import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { analysisReport, fakeService } from '@/__tests__/support/fake-service'

/**
 * Historique : le journal ne contient que des opérations réellement exécutées,
 * et ses compteurs sont calculés à partir de ce journal.
 */

function renderAt(path: string, service = fakeService({ analyze: () => Promise.resolve(analysisReport()) })) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App service={service} />
    </MemoryRouter>,
  )
}

describe('Historique et rapports', () => {
  it('est vide tant que rien n’a été exécuté', async () => {
    renderAt('/history')

    expect(await screen.findByText('Aucune opération dans cette session')).toBeInTheDocument()
    expect(screen.getByText(/Affichage 0 opération de cette session/)).toBeInTheDocument()
    expect(screen.getByText('Mesures exécutées')).toBeInTheDocument()
  })

  it('inscrit une mesure réellement exécutée et calcule ses compteurs', async () => {
    const user = userEvent.setup()
    renderAt('/disk-analysis')

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))
    expect(await screen.findByText('128 fichiers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Historique et rapports' }))

    expect(await screen.findByText('Mesure d’espace')).toBeInTheDocument()
    expect(screen.getByText(/128 fichiers · 1 Mo/)).toBeInTheDocument()
    expect(screen.getByText('Terminé')).toBeInTheDocument()
    expect(screen.getByText(/Affichage 1 opération de cette session/)).toBeInTheDocument()
    // L'onglet « Tous » compte ce journal, et rien d'autre.
    expect(screen.getByRole('tab', { name: /Tous/ })).toHaveTextContent('1')
  })
})
