import { apps, disks, explorerItems, history, residues } from '@/data/demo'
import type {
  AppState,
  Confidence,
  FileEntry,
  HistoryEntry,
  HistoryKind,
  InstalledApp,
  Residue,
  Volume,
} from '@/domain/types'

/**
 * Projection typée des données de démonstration.
 *
 * Unique point de conversion entre les fixtures brutes (`demo.ts`, conservé tel
 * quel) et le modèle de domaine. Le moteur de démonstration et l'interface
 * consomment ensuite uniquement des entités typées.
 */

const CONFIDENCE_BY_LABEL: Record<string, Confidence> = {
  'Élevée': 'high',
  Probable: 'medium',
  Incertain: 'low',
  'Système': 'system',
}

const HISTORY_KIND_BY_LABEL: Record<string, HistoryKind> = {
  Inventaire: 'inventory',
  Désinstallation: 'uninstall',
  Analyse: 'analysis',
  Surveillance: 'monitoring',
}

const APP_STATE_BY_LABEL: Record<string, AppState> = {
  'Installé': 'installed',
  'Système': 'system',
}

export const demoVolumes: Volume[] = disks.map((disk, index) => ({
  id: `volume-${disk.letter.replace(':', '')}`,
  letter: disk.letter,
  label: disk.name,
  kind: disk.type,
  totalGb: disk.total,
  usedGb: disk.used,
  freeGb: disk.free,
  accent: disk.color,
}))

export const demoApps: InstalledApp[] = apps.map((app, index) => ({
  id: `app-${index}`,
  name: app.name,
  publisher: app.publisher,
  version: app.version,
  installedAt: app.date,
  sizeLabel: app.size,
  installerType: app.type,
  state: APP_STATE_BY_LABEL[app.state] ?? 'installed',
}))

export const demoEntries: FileEntry[] = explorerItems.map((item, index) => ({
  id: `entry-${index}`,
  name: item.name,
  type: item.type,
  // Recalculé depuis le libellé de la fixture : aucun dossier n'est deviné par
  // sa position (la donnée est disponible, l'affichage de phase 1 reste inchangé).
  isDirectory: item.type.startsWith('Dossier'),
  sizeLabel: item.size,
  modifiedAt: item.date,
  path: item.path,
}))

export const demoResidues: Residue[] = residues.map((residue, index) => ({
  id: `residue-${index}`,
  name: residue.name,
  type: residue.type,
  path: residue.path,
  appLabel: residue.app,
  confidence: CONFIDENCE_BY_LABEL[residue.confidence] ?? 'low',
  action: residue.action,
}))

export const demoHistory: HistoryEntry[] = history.map((item, index) => ({
  id: `history-${index}`,
  date: item.date,
  name: item.name,
  detail: item.detail,
  result: item.result,
  kind: HISTORY_KIND_BY_LABEL[item.kind] ?? 'inventory',
}))

export interface DemoWorkspace {
  volumes: Volume[]
  apps: InstalledApp[]
  entries: FileEntry[]
  residues: Residue[]
  history: HistoryEntry[]
}

export const demoWorkspace: DemoWorkspace = {
  volumes: demoVolumes,
  apps: demoApps,
  entries: demoEntries,
  residues: demoResidues,
  history: demoHistory,
}
