import { apps } from '@/data/demo'
import { DEMO_VOLUMES } from '@/data/demo-tree'
import type { InstalledApp, Volume } from '@/domain/types'

/**
 * Projection typée des données du **moteur de démonstration**.
 *
 * Limite stricte : seuls les volumes et les applications existent ici, parce
 * que ce sont les deux seules familles que le contrat `SystemService` sait
 * fournir en mode démo. Les résidus et l'historique n'ont plus de fixtures :
 * l'interface affiche leur indisponibilité, plutôt qu'un exemple chiffré.
 */

export const demoVolumes: Volume[] = DEMO_VOLUMES

export const demoApps: InstalledApp[] = apps.map((app, index) => ({
  id: `demo-app-${index}`,
  name: app.name,
  publisher: app.publisher,
  version: app.version,
  installedAtMs: app.installedAtMs,
  sizeBytes: app.sizeBytes,
  installLocation: null,
  uninstallString: null,
  quietUninstallString: null,
  productCode: null,
  installerType: app.installerType,
  scope: app.scope,
  architecture: 'x64',
  hasUninstaller: false,
  registryPath: `DEMO\\${app.name}`,
}))

export interface DemoWorkspace {
  volumes: Volume[]
  apps: InstalledApp[]
}

export const demoWorkspace: DemoWorkspace = {
  volumes: demoVolumes,
  apps: demoApps,
}
