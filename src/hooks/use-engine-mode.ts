import type { EngineMode } from '@/domain/types'
import { useSystemService } from '@/store/system-service-context'

/**
 * Mode du moteur effectivement branché (`demo` ou `system`).
 *
 * Sert uniquement à l'honnêteté de l'étiquetage : une donnée fictive doit
 * rester annoncée comme fictive, une lecture réelle annoncée comme réelle.
 */
export function useEngineMode(): EngineMode {
  return useSystemService().mode
}
