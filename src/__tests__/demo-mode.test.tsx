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

  it('n’affiche aucun résidu fictif sur l’écran de désinstallation', () => {
    renderAt('/uninstall')

    expect(screen.getByText('Aucun résidu analysé')).toBeInTheDocument()
    expect(screen.getByText('0 élément sélectionné · Les éléments système ne sont pas sélectionnables')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Nettoyer les éléments sélectionnés/ })).toBeDisabled()

    // Aucune case à cocher : il n'y a aucun élément à sélectionner.
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0)
    expect(screen.queryByText('Adobe Photoshop 2025')).not.toBeInTheDocument()
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

  it('présente la surveillance comme indisponible, sans résultat simulé', async () => {
    const user = userEvent.setup()
    renderAt('/monitoring')

    expect(screen.getByText('Non disponible')).toBeInTheDocument()
    expect(screen.getByText('Aucun rapport disponible')).toBeInTheDocument()

    const start = screen.getByRole('button', { name: /Démarrer la surveillance/ })
    expect(start).toBeDisabled()
    await user.click(start)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.queryByText('Surveillance simulée')).not.toBeInTheDocument()
  })

  it('affiche un historique vide puis les onglets réellement alimentés', async () => {
    const user = userEvent.setup()
    renderAt('/history')

    expect(screen.getByText('Aucune opération dans cette session')).toBeInTheDocument()
    expect(screen.getByText(/Affichage 0 opération de cette session/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Analyse/ }))
    expect(screen.getByText('Aucune opération de ce type')).toBeInTheDocument()
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
