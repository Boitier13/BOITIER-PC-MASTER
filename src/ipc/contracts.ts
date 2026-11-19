/**
 * Miroirs TypeScript des structures Rust sérialisées (src-tauri/src/commands/system.rs).
 *
 * Toute modification d'une structure Rust doit être répercutée ici. Ces types
 * décrivent uniquement la frontière IPC : aucun accès direct à `window` ni au
 * système n'est exposé à l'interface.
 *
 * Évolution prévue : génération automatique via `tauri-specta` (phase 2), dès
 * que la chaîne Rust devient compilable et testable.
 */

export type EngineModePayload = 'demo' | 'system'

export interface AppInfoPayload {
  name: string
  version: string
  platform: string
  arch: string
  engineMode: EngineModePayload
  realSystemAccess: boolean
}

export interface EngineStatusPayload {
  mode: EngineModePayload
  capabilities: {
    volumes: boolean
    fileInventory: boolean
    installedApps: boolean
    uninstall: boolean
    residueScan: boolean
    monitoring: boolean
    reports: boolean
  }
  elevation: 'none' | 'optional' | 'required'
  realSystemAccess: boolean
}

export interface DbStatusPayload {
  ready: boolean
  path: string
  schemaVersion: number
}

/** Noms des commandes exposées — liste blanche unique côté frontend. */
export const COMMANDS = {
  appInfo: 'app_info',
  engineStatus: 'engine_status',
  dbStatus: 'db_status',
  ping: 'ping',
} as const

export type CommandName = (typeof COMMANDS)[keyof typeof COMMANDS]
