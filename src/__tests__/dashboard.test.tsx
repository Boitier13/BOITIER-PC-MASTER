import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import { ServiceError, type SystemService } from '@/services/system-service'
import { analysisReport, fakeService } from '@/__tests__/support/fake-service'

/**
 * Tableau de bord : aucune valeur de fichier ni de répartition ne doit exister
 * avant une mesure réelle ; après mesure, les chiffres affichés sont ceux du
 * rapport.
 */

function renderAt(service: SystemService, path = '/') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App service={service} />
    </MemoryRouter>,
  )
}

describe('Tableau de bord', () => {
  it('affiche les volumes et les applications réellement lus', async () => {
    renderAt(fakeService())

    // 1 volume, 512 Go, 300 Go utilisés, 42 applications.
    expect((await screen.findAllByText('SSD')).length).toBeGreaterThan(0)
    expect(screen.getByText('300 Go')).toBeInTheDocument()
    expect(screen.getByText('212 Go')).toBeInTheDocument()
    expect(await screen.findByText('42')).toBeInTheDocument()
    expect(screen.getByText('Registre Windows · lecture seule')).toBeInTheDocument()
  })

  it('n’invente ni nombre de fichiers ni répartition avant toute mesure', async () => {
    renderAt(fakeService())

    expect((await screen.findAllByText('Aucune mesure dans cette session')).length).toBeGreaterThan(0)
    expect(screen.getByText('Aucun espace mesuré')).toBeInTheDocument()
    // La carte « Fichiers mesurés » affiche un tiret, jamais un chiffre.
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
    expect(screen.queryByText('Non mesuré')).not.toBeInTheDocument()
    // Plus aucune valeur de la maquette.
    expect(screen.queryByText('124 806')).not.toBeInTheDocument()
    expect(screen.queryByText('2,1 To')).not.toBeInTheDocument()
    expect(screen.queryByText('684 Go')).not.toBeInTheDocument()
  })

  it('reprend les valeurs mesurées dans la session', async () => {
    const user = userEvent.setup()
    renderAt(fakeService({ analyze: () => Promise.resolve(analysisReport()) }), '/disk-analysis')

    await user.click(screen.getByRole('button', { name: /Mesurer/ }))
    expect(await screen.findByText('128 fichiers')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Tableau de bord' }))

    expect(await screen.findByText('128')).toBeInTheDocument()
    expect(screen.getByText('1 Mo')).toBeInTheDocument()
    expect(screen.getByText('Documents')).toBeInTheDocument()
    expect(screen.getByText('Images')).toBeInTheDocument()
    expect(screen.queryByText('Aucun espace mesuré')).not.toBeInTheDocument()
  })

  it('signale l’indisponibilité du moteur sans afficher de chiffre à la place', async () => {
    const failing = fakeService({ analyze: () => Promise.reject(new ServiceError('not_available', 'absent')) })
    const service: SystemService = {
      ...failing,
      listInstalledApps: () => Promise.reject(new ServiceError('ipc_failure', 'panne')),
    }

    renderAt(service)

    expect(await screen.findByText('Moteur indisponible')).toBeInTheDocument()
    expect(screen.getAllByText('Aucune mesure dans cette session').length).toBeGreaterThan(0)
  })

  it('nomme le profil réellement lu par le moteur', async () => {
    renderAt(fakeService())

    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent('Bonjour, alice')
  })
})
