export const disks = [
  { letter: 'C:', name: 'Système', type: 'SSD NVMe', total: 476, used: 312, free: 164, color: '#4388ff' },
  { letter: 'D:', name: 'Données', type: 'SSD SATA', total: 953, used: 581, free: 372, color: '#20c5d7' },
  { letter: 'E:', name: 'Archives', type: 'HDD', total: 1863, used: 1042, free: 821, color: '#8b78ef' },
]

export const apps: Array<{
  name: string
  publisher: string
  version: string
  installedAtMs: number
  sizeBytes: number
  installerType: 'msi' | 'exe' | 'msix' | 'unknown'
  scope: 'machine' | 'user'
}> = [
  { name: 'Microsoft 365 - fr-fr', publisher: 'Microsoft Corporation', version: '16.0.17928.20114', installedAtMs: Date.UTC(2026, 10, 12), sizeBytes: 3_050_000_000, installerType: 'msi', scope: 'machine' },
  { name: 'Adobe Photoshop 2025', publisher: 'Adobe Inc.', version: '26.1.0', installedAtMs: Date.UTC(2026, 10, 8), sizeBytes: 4_424_000_000, installerType: 'exe', scope: 'machine' },
  { name: 'Google Chrome', publisher: 'Google LLC', version: '131.0.6778.86', installedAtMs: Date.UTC(2026, 10, 6), sizeBytes: 1_160_000_000, installerType: 'msi', scope: 'machine' },
  { name: 'Mozilla Firefox', publisher: 'Mozilla Corporation', version: '132.0.2', installedAtMs: Date.UTC(2026, 10, 4), sizeBytes: 641_000_000, installerType: 'msi', scope: 'machine' },
  { name: 'Visual Studio Code', publisher: 'Microsoft Corporation', version: '1.95.3', installedAtMs: Date.UTC(2026, 10, 2), sizeBytes: 510_000_000, installerType: 'exe', scope: 'user' },
  { name: 'Spotify', publisher: 'Spotify AB', version: '1.2.52.442', installedAtMs: Date.UTC(2026, 9, 29), sizeBytes: 327_000_000, installerType: 'msix', scope: 'user' },
  { name: 'VLC media player', publisher: 'VideoLAN', version: '3.0.21', installedAtMs: Date.UTC(2026, 9, 21), sizeBytes: 193_000_000, installerType: 'exe', scope: 'machine' },
  { name: '7-Zip 24.09', publisher: 'Igor Pavlov', version: '24.09', installedAtMs: Date.UTC(2026, 9, 18), sizeBytes: 8_600_000, installerType: 'msi', scope: 'machine' },
  { name: 'NVIDIA Graphics Driver', publisher: 'NVIDIA Corporation', version: '566.14', installedAtMs: Date.UTC(2026, 9, 14), sizeBytes: 1_740_000_000, installerType: 'exe', scope: 'machine' },
]
