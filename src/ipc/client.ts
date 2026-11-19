import { COMMANDS, EVENTS, type CommandName, type EventName } from '@/ipc/contracts'
import { ServiceError, type ServiceErrorCode } from '@/services/system-service'

/**
 * Point d'entrée unique vers le moteur Rust.
 *
 * Sécurité :
 *  - aucune commande n'est invocable sans figurer dans `COMMANDS` (liste blanche) ;
 *  - aucun événement n'est écouté sans figurer dans `EVENTS` ;
 *  - hors runtime Tauri, aucun appel n'est tenté : le mode démonstration prend
 *    le relais, sans erreur visible pour l'utilisateur ;
 *  - les erreurs Rust `{ code, message }` sont converties en `ServiceError`
 *    typée, jamais relayées brutes à l'interface.
 */

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isKnownCommand(value: string): value is CommandName {
  return (Object.values(COMMANDS) as string[]).includes(value)
}

function isKnownEvent(value: string): value is EventName {
  return (Object.values(EVENTS) as string[]).includes(value)
}

/** Codes d'erreur produits par le moteur Rust (`CommandError.code`). */
const ENGINE_ERROR_CODES: Record<string, ServiceErrorCode> = {
  not_found: 'not_found',
  access_denied: 'access_denied',
  not_a_directory: 'not_a_directory',
  invalid_path: 'invalid_argument',
  io_error: 'ipc_failure',
  path_unavailable: 'ipc_failure',
  cancelled: 'cancelled',
}

function toServiceError(error: unknown): ServiceError {
  if (error instanceof ServiceError) return error

  if (error && typeof error === 'object') {
    const candidate = error as { code?: unknown; message?: unknown }
    const message =
      typeof candidate.message === 'string' && candidate.message.trim() ? candidate.message : undefined

    if (typeof candidate.code === 'string') {
      const code = ENGINE_ERROR_CODES[candidate.code] ?? 'ipc_failure'
      return new ServiceError(code, message ?? candidate.code, undefined, candidate.code)
    }

    if (message) return new ServiceError('ipc_failure', message)
  }

  if (typeof error === 'string' && error.trim()) {
    return new ServiceError('ipc_failure', error)
  }

  return new ServiceError('ipc_failure', 'Erreur IPC inconnue')
}

export async function invokeCommand<TResult>(
  command: CommandName,
  args?: Record<string, unknown>,
): Promise<TResult> {
  if (!isKnownCommand(command)) {
    throw new ServiceError('invalid_argument', `Commande IPC inconnue : ${command}`)
  }

  if (!isTauriRuntime()) {
    throw new ServiceError('not_tauri', "Le moteur Rust n'est pas disponible hors de l'application de bureau.")
  }

  // Import dynamique : le bundle web de démonstration n'embarque pas la couche
  // Tauri tant qu'aucune commande n'est réellement appelée.
  const { invoke } = await import('@tauri-apps/api/core')

  try {
    return await invoke<TResult>(command, args)
  } catch (error) {
    throw toServiceError(error)
  }
}

/**
 * Abonne un écouteur à un événement du moteur.
 *
 * Renvoie une fonction de désabonnement ; hors runtime Tauri, renvoie une
 * fonction inerte (aucune erreur, le mode démonstration simule sa progression).
 */
export async function listenEvent<TPayload>(
  event: EventName,
  handler: (payload: TPayload) => void,
): Promise<() => void> {
  if (!isKnownEvent(event)) {
    throw new ServiceError('invalid_argument', `Événement IPC inconnu : ${event}`)
  }
  if (!isTauriRuntime()) {
    return () => {}
  }

  const { listen } = await import('@tauri-apps/api/event')
  const unlisten = await listen<TPayload>(event, (message) => handler(message.payload))
  return () => {
    unlisten()
  }
}
