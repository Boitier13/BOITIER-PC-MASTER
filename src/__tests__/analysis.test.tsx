import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { ServiceError, type SystemService } from '@/services/system-service'
import { analysisReport, fakeService } from '@/__tests__/support/fake-service'

/**
 * Analyse de l'espace : les chiffres affichés doivent venir de la mesure, et
 * une mesure partielle doit être annoncée comme partielle.
 */

function renderAt(service: SystemService, path = '/disk-analysis') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App service={service} />
    </MemoryRouter>,
  )
}

describe('Analyse de l’espace', () => {
  it('affiche uniquement les valeurs du rapport mesuré', async () => {
    const user = userEvent.setup()
    renderAt(fakeService({ analyze: () => Promise.resolve(analysisReport()) }))

    expect(screen.getByText('Aucune mesure dans cette session')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))

    expect(await screen.findByText('128 fichiers')).toBeInTheDocument()
    expect(screen.getAllByText('1 Mo').length).toBeGreaterThan(0)
    expect(screen.getByText('Mesure complète')).toBeInTheDocument()
    expect(screen.getByText(/140 entrées visitées/)).toBeInTheDocument()
    // Catégories et classements issus du rapport, pas d'exemple.
    expect(screen.getAllByText(/Documents/).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/rapport\.pdf/).length).toBeGreaterThan(0)
    // Dossier classé par son contenu direct mesuré.
    expect(screen.getAllByText(/2024/).length).toBeGreaterThan(0)
    expect(screen.queryByText('Aucune mesure dans cette session')).not.toBeInTheDocument()
  })

  it('annonce une mesure partielle et ce qui n’a pas été vu', async () => {
    const user = userEvent.setup()
    renderAt(
      fakeService({
        analyze: () =>
          Promise.resolve(
            analysisReport({ truncated: true, denied: 2, skippedProtected: 3 }),
          ),
      }),
    )

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))

    expect(await screen.findByText('Mesure partielle — plafond d’entrées atteint')).toBeInTheDocument()
    expect(
      screen.getByText(/2 refusées par Windows · 3 dossiers protégés non parcourus/),
    ).toBeInTheDocument()
  })

  it('distingue une mesure annulée d’une mesure complète', async () => {
    const user = userEvent.setup()
    renderAt(
      fakeService({
        analyze: () => Promise.resolve(analysisReport({ cancelled: true, files: 0, totalSizeBytes: 0, byCategory: [] })),
      }),
    )

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))

    expect(await screen.findByText('Mesure annulée — résultats partiels')).toBeInTheDocument()
    expect(screen.getByText('Mesure annulée — résultats partiels')).toBeInTheDocument()
  })

  it('n’affiche aucun chiffre quand la mesure échoue', async () => {
    const user = userEvent.setup()
    renderAt(
      fakeService({
        analyze: () => Promise.reject(new ServiceError('access_denied', 'refus')),
      }),
    )

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))

    expect(await screen.findByText('Mesure impossible')).toBeInTheDocument()
    expect(screen.getByText(/Windows refuse l’accès/)).toBeInTheDocument()
    expect(screen.getByText('Aucune mesure dans cette session')).toBeInTheDocument()
    expect(screen.queryByText('128 fichiers')).not.toBeInTheDocument()
  })

  it('en démonstration, la mesure est annoncée indisponible et le bouton inerte', () => {
    render(<MemoryRouter initialEntries={['/disk-analysis']}><App /></MemoryRouter>)

    expect(screen.getByText(/La mesure réelle n’est pas disponible en démonstration/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Mesurer/ })).toBeDisabled()
    expect(screen.getByText('Aucune mesure dans cette session')).toBeInTheDocument()
  })
})
