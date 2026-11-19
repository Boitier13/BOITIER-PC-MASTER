import type { EngineMode } from '@/domain/types'
import { isTauriRuntime } from '@/ipc/client'
import { MockSystemService } from '@/services/mock/mock-system-service'
import { TauriSystemService } from '@/services/tauri/tauri-system-service'
import type { SystemService } from '@/services/system-service'

/**
 * Mode par défaut : démonstration.
 *
 * Même dans l'application Tauri, le moteur réel n'est pas encore branché : les
 * écrans doivent rester utilisables et honnêtement étiquetés « démonstration ».
 * Le basculement se fera écran par écran, au fur et à mesure des commandes Rust.
 */
export const DEFAULT_ENGINE_MODE: EngineMode = 'demo'

export function createSystemService(mode: EngineMode = DEFAULT_ENGINE_MODE): SystemService {
  if (mode === 'system' && isTauriRuntime()) {
    return new TauriSystemService()
  }
  return new MockSystemService()
}

export { ServiceError } from '@/services/system-service'
export type { SystemService } from '@/services/system-service'
