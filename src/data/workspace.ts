import { apps, history, residues } from '@/data/demo'
import { DEMO_VOLUMES } from '@/data/demo-tree'
import type {
  AppState,
  Confidence,
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
 * quel) et le modèle de domaine. L'arborescence de fichiers, elle, vit dans
 * `demo-tree.ts` : elle est désormais structurée (chemins, tailles en octets,
 * attributs) et non plus une simple liste plate.
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

export const demoVolumes: Volume[] = DEMO_VOLUMES

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
  residues: Residue[]
  history: HistoryEntry[]
}

export const demoWorkspace: DemoWorkspace = {
  volumes: demoVolumes,
  apps: demoApps,
  residues: demoResidues,
  history: demoHistory,
}
