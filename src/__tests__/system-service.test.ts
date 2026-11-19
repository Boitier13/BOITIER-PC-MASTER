import { describe, expect, it } from 'vitest'
import { invokeCommand, isTauriRuntime } from '@/ipc/client'
import { COMMANDS } from '@/ipc/contracts'
import { createSystemService } from '@/services'
import { MockSystemService } from '@/services/mock/mock-system-service'
import { ServiceError } from '@/services/system-service'

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

  it('expose les volumes de démonstration', async () => {
    const volumes = await service.listVolumes()
    expect(volumes.map((volume) => volume.letter)).toEqual(['C:', 'D:', 'E:'])
    expect(volumes[0]).toMatchObject({ label: 'Système', kind: 'SSD NVMe', totalGb: 476, usedGb: 312 })
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

  it('filtre les entrées par type, comme l’explorateur', async () => {
    const video = await service.searchEntries({ typeFilter: 'Vidéo' })
    expect(video.total).toBe(1)
    expect(video.items[0].name).toBe('Vidéo_démonstration.mp4')

    const archives = await service.searchEntries({ typeFilter: 'Archive' })
    expect(archives.items.map((entry) => entry.name)).toContain('Sauvegarde_projet.zip')
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

  it('ne contient que les quatre commandes de la phase 1', () => {
    expect(Object.values(COMMANDS).sort()).toEqual(['app_info', 'db_status', 'engine_status', 'ping'])
  })
})
