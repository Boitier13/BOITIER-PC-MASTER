import { demoWorkspace, type DemoWorkspace } from '@/data/workspace'

/**
 * Accès synchrone aux données de démonstration restantes.
 *
 * L'exploration des fichiers ne passe plus par cette couture : elle utilise le
 * contrat `SystemService` (`listVolumes`, `listDirectory`, `walk`), identique en
 * mode démo et en mode réel. Ce hook ne sert plus qu'aux applications, résidus
 * et à l'historique, encore simulés en phase 3.
 */
export function useWorkspace(): DemoWorkspace {
  return demoWorkspace
}
