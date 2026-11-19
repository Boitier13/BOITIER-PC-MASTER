import { COMMANDS, type CommandName } from '@/ipc/contracts'
import { ServiceError } from '@/services/system-service'

/**
 * Point d'entrée unique vers le moteur Rust.
 *
 * Sécurité :
 *  - aucune commande n'est invocable sans figurer dans `COMMANDS` (liste blanche) ;
 *  - hors runtime Tauri, aucun appel n'est tenté : le mode démonstration prend
 *    le relais, sans erreur visible pour l'utilisateur ;
 *  - les erreurs Rust sont converties en `ServiceError` typée, jamais relayées
 *    brutes à l'interface.
 */

export function isTauriRuntime(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

function isKnownCommand(value: string): value is CommandName {
  return (Object.values(COMMANDS) as string[]).includes(value)
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
    throw new ServiceError('ipc_failure', describeIpcError(error))
  }
}

function describeIpcError(error: unknown): string {
  if (typeof error === 'string') return error
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Erreur IPC inconnue'
}
