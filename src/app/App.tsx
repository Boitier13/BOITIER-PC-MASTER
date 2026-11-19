import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShell } from '@/app/AppShell'
import { ROUTES } from '@/app/routes'
import { ApplicationsPage } from '@/features/applications/ApplicationsPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { DiskAnalysisPage } from '@/features/disk-analysis/DiskAnalysisPage'
import { ExplorerPage } from '@/features/explorer/ExplorerPage'
import { HistoryPage } from '@/features/history/HistoryPage'
import { InventoryPage } from '@/features/inventory/InventoryPage'
import { MonitoringPage } from '@/features/monitoring/MonitoringPage'
import { SettingsPage } from '@/features/settings/SettingsPage'
import { UninstallPage } from '@/features/uninstall/UninstallPage'
import { AppStateProvider } from '@/store/app-state'
import { MeasurementsProvider } from '@/store/measurements'
import { SystemServiceProvider } from '@/store/system-service-context'
import type { SystemService } from '@/services/system-service'

/**
 * Arborescence de l'application (sans routeur : il est fourni par `main.tsx`
 * ou par les tests, ce qui permet d'utiliser indifféremment HashRouter ou
 * MemoryRouter).
 */
export function App({ service }: { service?: SystemService }) {
  return (
    <SystemServiceProvider service={service}>
      <MeasurementsProvider>
        <AppStateProvider>
          <Routes>
            <Route element={<AppShell />}>
              <Route path={ROUTES.dashboard} element={<DashboardPage />} />
              <Route path={ROUTES.explorer} element={<ExplorerPage />} />
              <Route path={ROUTES.inventory} element={<InventoryPage />} />
              <Route path={ROUTES.diskAnalysis} element={<DiskAnalysisPage />} />
              <Route path={ROUTES.applications} element={<ApplicationsPage />} />
              <Route path={ROUTES.uninstall} element={<UninstallPage />} />
              <Route path={ROUTES.monitoring} element={<MonitoringPage />} />
              <Route path={ROUTES.history} element={<HistoryPage />} />
              <Route path={ROUTES.settings} element={<SettingsPage />} />
              <Route path="*" element={<Navigate to={ROUTES.dashboard} replace />} />
            </Route>
          </Routes>
        </AppStateProvider>
      </MeasurementsProvider>
    </SystemServiceProvider>
  )
}
