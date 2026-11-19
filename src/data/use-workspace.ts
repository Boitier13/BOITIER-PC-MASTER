import { demoWorkspace, type DemoWorkspace } from '@/data/workspace'

/**
 * Couture de transition (phase 1).
 *
 * L'interface de la maquette affichait ses données de façon synchrone. Pour
 * conserver exactement le même rendu, les écrans consomment ici l'instantané de
 * démonstration, déjà typé.
 *
 * Phase 2 : remplacement par un chargement asynchrone via `SystemService`
 * (`listVolumes`, `listEntries`…), avec états de chargement, d'erreur et de
 * progression — ce qui introduira de nouveaux états visuels, volontairement
 * absents de la phase 1.
 */
export function useWorkspace(): DemoWorkspace {
  return demoWorkspace
}
