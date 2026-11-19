import { useCallback, useEffect, useState } from 'react'
import type { AppInfo, SystemCapabilities } from '@/domain/types'
import { isTauriRuntime } from '@/ipc/client'
import { ServiceError } from '@/services/system-service'
import { useSystemService } from '@/store/system-service-context'

export type EngineState = 'probing' | 'connected' | 'demo' | 'unavailable'

export interface EngineDiagnostics {
  /** Environnement d'exécution réellement détecté. */
  runtime: 'tauri' | 'web'
  state: EngineState
  info: AppInfo | null
  capabilities: SystemCapabilities | null
  pingReply: string | null
  volumeCount: number | null
  /** Dossier personnel réel (`C:\Users\<nom>`), s'il est lisible. */
  homePath: string | null
  error: ServiceError | null
  checkedAtMs: number | null
  refresh: () => void
}

/**
 * Sonde réelle du moteur : interroge `app_info`, `engine_status`, `ping`, les
 * volumes et les dossiers utilisateur.
 *
 * C'est la seule source de vérité pour afficher « moteur connecté » ou
 * « moteur indisponible » : aucune de ces informations n'est écrite en dur.
 */
export function useEngineDiagnostics(): EngineDiagnostics {
  const service = useSystemService()
  const [nonce, setNonce] = useState(0)
  const [state, setState] = useState<EngineState>('probing')
  const [info, setInfo] = useState<AppInfo | null>(null)
  const [capabilities, setCapabilities] = useState<SystemCapabilities | null>(null)
  const [pingReply, setPingReply] = useState<string | null>(null)
  const [volumeCount, setVolumeCount] = useState<number | null>(null)
  const [homePath, setHomePath] = useState<string | null>(null)
  const [error, setError] = useState<ServiceError | null>(null)
  const [checkedAtMs, setCheckedAtMs] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    setState('probing')
    setError(null)

    void (async () => {
      try {
        const [appInfo, status, pong, volumes, folders] = await Promise.all([
          service.getAppInfo(),
          service.getCapabilities(),
          service.ping(),
          service.listVolumes(),
          service.listUserFolders(),
        ])
        if (cancelled) return

        setInfo(appInfo)
        setCapabilities(status)
        setPingReply(pong)
        setVolumeCount(volumes.length)
        setHomePath(folders.find((folder) => folder.id === 'home')?.path ?? folders[0]?.path ?? null)
        setCheckedAtMs(Date.now())
        setState(service.mode === 'demo' ? 'demo' : 'connected')
      } catch (reason: unknown) {
        if (cancelled) return
        setError(
          reason instanceof ServiceError
            ? reason
            : new ServiceError('ipc_failure', 'Le moteur système n’a pas répondu.'),
        )
        setCheckedAtMs(Date.now())
        setState('unavailable')
      }
    })()

    return () => {
      cancelled = true
    }
  }, [service, nonce])

  const refresh = useCallback(() => setNonce((value) => value + 1), [])

  return {
    runtime: isTauriRuntime() ? 'tauri' : 'web',
    state,
    info,
    capabilities,
    pingReply,
    volumeCount,
    homePath,
    error,
    checkedAtMs,
    refresh,
  }
}
