import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { App } from '@/app/App'
import { isTauriRuntime } from '@/ipc/client'
import { createSystemService } from '@/services'

function renderAt(path: string) {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <App />
    </MemoryRouter>,
  )
}

describe('Mode démonstration', () => {
  it('démarre en mode démonstration, hors runtime Tauri', async () => {
    expect(isTauriRuntime()).toBe(false)

    const service = createSystemService()
    expect(service.mode).toBe('demo')

    const capabilities = await service.getCapabilities()
    expect(capabilities.mode).toBe('demo')
    expect(capabilities.realSystemAccess).toBe(false)
    expect(capabilities.elevation).toBe('none')
  })

  it('affiche les données de démonstration (3 disques, 9 applications, 7 éléments)', async () => {
    const service = createSystemService()
    expect(await service.listVolumes()).toHaveLength(3)
    expect((await service.listInstalledApps()).total).toBe(9)
    expect((await service.listDirectory('C:\\Utilisateurs\\Alexandre')).entries).toHaveLength(6)
  })

  it('navigue entre les écrans depuis la barre latérale', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('button', { name: 'Explorateur de fichiers' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Explorateur de fichiers')

    await user.click(screen.getByRole('button', { name: 'Historique et rapports' }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Historique et rapports')
  })

  it('filtre les applications avec la recherche', async () => {
    const user = userEvent.setup()
    renderAt('/applications')

    expect(await screen.findByText('9 applications')).toBeInTheDocument()

    await user.type(screen.getByLabelText('Rechercher une application'), 'chrome')

    expect(await screen.findByText('1 application')).toBeInTheDocument()
    expect(screen.getByText('Google Chrome')).toBeInTheDocument()
    expect(screen.queryByText('Mozilla Firefox')).not.toBeInTheDocument()
  })

  it('affiche le dossier de départ de l’explorateur (profil fictif)', async () => {
    renderAt('/explorer')

    expect(await screen.findByText('6 éléments · Données fictives')).toBeInTheDocument()
    expect(screen.getByText('notes_personnelles.txt')).toBeInTheDocument()
    expect(screen.queryByText('.config_projet')).not.toBeInTheDocument()
  })

  it('ouvre la modale d’action et la referme', async () => {
    const user = userEvent.setup()
    renderAt('/applications')

    const uninstallButton = screen.getByRole('button', { name: 'Désinstaller' })
    expect(uninstallButton).toBeDisabled()

    await user.click(await screen.findByText('Google Chrome'))
    await user.click(screen.getByRole('button', { name: 'Désinstaller' }))

    const dialog = screen.getByRole('dialog')
    expect(within(dialog).getByRole('heading', { name: 'Désinstaller l’application' })).toBeInTheDocument()
    expect(dialog).toHaveTextContent(/Aucune opération réelle ne sera effectuée/i)

    await user.click(within(dialog).getByRole('button', { name: 'Compris' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByText(/Action de démonstration enregistrée/)).toBeInTheDocument()
  })

  it('sélectionne les résidus sans permettre les éléments système', async () => {
    const user = userEvent.setup()
    renderAt('/uninstall')

    expect(screen.getByText(/2 élément\(s\) sélectionné\(s\)/)).toBeInTheDocument()

    const systemCheckbox = screen.getByLabelText('Sélectionner Bibliothèque partagée')
    expect(systemCheckbox).toBeDisabled()

    await user.click(screen.getByLabelText('Sélectionner Clé de configuration'))
    expect(screen.getByText(/3 élément\(s\) sélectionné\(s\)/)).toBeInTheDocument()
  })

  it('bascule le thème depuis les paramètres', async () => {
    const user = userEvent.setup()
    const { container } = renderAt('/settings')

    const shell = () => container.querySelector('.app-shell')
    expect(shell()).toHaveClass('theme-dark')

    await user.click(screen.getByRole('button', { name: 'Clair' }))
    expect(shell()).toHaveClass('theme-light')

    await user.click(screen.getByRole('button', { name: 'Sombre' }))
    expect(shell()).toHaveClass('theme-dark')
  })

  it('simule la surveillance des installations', async () => {
    const user = userEvent.setup()
    renderAt('/monitoring')

    expect(screen.getByText('En attente')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Démarrer la surveillance' }))
    expect(screen.getByText('Surveillance simulée')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Arrêter et générer le rapport' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('filtre l’historique par onglet', async () => {
    const user = userEvent.setup()
    renderAt('/history')

    expect(screen.getByText('Affichage 4 opérations récentes · Données fictives')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Analyse/ }))
    expect(screen.getByText('Affichage 1 opérations récentes · Données fictives')).toBeInTheDocument()
  })

  it('ne déclenche aucun appel réseau au chargement des neuf écrans', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('Appel réseau interdit : l’application doit fonctionner hors ligne.')
    })
    const xhrSpy = vi.spyOn(window.XMLHttpRequest.prototype, 'open')

    for (const path of ['/', '/explorer', '/inventory', '/disk-analysis', '/applications', '/uninstall', '/monitoring', '/history', '/settings']) {
      const { unmount } = renderAt(path)
      unmount()
    }

    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhrSpy).not.toHaveBeenCalled()
  })
})
