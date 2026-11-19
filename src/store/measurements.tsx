import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react'
import { ServiceError } from '@/services/system-service'
import { useSystemService } from '@/store/system-service-context'
import type { AnalysisReport, ScanProgress, SessionEntry } from '@/domain/types'
import { formatBytes, formatCount } from '@/lib/format'

/**
 * Mesures d'espace de la session.
 *
 * Rien n'est mesuré sans que l'utilisateur l'ait demandé : ce magasin ne
 * contient que ce qui a réellement été parcouru, plus le journal de ces
 * opérations. Aucune donnée n'est conservée après la fermeture — c'est écrit
 * dans l'interface plutôt que promis par un commentaire.
 */
export interface MeasurementsState {
  /** Dernier rapport obtenu, y compris partiel ou annulé. */
  lastReport: AnalysisReport | null
  /** Racine de la mesure en cours, si une mesure est en cours. */
  runningRoot: string | null
  running: boolean
  progress: ScanProgress | null
  error: unknown
  /** Opérations réellement exécutées pendant la session. */
  journal: SessionEntry[]
  start: (root: string) => Promise<void>
  cancel: () => void
}

const MeasurementsContext = createContext<MeasurementsState | null>(null)

let sequence = 0

function nextId(prefix: string): string {
  sequence += 1
  return `${prefix}-${Date.now()}-${sequence}`
}

function describe(report: AnalysisReport): string {
  const scope = `${formatCount(report.files)} fichiers · ${formatBytes(report.totalSizeBytes)}`
  const suffix = report.truncated ? ' · mesure partielle' : ''
  return `${report.root} · ${scope}${suffix}`
}

function resultOf(report: AnalysisReport): string {
  if (report.cancelled) return 'Annulé'
  if (report.truncated) return 'Partiel'
  return 'Terminé'
}

export function MeasurementsProvider({ children }: { children: ReactNode }) {
  const service = useSystemService()
  const [lastReport, setLastReport] = useState<AnalysisReport | null>(null)
  const [runningRoot, setRunningRoot] = useState<string | null>(null)
  const [progress, setProgress] = useState<ScanProgress | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [journal, setJournal] = useState<SessionEntry[]>([])

  const runningRef = useRef(false)
  const controllerRef = useRef<AbortController | null>(null)

  const append = useCallback((entry: Omit<SessionEntry, 'id' | 'atMs'>) => {
    setJournal((entries) => [{ ...entry, id: nextId('session'), atMs: Date.now() }, ...entries])
  }, [])

  const start = useCallback(
    async (root: string) => {
      if (runningRef.current) return
      const scope = root.trim()
      if (!scope) return

      runningRef.current = true
      const controller = new AbortController()
      controllerRef.current = controller
      setRunningRoot(scope)
      setProgress(null)
      setError(null)

      try {
        const report = await service.analyze(
          { root: scope },
          { signal: controller.signal, onProgress: (value) => setProgress(value) },
        )
        setLastReport(report)
        append({
          kind: 'analysis',
          name: 'Mesure d’espace',
          detail: describe(report),
          result: resultOf(report),
        })
      } catch (reason) {
        if (reason instanceof ServiceError && reason.code === 'cancelled') {
          append({
            kind: 'analysis',
            name: 'Mesure d’espace',
            detail: `${scope} · annulée avant la fin`,
            result: 'Annulé',
          })
        } else {
          setError(reason)
          append({
            kind: 'analysis',
            name: 'Mesure d’espace',
            detail: `${scope} · échec de la mesure`,
            result: 'Échec',
          })
        }
      } finally {
        runningRef.current = false
        controllerRef.current = null
        setRunningRoot(null)
        setProgress(null)
      }
    },
    [append, service],
  )

  const cancel = useCallback(() => {
    controllerRef.current?.abort()
  }, [])

  const value = useMemo<MeasurementsState>(
    () => ({
      lastReport,
      runningRoot,
      running: runningRoot !== null,
      progress,
      error,
      journal,
      start,
      cancel,
    }),
    [cancel, error, journal, lastReport, progress, runningRoot, start],
  )

  return <MeasurementsContext.Provider value={value}>{children}</MeasurementsContext.Provider>
}

export function useMeasurements(): MeasurementsState {
  const context = useContext(MeasurementsContext)
  if (!context) {
    throw new Error('useMeasurements doit être utilisé dans MeasurementsProvider')
  }
  return context
}
