import type {
  AnalysisReport,
  AppInventory,
  Volume,
  UserFolder,
} from '@/domain/types'
import { ServiceError, type SystemService } from '@/services/system-service'

/**
 * Moteur factice pour les tests d'écran.
 *
 * Il respecte le contrat `SystemService` en mode `system` : tout ce qui n'est
 * pas explicitement fourni échoue avec `unimplemented`, jamais avec une valeur
 * inventée. C'est ce qui garantit qu'un écran testé ici n'affiche que ce que le
 * moteur lui a réellement donné.
 */

export const VOLUME_C: Volume = {
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
}

export const HOME: UserFolder = { id: 'home', label: 'Profil', path: 'C:\\Users\\alice' }

export function analysisReport(overrides: Partial<AnalysisReport> = {}): AnalysisReport {
  return {
    root: 'C:\\',
    scannedAtMs: Date.UTC(2026, 10, 19, 10, 41),
    elapsedMs: 1200,
    files: 128,
    folders: 12,
    totalSizeBytes: 1_048_576,
    visited: 140,
    denied: 0,
    skippedProtected: 0,
    truncated: false,
    cancelled: false,
    byCategory: [
      { category: 'document', files: 3, bytes: 786_432 },
      { category: 'image', files: 1, bytes: 262_144 },
    ],
    topFolders: [{ path: 'C:\\Documents\\2024', bytes: 4096, files: 1 }],
    largestFiles: [
      { name: 'rapport.pdf', path: 'C:\\Documents\\rapport.pdf', bytes: 4096, modifiedAtMs: null, category: 'document' },
    ],
    ...overrides,
  }
}

export interface FakeServiceOptions {
  analyze?: (root: string) => Promise<AnalysisReport>
  volumes?: Volume[]
  appsTotal?: number
}

export function fakeService(options: FakeServiceOptions = {}): SystemService {
  const unimplemented = () => Promise.reject(new ServiceError('unimplemented', 'Non implémenté dans ce test.'))
  const volumes = options.volumes ?? [VOLUME_C]
  const appsTotal = options.appsTotal ?? 42

  const inventory: AppInventory = {
    items: [],
    total: appsTotal,
    offset: 0,
    limit: 1,
    sources: [],
    scannedAtMs: Date.UTC(2026, 10, 19),
  }

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
    listVolumes: () => Promise.resolve(volumes),
    listUserFolders: () => Promise.resolve([HOME]),
    listDirectory: unimplemented,
    getEntryMetadata: unimplemented,
    walk: unimplemented,
    analyze: options.analyze
      ? (request) => options.analyze!(request.root)
      : unimplemented,
    listInstalledApps: () => Promise.resolve(inventory),
    listResidues: () => Promise.resolve([]),
    listHistory: () => Promise.resolve([]),
    listSnapshots: () => Promise.resolve([]),
    compareSnapshots: unimplemented,
    getSettings: unimplemented,
    saveSettings: unimplemented,
    requestUninstall: unimplemented,
    planCleanup: unimplemented,
  }
}
