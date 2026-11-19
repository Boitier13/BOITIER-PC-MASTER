import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import type { HistoryTab } from '@/domain/labels'

/** Modes de désinstallation proposés par la maquette. */
export type UninstallMode = 'Standard' | 'Avancé' | 'Approfondi'

/**
 * État d'interface partagé par la coque et les écrans.
 *
 * Il reproduit exactement les états de la maquette validée (`PcMaster`), y
 * compris ceux qui ne sont pas encore exploités, afin qu'aucun comportement
 * visible ne change. La migration définitive se fera écran par écran, en même
 * temps que le branchement du moteur réel.
 */
interface AppState {
  dark: boolean
  setDark: (value: boolean) => void

  /** Recherche globale — partagée avec l'écran Applications (comportement de la maquette, audit B1). */
  query: string
  setQuery: (value: string) => void

  selectedDisk: string
  setSelectedDisk: (value: string) => void

  uninstallMode: UninstallMode
  setUninstallMode: (value: UninstallMode) => void

  /** Titre de la modale d'action courante (chaîne vide = fermée). */
  dialog: string
  openAction: (name: string) => void
  closeDialog: () => void

  toast: string
  notify: (message: string) => void
  clearToast: () => void

  historyTab: HistoryTab
  setHistoryTab: (tab: HistoryTab) => void

  expanded: boolean
  setExpanded: (value: boolean) => void
}

const AppStateContext = createContext<AppState | null>(null)

export function AppStateProvider({ children }: { children: ReactNode }) {
  const [dark, setDark] = useState(true)
  const [query, setQuery] = useState('')
  const [selectedDisk, setSelectedDisk] = useState('C:')
  const [uninstallMode, setUninstallMode] = useState<UninstallMode>('Avancé')
  const [dialog, setDialog] = useState('')
  const [toast, setToast] = useState('')
  const [historyTab, setHistoryTab] = useState<HistoryTab>('Tous')
  const [expanded, setExpanded] = useState(true)

  const notify = useCallback((message: string) => {
    setToast(message)
    window.setTimeout(() => setToast(''), 3200)
  }, [])

  const openAction = useCallback((name: string) => setDialog(name), [])
  const closeDialog = useCallback(() => setDialog(''), [])
  const clearToast = useCallback(() => setToast(''), [])

  const value = useMemo<AppState>(
    () => ({
      dark,
      setDark,
      query,
      setQuery,
      selectedDisk,
      setSelectedDisk,
      uninstallMode,
      setUninstallMode,
      dialog,
      openAction,
      closeDialog,
      toast,
      notify,
      clearToast,
      historyTab,
      setHistoryTab,
      expanded,
      setExpanded,
    }),
    [
      dark,
      query,
      selectedDisk,
      uninstallMode,
      dialog,
      openAction,
      closeDialog,
      toast,
      notify,
      clearToast,
      historyTab,
      expanded,
    ],
  )

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>
}

export function useAppState(): AppState {
  const state = useContext(AppStateContext)
  if (!state) {
    throw new Error('useAppState doit être utilisé dans un AppStateProvider.')
  }
  return state
}
