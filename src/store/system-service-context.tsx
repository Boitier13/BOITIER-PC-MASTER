import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { createSystemService, DEFAULT_ENGINE_MODE } from '@/services'
import type { SystemService } from '@/services/system-service'

const SystemServiceContext = createContext<SystemService | null>(null)

export function SystemServiceProvider({
  children,
  service,
}: {
  children: ReactNode
  service?: SystemService
}) {
  const value = useMemo(() => service ?? createSystemService(DEFAULT_ENGINE_MODE), [service])
  return <SystemServiceContext.Provider value={value}>{children}</SystemServiceContext.Provider>
}

export function useSystemService(): SystemService {
  const service = useContext(SystemServiceContext)
  if (!service) {
    throw new Error('useSystemService doit être utilisé dans un SystemServiceProvider.')
  }
  return service
}
