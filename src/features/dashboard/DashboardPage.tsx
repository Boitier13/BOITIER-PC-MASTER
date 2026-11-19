import {
  Activity,
  AppWindow,
  ArrowUp,
  Check,
  ChevronRight,
  Database,
  FileText,
  HardDrive,
  MoreHorizontal,
  ShieldCheck,
  Sparkles,
  Unplug,
} from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { DemoLabel } from '@/components/DemoLabel'
import { Metric } from '@/components/Metric'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useServiceData } from '@/hooks/use-service-data'
import { useVolumes } from '@/hooks/use-volumes'
import { formatBytes, usagePercent } from '@/lib/format'
import { ROUTES } from '@/app/routes'
import type { AppInventory } from '@/domain/types'
import { useAppState } from '@/store/app-state'
import { useSystemService } from '@/store/system-service-context'

/**
 * Tableau de bord.
 *
 * Les indicateurs chiffrés restent ceux de la maquette (audit B11) : ils ne
 * proviennent d'aucun calcul système. Ils seront remplacés par les agrégats du
 * moteur réel (SQLite) en phase 2.
 */
export function DashboardPage() {
  const navigate = useNavigate()
  const { openAction } = useAppState()
  const { history } = useWorkspace()
  const { volumes, loading: volumesLoading } = useVolumes()
  const demo = useEngineMode() === 'demo'
  const service = useSystemService()

  // Compteur réel : une seule entrée demandée, le total suffit.
  const {
    data: appInventory,
    loading: appsLoading,
    error: appsError,
  } = useServiceData<AppInventory>(() => service.listInstalledApps({ limit: 1 }), [service])

  const storage = useMemo(() => {
    const total = volumes.reduce((sum, volume) => sum + volume.totalBytes, 0)
    const free = volumes.reduce((sum, volume) => sum + volume.freeBytes, 0)
    return { total, free, kinds: volumes.map((volume) => volume.kind).join(', ') }
  }, [volumes])

  return (
    <>
      <PageHeading
        eyebrow="VOTRE ESPACE DE TRAVAIL"
        title="Bonjour, Alexandre"
        description="Voici un aperçu de l’état de votre environnement informatique."
        action={<DemoLabel />}
      />

      <div className="welcome-strip">
        <div className="welcome-glyph">
          <Sparkles size={22} />
        </div>
        <div>
          <strong>Votre PC est prêt à être exploré</strong>
          <p>Consultez vos disques et applications, avec la même interface en démonstration et en lecture réelle.</p>
        </div>
        <button className="button primary" onClick={() => navigate(ROUTES.inventory)}>
          <HardDrive size={15} /> Explorer les disques <ChevronRight size={15} />
        </button>
      </div>

      <div className="metric-grid">
        <Metric
          icon={HardDrive}
          label="Disques détectés"
          value={volumesLoading ? '—' : String(volumes.length)}
          detail={storage.kinds || 'Aucun volume détecté'}
          color="blue"
        />
        <Metric
          icon={Database}
          label="Espace disponible"
          value={volumesLoading ? '—' : formatBytes(storage.free)}
          detail={volumesLoading ? 'Lecture des volumes…' : `Sur ${formatBytes(storage.total)} au total`}
          color="cyan"
        />
        <Metric
          icon={FileText}
          label="Fichiers inventoriés"
          value="124 806"
          detail="Dernier inventaire · aujourd’hui"
          color="violet"
        />
        <Metric
          icon={AppWindow}
          label="Applications installées"
          value={appsLoading || appsError ? '—' : String(appInventory?.total ?? 0)}
          detail={
            appsError
              ? 'Moteur indisponible'
              : appsLoading
                ? 'Lecture du registre…'
                : demo
                  ? 'Inventaire de démonstration'
                  : 'Registre Windows · lecture seule'
          }
          color="green"
        />
      </div>

      <div className="dashboard-grid">
        <section className="panel disk-panel">
          <div className="panel-heading">
            <div>
              <h2>Utilisation des disques</h2>
              <p>Occupation des volumes inventoriés</p>
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
              <p>Par catégorie · tous les disques</p>
            </div>
            <button className="icon-button" aria-label="Plus d’options">
              <MoreHorizontal size={19} />
            </button>
          </div>
          <div className="category-content">
            <div className="donut" aria-label="Répartition fictive des catégories">
              <div>
                <strong>2,1 To</strong>
                <span>espace utilisé</span>
              </div>
            </div>
            <div className="category-legend">
              {[
                { name: 'Applications', size: '684 Go', color: '#4388ff' },
                { name: 'Vidéos', size: '512 Go', color: '#20c5d7' },
                { name: 'Documents', size: '326 Go', color: '#8b78ef' },
                { name: 'Autres', size: '578 Go', color: '#3b4557' },
              ].map((category) => (
                <div key={category.name}>
                  <i style={{ background: category.color }} />
                  <span>{category.name}</span>
                  <b>{category.size}</b>
                </div>
              ))}
            </div>
          </div>
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
              <p>Dernières opérations de démonstration</p>
            </div>
            <button className="text-link" onClick={() => navigate(ROUTES.history)}>
              Tout voir <ChevronRight size={14} />
            </button>
          </div>
          <div className="activity-list">
            {history.slice(0, 3).map((entry, index) => (
              <div className="activity-row" key={entry.id}>
                <div className={`activity-icon ${index === 0 ? 'blue' : ''}`}>
                  {index === 0 ? <Check size={15} /> : index === 1 ? <Activity size={15} /> : <Unplug size={15} />}
                </div>
                <div className="activity-copy">
                  <strong>{entry.name}</strong>
                  <span>{entry.detail}</span>
                </div>
                {/* Horodatage déduit de l'index, comme dans la maquette (audit B12). */}
                <span className="activity-time">{index === 0 ? 'Il y a 2 h' : index === 1 ? 'Hier' : 'Il y a 3 jours'}</span>
                <span className="status-pill">{entry.result}</span>
              </div>
            ))}
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
            État général du système{' '}
            <span className="healthy">
              <i /> Démonstration uniquement
            </span>
          </strong>
          <p>Les indicateurs ci-dessus sont fictifs. Aucune analyse ou modification réelle de Windows n’a été réalisée.</p>
        </div>
        <button onClick={() => openAction('État du système')}>
          Détails <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}
