import type { EngineMode } from '@/domain/types'
import { isTauriRuntime } from '@/ipc/client'
import { MockSystemService } from '@/services/mock/mock-system-service'
import { TauriSystemService } from '@/services/tauri/tauri-system-service'
import type { SystemService } from '@/services/system-service'

/**
 * Mode effectif du moteur.
 *
 * - Dans l'application de bureau (runtime Tauri) : moteur Windows réel, en
 *   **lecture seule**.
 * - Partout ailleurs (aperçu web, tests, `pnpm dev` sans Tauri) : moteur de
 *   démonstration, arborescence fictive, aucun accès disque.
 *
 * Le mode démonstration reste donc pleinement fonctionnel et exerce le même
 * contrat que le moteur réel.
 */
export function resolveEngineMode(): EngineMode {
  return isTauriRuntime() ? 'system' : 'demo'
}

/** Mode par défaut du contexte applicatif (avant résolution runtime). */
export const DEFAULT_ENGINE_MODE: EngineMode = 'demo'

export function createSystemService(mode: EngineMode = DEFAULT_ENGINE_MODE): SystemService {
  if (mode === 'demo') return new MockSystemService()
  if (isTauriRuntime()) return new TauriSystemService()
  return new MockSystemService()
}

export { ServiceError } from '@/services/system-service'
export type { SystemService, WalkHandlers } from '@/services/system-service'
