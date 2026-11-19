import {
  Activity,
  AppWindow,
  ArrowUp,
  ChevronRight,
  Database,
  FileText,
  HardDrive,
  MoreHorizontal,
  ScanLine,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoLabel } from '@/components/DemoLabel'
import { Metric } from '@/components/Metric'
import { PageHeading } from '@/components/PageHeading'
import { coverageDetail, coverageLabel, useMeasurements } from '@/hooks/use-analysis'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useServiceData } from '@/hooks/use-service-data'
import { useVolumes } from '@/hooks/use-volumes'
import { CATEGORY_COLORS, CATEGORY_LABELS, donutGradient } from '@/lib/categories'
import { formatBytes, formatCount, formatDateTime, usagePercent } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import type { AnalysisReport, AppInventory, UserFolder } from '@/domain/types'
import { useAppState } from '@/store/app-state'
import { useSystemService } from '@/store/system-service-context'

/** Dernier segment du profil réel : `C:\Users\alice` → `alice`. */
function profileName(folders: UserFolder[]): string | null {
  const home = folders.find((folder) => folder.id === 'home')
  if (!home) return null
  const segments = home.path.split(/[\\/]/).filter(Boolean)
  return segments.length ? segments[segments.length - 1] : null
}

interface Slice {
  label: string
  bytes: number
  files: number
  color: string
}

/** Agrège les catégories mesurées ; rien n'est ajouté si la mesure est vide. */
function toSlices(report: AnalysisReport | null): Slice[] {
  if (!report) return []

  const slices = report.byCategory
    .filter((category) => category.bytes > 0)
    .map((category) => ({
      label: CATEGORY_LABELS[category.category] ?? category.category,
      bytes: category.bytes,
      files: category.files,
      color: CATEGORY_COLORS[category.category] ?? '#3b4557',
    }))
    .sort((left, right) => right.bytes - left.bytes)

  if (slices.length <= 5) return slices

  const head = slices.slice(0, 4)
  const tail = slices.slice(4)
  head.push({
    label: 'Autres mesurés',
    bytes: tail.reduce((sum, slice) => sum + slice.bytes, 0),
    files: tail.reduce((sum, slice) => sum + slice.files, 0),
    color: '#3b4557',
  })
  return head
}

/**
 * Tableau de bord.
 *
 * Chaque valeur affichée provient d'une lecture réelle. Lorsqu'une mesure manque,
 * l'écran le dit — il n'existe plus aucune valeur d'exemple, ni de fraîcheur
 * supposée.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const service = useSystemService()
  const demo = useEngineMode() === 'demo'
  const { volumes, folders, loading: volumesLoading, error: volumesError } = useVolumes()
  const { lastReport, journal } = useMeasurements()

  // Compteur réel : une seule entrée demandée, le total suffit.
  const {
    data: appInventory,
    loading: appsLoading,
    error: appsError,
  } = useServiceData<AppInventory>(() => service.listInstalledApps({ limit: 1 }), [service])

  const storage = useMemo(() => {
    const total = volumes.reduce((sum, volume) => sum + volume.totalBytes, 0)
    const free = volumes.reduce((sum, volume) => sum + volume.freeBytes, 0)
    return {
      total,
      free,
      used: Math.max(total - free, 0),
      kinds: volumes.map((volume) => volume.kind).join(', '),
    }
  }, [volumes])

  const userName = useMemo(() => profileName(folders), [folders])
  const slices = useMemo(() => toSlices(lastReport), [lastReport])
  const measured = lastReport?.totalSizeBytes ?? 0
  const donut = useMemo(() => donutGradient(slices, measured), [slices, measured])
  const appsTotal = appsError ? null : appInventory?.total ?? null

  const appDetail = appsError
    ? 'Moteur indisponible'
    : appsLoading
      ? 'Lecture du registre…'
      : demo
        ? 'Inventaire de démonstration'
        : 'Registre Windows · lecture seule'

  return (
    <>
      <PageHeading
        eyebrow="VOTRE ESPACE DE TRAVAIL"
        title={userName ? `Bonjour, ${userName}` : 'Bonjour'}
        description="Voici l’état mesuré de votre environnement informatique."
        action={<DemoLabel />}
      />

      <div className="welcome-strip">
        <div className="welcome-glyph">
          <Sparkles size={22} />
        </div>
        <div>
          <strong>Votre PC est prêt à être exploré</strong>
          <p>Disques et applications sont lus en direct ; l’espace disque se mesure sur demande.</p>
        </div>
        <button className="button primary" onClick={() => navigate(ROUTES.inventory)}>
          <HardDrive size={15} /> Explorer les disques <ChevronRight size={15} />
        </button>
      </div>

      <div className="metric-grid">
        <Metric
          icon={HardDrive}
          label="Disques détectés"
          value={volumesLoading || volumesError ? '—' : String(volumes.length)}
          detail={volumesError ? 'Volumes illisibles' : storage.kinds || 'Aucun volume détecté'}
          color="blue"
        />
        <Metric
          icon={Database}
          label="Espace utilisé"
          value={volumesLoading || volumesError ? '—' : formatBytes(storage.used)}
          detail={
            volumesLoading || volumesError
              ? 'Lecture des volumes…'
              : `${usagePercent(storage.used, storage.total)}% de ${formatBytes(storage.total)}`
          }
          color="cyan"
        />
        <Metric
          icon={ScanLine}
          label="Espace disponible"
          value={volumesLoading || volumesError ? '—' : formatBytes(storage.free)}
          detail={volumesLoading || volumesError ? 'Lecture des volumes…' : 'Tous volumes confondus'}
          color="green"
        />
        <Metric
          icon={FileText}
          label="Fichiers mesurés"
          value={lastReport ? formatCount(lastReport.files) : '—'}
          detail={
            lastReport
              ? `Mesure du ${formatDateTime(lastReport.scannedAtMs)}`
              : demo
                ? 'Mesure indisponible en démonstration'
                : 'Aucune mesure dans cette session'
          }
          color="violet"
        />
        <Metric
          icon={AppWindow}
          label="Applications installées"
          value={appsLoading || appsError ? '—' : String(appsTotal ?? 0)}
          detail={appDetail}
          color="violet"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel disk-panel">
          <div className="panel-heading">
            <div>
              <h2>Utilisation des disques</h2>
              <p>Occupation des volumes lus sur ce PC</p>
            </div>
            <button className="text-link" onClick={() => navigate(ROUTES.inventory)}>
              Voir les disques <ChevronRight size={14} />
            </button>
          </div>
          <div className="disk-list">
            {volumes.map((volume) => (
              <div className="disk-row" key={volume.id}>
                <div className="disk-identity">
                  <div className="drive-icon">
                    <HardDrive size={17} />
                  </div>
                  <div>
                    <strong>
                      {volume.letter} {volume.label}
                    </strong>
                    <small>{volume.kind}</small>
                  </div>
                </div>
                <div className="disk-bar-wrap">
                  <div className="disk-bar">
                    <span
                      style={{ width: `${usagePercent(volume.usedBytes, volume.totalBytes)}%`, background: volume.accent }}
                    />
                  </div>
                  <div className="disk-numbers">
                    <span>{formatBytes(volume.usedBytes)} utilisés</span>
                    <span>{formatBytes(volume.freeBytes)} libres</span>
                  </div>
                </div>
                <strong className="disk-percent">{usagePercent(volume.usedBytes, volume.totalBytes)}%</strong>
              </div>
            ))}
            {!volumes.length && !volumesLoading && (
              <p className="state-note">
                {volumesError
                  ? 'Le moteur n’a pas pu lire les volumes de ce PC.'
                  : 'Aucun volume monté n’a été détecté.'}
              </p>
            )}
          </div>
          <div className="panel-foot">
            <span>
              <i className="legend-blue" /> Utilisé <i className="legend-muted" /> Disponible
            </span>
            <span>{volumesLoading ? 'Lecture des volumes…' : 'Volumes lus à l’ouverture de l’écran'}</span>
          </div>
        </section>

        <section className="panel category-panel">
          <div className="panel-heading">
            <div>
              <h2>Répartition des fichiers</h2>
              <p>
                {lastReport
                  ? `${lastReport.root} · ${formatDateTime(lastReport.scannedAtMs)}`
                  : 'Aucune mesure dans cette session'}
              </p>
            </div>
            <button
              className="icon-button"
              aria-label="Analyser l’espace"
              onClick={() => navigate(ROUTES.diskAnalysis)}
            >
              <MoreHorizontal size={19} />
            </button>
          </div>
          {slices.length ? (
            <div className="category-content">
              <div className="donut" style={{ background: donut }} aria-label="Répartition mesurée des catégories">
                <div>
                  <strong>{formatBytes(measured)}</strong>
                  <span>mesurés</span>
                </div>
              </div>
              <div className="category-legend">
                {slices.map((slice) => (
                  <div key={slice.label}>
                    <i style={{ background: slice.color }} />
                    <span>{slice.label}</span>
                    <b>{formatBytes(slice.bytes)}</b>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="empty-state">
              <FileText size={22} />
              <strong>Aucun espace mesuré</strong>
              <p>
                Les catégories ne s’affichent qu’après une mesure réelle. Rien n’est estimé à votre place.
              </p>
              <button className="button secondary" onClick={() => navigate(ROUTES.diskAnalysis)}>
                <ScanLine size={14} /> Mesurer maintenant
              </button>
            </div>
          )}
          <button className="panel-link" onClick={() => navigate(ROUTES.diskAnalysis)}>
            Explorer l’espace disque <ArrowUp size={14} />
          </button>
        </section>
      </div>

      <div className="lower-grid">
        <section className="panel recent-panel">
          <div className="panel-heading">
            <div>
              <h2>Activité récente</h2>
              <p>Opérations réellement exécutées pendant cette session</p>
            </div>
            <button className="text-link" onClick={() => navigate(ROUTES.history)}>
              Tout voir <ChevronRight size={14} />
            </button>
          </div>
          <div className="activity-list">
            {journal.slice(0, 3).map((entry) => (
              <div className="activity-row" key={entry.id}>
                <div className="activity-icon blue">
                  <Activity size={15} />
                </div>
                <div className="activity-copy">
                  <strong>{entry.name}</strong>
                  <span>{entry.detail}</span>
                </div>
                <span className="activity-time">{formatDateTime(entry.atMs)}</span>
                <span className="status-pill">{entry.result}</span>
              </div>
            ))}
            {!journal.length && (
              <p className="state-note">
                Aucune opération effectuée dans cette session. Lancez une mesure d’espace pour alimenter
                cet historique.
              </p>
            )}
          </div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-heading">
            <div>
              <h2>Accès rapides</h2>
              <p>Retrouvez vos outils essentiels</p>
            </div>
          </div>
          <div className="quick-grid">
            {[
              { title: 'Inventaire', desc: 'Vue d’ensemble des disques', icon: HardDrive, route: ROUTES.inventory },
              { title: 'Applications', desc: 'Gérer les logiciels', icon: AppWindow, route: ROUTES.applications },
              { title: 'Nettoyage', desc: 'Examiner les résidus', icon: Sparkles, route: ROUTES.uninstall },
              { title: 'Surveillance', desc: 'Suivre une installation', icon: Activity, route: ROUTES.monitoring },
            ].map((quick) => (
              <button className="quick-card" key={quick.title} onClick={() => navigate(quick.route)}>
                <quick.icon size={17} />
                <span>
                  <strong>{quick.title}</strong>
                  <small>{quick.desc}</small>
                </span>
                <ChevronRight size={15} />
              </button>
            ))}
          </div>
        </section>
      </div>

      <div className="system-status">
        <div className="status-check">
          <ShieldCheck size={18} />
        </div>
        <div>
          <strong>
            Données lues sur ce PC{' '}
            <span className="healthy">
              <i /> {demo ? 'Démonstration' : 'Lecture seule'}
            </span>
          </strong>
          <p>
            {demo
              ? 'Le moteur de démonstration est actif : aucune donnée de votre PC n’est utilisée.'
              : 'Aucune modification n’a été effectuée. Mesures disponibles : volumes, applications, espace sur demande.'}
            {' '}Non disponible : désinstallation assistée (lot C2), surveillance (lot C4), instantanés (lot D).
          </p>
        </div>
        <button onClick={() => navigate(ROUTES.settings)}>
          Diagnostic <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}
