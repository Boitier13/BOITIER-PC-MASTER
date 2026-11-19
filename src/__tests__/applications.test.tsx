import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'
import type { AppInventory, InstalledApp } from '@/domain/types'
import { ServiceError, type SystemService } from '@/services/system-service'

/**
 * Écran Applications : la table doit venir du moteur, jamais d'un repli
 * silencieux sur les données de démonstration.
 */

function app(overrides: Partial<InstalledApp> = {}): InstalledApp {
  return {
    id: 'HKLM64\\Uninstall\\{1}',
    name: 'Google Chrome',
    publisher: 'Google LLC',
    version: '131.0.6778.86',
    installedAtMs: Date.UTC(2026, 10, 6),
    sizeBytes: 1_160_000_000,
    installLocation: 'C:\\Program Files\\Google\\Chrome',
    uninstallString: 'MsiExec.exe /X{1}',
    quietUninstallString: null,
    productCode: '{1}',
    installerType: 'msi',
    scope: 'machine',
    architecture: 'x64',
    hasUninstaller: true,
    registryPath: 'HKLM64\\Uninstall\\{1}',
    ...overrides,
  }
}

function inventoryOf(items: InstalledApp[]): AppInventory {
  return {
    items,
    total: items.length,
    offset: 0,
    limit: 100,
    sources: [
      { id: 'hklm64', label: 'Ordinateur — applications 64 bits', accessible: true, entries: items.length, denied: 0, error: null },
      { id: 'hkcu', label: 'Utilisateur courant', accessible: true, entries: 0, denied: 0, error: null },
    ],
    scannedAtMs: Date.UTC(2026, 10, 19, 9, 30),
  }
}

/** Service minimal : seules les méthodes utilisées par l'écran répondent. */
function serviceReturning(payload: AppInventory | Error): SystemService {
  const unimplemented = () =>
    Promise.reject(new ServiceError('unimplemented', 'Non utilisé par ce test.'))

  return {
    mode: 'system',
    getAppInfo: () =>
      Promise.resolve({
        name: 'BOITIER PC MASTER',
        version: '0.1.0',
        platform: 'windows',
        arch: 'x86_64',
        engineMode: 'system',
        realSystemAccess: true,
      }),
    getCapabilities: () =>
      Promise.resolve({
        mode: 'system',
        capabilities: {
          volumes: true,
          fileInventory: true,
          installedApps: true,
          uninstall: false,
          residueScan: false,
          monitoring: false,
          reports: false,
        },
        elevation: 'none',
        realSystemAccess: true,
      }),
    ping: () => Promise.resolve('pong'),
    listVolumes: () =>
      Promise.resolve([
        {
          id: 'volume-c',
          letter: 'C:',
          label: 'Système',
          kind: 'SSD',
          kindCode: 'ssd',
          filesystem: 'NTFS',
          totalBytes: 512 * 1024 ** 3,
          usedBytes: 300 * 1024 ** 3,
          freeBytes: 212 * 1024 ** 3,
          isRemovable: false,
          accent: '#4388ff',
        },
      ]),
    listUserFolders: () => Promise.resolve([{ id: 'home', label: 'Profil', path: 'C:\\Users\\alice' }]),
    listDirectory: unimplemented,
    getEntryMetadata: unimplemented,
    walk: unimplemented,
    listInstalledApps: () => (payload instanceof Error ? Promise.reject(payload) : Promise.resolve(payload)),
    listResidues: unimplemented,
    listHistory: unimplemented,
    listSnapshots: unimplemented,
    compareSnapshots: unimplemented,
    getSettings: unimplemented,
    saveSettings: unimplemented,
    requestUninstall: unimplemented,
    planCleanup: unimplemented,
  }
}

function renderApplications(service?: SystemService) {
  return render(
    <MemoryRouter initialEntries={['/applications']}>
      <App service={service} />
    </MemoryRouter>,
  )
}

describe('Applications installées', () => {
  it('affiche les applications renvoyées par le moteur', async () => {
    renderApplications(
      serviceReturning(
        inventoryOf([
          app(),
          app({
            id: 'HKCU\\Uninstall\\VSCode',
            name: 'Visual Studio Code',
            publisher: 'Microsoft Corporation',
            version: '1.95.3',
            installerType: 'exe',
            scope: 'user',
            productCode: null,
            registryPath: 'HKCU\\Uninstall\\VSCode',
          }),
        ]),
      ),
    )

    expect(await screen.findByText('2 applications')).toBeInTheDocument()
    expect(screen.getByText('Google Chrome')).toBeInTheDocument()
    expect(screen.getByText('Visual Studio Code')).toBeInTheDocument()
    expect(screen.getByText(/Registre Windows · lecture seule/)).toBeInTheDocument()
    // Aucune étiquette de démonstration quand le moteur répond.
    expect(screen.queryByText('DONNÉES DE DÉMO')).not.toBeInTheDocument()
  })

  it('affiche les colonnes demandées, y compris le type et l’emplacement', async () => {
    renderApplications(serviceReturning(inventoryOf([app()])))

    expect(await screen.findByText('Google Chrome')).toBeInTheDocument()
    expect(screen.getByText('MSI')).toBeInTheDocument()
    expect(screen.getByText('C:\\Program Files\\Google\\Chrome')).toBeInTheDocument()
    expect(screen.getByText('06/11/2026')).toBeInTheDocument()
    expect(screen.getByText(/≈/)).toBeInTheDocument()
  })

  it('affiche une erreur explicite et aucune donnée fictive si le moteur échoue', async () => {
    renderApplications(
      serviceReturning(
        new ServiceError('ipc_failure', 'Le registre est inaccessible.', undefined, 'io_error'),
      ),
    )

    expect(await screen.findByText('Inventaire indisponible')).toBeInTheDocument()
    expect(screen.getByText('Le registre est inaccessible.')).toBeInTheDocument()
    expect(screen.queryByText('Google Chrome')).not.toBeInTheDocument()
    // Aucun compteur de démonstration ne vient masquer la panne.
    expect(screen.getByText('Indisponible')).toBeInTheDocument()
    expect(screen.queryByText('9 applications')).not.toBeInTheDocument()
  })

  it('reste en démonstration hors runtime Tauri, avec étiquette explicite', async () => {
    renderApplications()

    expect(await screen.findByText('9 applications')).toBeInTheDocument()
    expect(screen.getAllByText('DONNÉES DE DÉMO').length).toBeGreaterThan(0)
  })

  it('filtre la liste depuis le champ de recherche', async () => {
    const user = userEvent.setup()
    renderApplications(
      serviceReturning(
        inventoryOf([
          app(),
          app({ id: 'HKLM64\\Uninstall\\{2}', name: '7-Zip 24.09', publisher: 'Igor Pavlov' }),
        ]),
      ),
    )

    await screen.findByText('7-Zip 24.09')
    await user.type(screen.getByLabelText('Rechercher une application'), 'zip')

    // Le filtrage est fait par le moteur : le service factice ne filtre pas,
    // mais la requête doit au moins être transmise sans casser l'écran.
    expect(await screen.findByText('2 applications')).toBeInTheDocument()
  })
})
