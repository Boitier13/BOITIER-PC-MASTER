import { describe, expect, it } from 'vitest'
import { invokeCommand, isTauriRuntime } from '@/ipc/client'
import { COMMANDS, EVENTS } from '@/ipc/contracts'
import { createSystemService } from '@/services'
import { MockSystemService } from '@/services/mock/mock-system-service'
import { ServiceError } from '@/services/system-service'

const GIB = 1024 ** 3

/**
 * Le contrat `SystemService` doit être utilisable en démonstration sans aucune
 * dépendance système, et refuser explicitement ce qui n'est pas encore prêt.
 */
describe('SystemService — implémentation de démonstration', () => {
  const service = new MockSystemService()

  it('ne revendique aucune capacité système réelle', async () => {
    const capabilities = await service.getCapabilities()
    expect(capabilities.realSystemAccess).toBe(false)
    expect(Object.values(capabilities.capabilities).every((value) => value === false)).toBe(true)
  })

  it('expose les volumes de démonstration en octets', async () => {
    const volumes = await service.listVolumes()
    expect(volumes.map((volume) => volume.letter)).toEqual(['C:', 'D:', 'E:'])
    expect(volumes[0]).toMatchObject({ label: 'Système', kind: 'SSD NVMe' })
    expect(volumes[0].totalBytes).toBe(476 * GIB)
    expect(volumes[0].usedBytes).toBe(312 * GIB)
    expect(volumes[0].usedBytes + volumes[0].freeBytes).toBe(volumes[0].totalBytes)
  })

  it('expose des dossiers d’accès rapide, dont le profil', async () => {
    const folders = await service.listUserFolders()
    expect(folders.map((folder) => folder.id)).toContain('home')
    expect(folders.find((folder) => folder.id === 'home')?.path).toBe('C:\\Utilisateurs\\Alexandre')
  })

  it('liste un dossier : dossiers d’abord, fichiers ensuite, cachés masqués', async () => {
    const listing = await service.listDirectory('C:\\Utilisateurs\\Alexandre')

    expect(listing.path).toBe('C:\\Utilisateurs\\Alexandre')
    expect(listing.parent).toBe('C:\\Utilisateurs')
    expect(listing.entries.map((entry) => entry.name)).toEqual([
      'Bureau',
      'Documents',
      'Images',
      'Projets',
      'Téléchargements',
      'notes_personnelles.txt',
    ])
    expect(listing.entries[0].isDirectory).toBe(true)
    expect(listing.entries.at(-1)?.sizeBytes).toBe(12_480)
    expect(listing.truncated).toBe(false)
  })

  it('inclut les éléments cachés sur demande', async () => {
    const listing = await service.listDirectory('C:\\Utilisateurs\\Alexandre', { includeHidden: true })
    const hidden = listing.entries.find((entry) => entry.name === '.config_projet')
    expect(hidden?.attributes.hidden).toBe(true)
  })

  it('signale les dossiers protégés et refuse les accès refusés', async () => {
    const root = await service.listDirectory('C:\\', { includeHidden: true })
    const protectedEntry = root.entries.find((entry) => entry.name === 'System Volume Information')
    expect(protectedEntry?.isProtected).toBe(true)
    expect(protectedEntry?.accessDenied).toBe(true)

    await expect(service.listDirectory('C:\\Windows\\WinSxS')).rejects.toMatchObject({
      code: 'access_denied',
    })
    await expect(service.listDirectory('C:\\Inexistant')).rejects.toMatchObject({ code: 'not_found' })
    await expect(service.listDirectory('C:\\Utilisateurs\\Alexandre\\notes_personnelles.txt')).rejects.toMatchObject({
      code: 'not_a_directory',
    })
  })

  it('lit les métadonnées d’un fichier précis', async () => {
    const entry = await service.getEntryMetadata('C:\\Utilisateurs\\Alexandre\\Documents\\Rapport_annuel_2026.pdf')
    expect(entry.name).toBe('Rapport_annuel_2026.pdf')
    expect(entry.category).toBe('document')
    expect(entry.type).toBe('Document PDF')
    expect(entry.modifiedAtMs).toBeGreaterThan(0)
    expect(entry.isDirectory).toBe(false)
  })

  it('parcourt récursivement, filtre et agrège les tailles', async () => {
    const result = await service.walk({
      scanId: 'test-walk',
      root: 'C:\\Utilisateurs\\Alexandre',
      options: { search: 'rapport' },
    })

    expect(result.entries.map((entry) => entry.name)).toEqual([
      'Rapport_2025.pdf',
      'Rapport_annuel_2026.pdf',
    ])
    expect(result.stats.matched).toBe(2)
    expect(result.stats.files).toBe(2)
    expect(result.stats.totalSizeBytes).toBeGreaterThan(0)
    expect(result.stats.cancelled).toBe(false)
  })

  it('ne parcourt jamais les dossiers protégés', async () => {
    const result = await service.walk({ scanId: 'protected', root: 'C:\\' })
    expect(result.stats.skippedProtected).toBeGreaterThanOrEqual(1)
    expect(result.entries.some((entry) => entry.name === 'notepad.exe')).toBe(true)
    // Rien sous WinSxS / CSC / System Volume Information.
    expect(result.entries.some((entry) => entry.path.toLowerCase().includes('winsxs\\'))).toBe(false)
  })

  it('rapporte une annulation', async () => {
    const controller = new AbortController()
    controller.abort()

    const result = await service.walk(
      { scanId: 'cancel', root: 'C:\\' },
      { signal: controller.signal, onProgress: () => {} },
    )

    expect(result.stats.cancelled).toBe(true)
    expect(result.entries).toHaveLength(0)
  })

  it('remonte une progression pendant le parcours', async () => {
    const points: number[] = []
    await service.walk(
      { scanId: 'progress', root: 'C:\\' },
      { onProgress: (progress) => points.push(progress.visited) },
    )
    expect(points.length).toBeGreaterThan(0)
    expect(points[0]).toBeGreaterThanOrEqual(0)
  })

  it('pagine et filtre les applications', async () => {
    const all = await service.listInstalledApps()
    expect(all.total).toBe(9)
    expect(all.items).toHaveLength(9)

    const page = await service.listInstalledApps({ offset: 2, limit: 3 })
    expect(page.items).toHaveLength(3)
    expect(page.offset).toBe(2)

    const adobe = await service.listInstalledApps({ search: 'adobe' })
    expect(adobe.total).toBe(1)
    expect(adobe.items[0].name).toBe('Adobe Photoshop 2025')
  })

  it('n’expose aucune méthode destructive', () => {
    const methods = Object.getOwnPropertyNames(MockSystemService.prototype)
    expect(methods.filter((name) => /delete|remove|move|rename|write|format|destroy/i.test(name))).toEqual([])
  })

  it('refuse les opérations destructives non implémentées', async () => {
    await expect(service.requestUninstall('app-0')).rejects.toBeInstanceOf(ServiceError)
    await expect(service.requestUninstall('app-0')).rejects.toMatchObject({ code: 'unimplemented' })
    await expect(service.planCleanup(['residue-0'])).rejects.toMatchObject({ code: 'unimplemented' })
  })

  it('retombe sur la démonstration hors runtime Tauri', () => {
    expect(isTauriRuntime()).toBe(false)
    expect(createSystemService('system').mode).toBe('demo')
  })
})

describe('Client IPC', () => {
  it('refuse toute commande hors runtime Tauri', async () => {
    await expect(invokeCommand(COMMANDS.ping)).rejects.toMatchObject({ code: 'not_tauri' })
  })

  it('refuse une commande inconnue', async () => {
    await expect(invokeCommand('rm_rf' as never)).rejects.toBeInstanceOf(ServiceError)
  })

  it('ne déclare que des commandes en lecture, sans écriture ni suppression', () => {
    const commands = Object.values(COMMANDS).sort()
    expect(commands).toEqual([
      'app_info',
      'db_status',
      'directory_list',
      'engine_status',
      'path_metadata',
      'ping',
      'user_folders',
      'volumes_list',
      'walk_cancel',
      'walk_start',
    ])
    expect(commands.some((name) => /delete|remove|move|rename|write|uninstall/i.test(name))).toBe(false)
  })

  it('déclare l’événement de progression', () => {
    expect(EVENTS.scanProgress).toBe('scan://progress')
  })
})
