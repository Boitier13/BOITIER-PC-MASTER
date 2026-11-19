import {
  Activity,
  AppWindow,
  Archive,
  ArrowDown,
  ChevronDown,
  Copy,
  File,
  FileImage,
  FileText,
  FolderOpen,
  HardDrive,
  Info,
  Music2,
  ScanLine,
  TrendingUp,
  Video,
  X,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { DemoLabel } from '@/components/DemoLabel'
import { PageHeading } from '@/components/PageHeading'
import { Ranking } from '@/components/Ranking'
import { coverageDetail, coverageLabel, measuredAgainstUsed, useMeasurements } from '@/hooks/use-analysis'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useVolumes } from '@/hooks/use-volumes'
import { CATEGORY_COLORS, CATEGORY_LABELS, donutGradient } from '@/lib/categories'
import { formatBytes, formatCount, formatDateTime, formatDuration } from '@/lib/format'
import type { AnalysisReport, FileCategory } from '@/domain/types'
import { ServiceError } from '@/services/system-service'
import { useAppState } from '@/store/app-state'

const CATEGORY_ICONS: Partial<Record<FileCategory, typeof File>> = {
  document: FileText,
  image: FileImage,
  video: Video,
  audio: Music2,
  archive: Archive,
  application: AppWindow,
  other: File,
  system: File,
}

const LARGE_FILE_BYTES = 500 * 1024 ** 2

/** Rapport d'erreur lisible : aucune valeur n'est affichée à la place. */
function errorMessage(error: unknown): string {
  if (error instanceof ServiceError) return error.userMessage
  if (error instanceof Error && error.message) return error.message
  return 'La mesure a échoué. Aucun résultat n’est disponible.'
}

function rankingPercent(value: number, reference: number): number {
  if (reference <= 0) return 0
  return Math.max(1, Math.round((value / reference) * 100))
}

function Insights({ report }: { report: AnalysisReport }) {
  const largestFolder = report.topFolders[0] ?? null
  const largestFile = report.largestFiles[0] ?? null
  const largeFiles = report.largestFiles.filter((file) => file.bytes >= LARGE_FILE_BYTES).length

  return (
    <>
      <div className="insight-row">
        <TrendingUp size={16} />
        <span>Dossier le plus volumineux (contenu direct)</span>
        <strong>
          {largestFolder ? `${formatBytes(largestFolder.bytes)} · ${largestFolder.path}` : 'Aucun dossier mesuré'}
        </strong>
      </div>
      <div className="insight-row">
        <File size={16} />
        <span>Plus gros fichier mesuré</span>
        <strong>{largestFile ? `${formatBytes(largestFile.bytes)} · ${largestFile.name}` : 'Aucun fichier mesuré'}</strong>
      </div>
      <div className="insight-row">
        <File size={16} />
        <span>Fichiers &gt; 500 Mo parmi les {report.largestFiles.length} plus gros mesurés</span>
        <strong>{formatCount(largeFiles)}</strong>
      </div>
    </>
  )
}

/**
 * Analyse de l'espace.
 *
 * Aucune valeur n'apparaît avant une mesure réelle : l'écran ne contient plus ni
 * catégorie d'exemple, ni classement fictif. Le périmètre est toujours choisi
 * explicitement, et la couverture de la mesure est affichée à côté des totaux.
 */
export function DiskAnalysisPage() {
  const demo = useEngineMode() === 'demo'
  const { volumes, folders } = useVolumes()
  const { lastReport, running, runningRoot, progress, error, start, cancel } = useMeasurements()
  const { openAction } = useAppState()
  const [scope, setScope] = useState('')

  const scopes = useMemo(() => {
    const volumeScopes = volumes.map((volume) => ({
      value: volume.letter,
      label: `${volume.letter} ${volume.label} · ${formatBytes(volume.totalBytes)}`,
      root: volume.letter.endsWith('\\') ? volume.letter : `${volume.letter}\\`,
    }))
    const folderScopes = folders.map((folder) => ({
      value: folder.id,
      label: `${folder.label} · ${folder.path}`,
      root: folder.path,
    }))
    return [...volumeScopes, ...folderScopes]
  }, [folders, volumes])

  const selected = scopes.find((item) => item.value === scope) ?? scopes[0] ?? null
  const activeRoot = runningRoot ?? selected?.root ?? null

  const report = lastReport
  const slices = useMemo(() => {
    if (!report) return []
    return report.byCategory
      .filter((category) => category.bytes > 0)
      .map((category) => ({
        label: CATEGORY_LABELS[category.category] ?? category.category,
        color: CATEGORY_COLORS[category.category] ?? '#3b4557',
        files: category.files,
        bytes: category.bytes,
        category: category.category,
      }))
  }, [report])
  const measured = report?.totalSizeBytes ?? 0
  const donut = useMemo(() => donutGradient(slices, measured), [slices, measured])

  const usedBytes = useMemo(() => {
    if (!report) return null
    const volume = volumes.find((item) => report.root.startsWith(item.letter))
    return volume?.usedBytes ?? null
  }, [report, volumes])

  const comparison = report ? measuredAgainstUsed(report, usedBytes) : null

  return (
    <>
      <PageHeading
        eyebrow="ESPACE DE TRAVAIL / STOCKAGE"
        title="Analyse de l’espace"
        description="Mesurez le contenu réel d’un volume ou d’un dossier, en lecture seule."
        action={<DemoLabel />}
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          {demo
            ? 'La mesure réelle n’est pas disponible en démonstration : aucun chiffre d’exemple n’est affiché.'
            : 'La mesure parcourt uniquement la racine que vous désignez, sans lire ni modifier autre chose. Un total partiel est toujours signalé comme tel.'}
        </span>
      </div>

      <section className="panel measure-panel">
        <div className="panel-heading">
          <div>
            <h2>Périmètre de la mesure</h2>
            <p>
              {selected
                ? `Racine : ${selected.root}`
                : 'Aucun volume ni dossier proposé par le moteur pour l’instant.'}
            </p>
          </div>
          <div className="measure-actions">
            {scopes.length > 0 && (
              <label className="measure-select">
                <HardDrive size={14} />
                <select
                  aria-label="Périmètre à mesurer"
                  value={selected?.value ?? ''}
                  disabled={running}
                  onChange={(event) => setScope(event.target.value)}
                >
                  {scopes.map((item) => (
                    <option key={item.value} value={item.value}>
                      {item.label}
                    </option>
                  ))}
                </select>
                <ChevronDown size={13} />
              </label>
            )}
            {running ? (
              <button className="button danger" onClick={cancel}>
                <X size={14} /> Annuler
              </button>
            ) : (
              <button
                className="button primary"
                disabled={!activeRoot || demo}
                title={demo ? 'Mesure indisponible en démonstration' : undefined}
                onClick={() => activeRoot && void start(activeRoot)}
              >
                <ScanLine size={15} /> Mesurer
              </button>
            )}
          </div>
        </div>

        {running && (
          <div className="measure-progress" role="status" aria-live="polite">
            <div className="measure-progress-head">
              <strong>Mesure en cours…</strong>
              <span>{formatCount(progress?.visited ?? 0)} entrées visitées</span>
            </div>
            <div className="measure-progress-track">
              <i />
            </div>
            <p className="measure-current" title={progress?.current ?? ''}>
              {progress?.current || 'Préparation du parcours…'}
            </p>
          </div>
        )}

        {Boolean(error) && (
          <div className="error-banner" role="alert">
            <Info size={16} />
            <div>
              <strong>Mesure impossible</strong>
              <span>{errorMessage(error)}</span>
            </div>
          </div>
        )}

        {report && !running && (
          <div className="measure-summary">
            <div>
              <strong>{formatCount(report.files)} fichiers</strong>
              <span>{formatCount(report.folders)} dossiers mesurés</span>
            </div>
            <div>
              <strong>{formatBytes(report.totalSizeBytes)}</strong>
              <span>octets mesurés</span>
            </div>
            <div>
              <strong>{formatDuration(report.elapsedMs)}</strong>
              <span>{formatDateTime(report.scannedAtMs)}</span>
            </div>
            <div>
              <strong>{coverageLabel(report)}</strong>
              <span>{report.root}</span>
            </div>
          </div>
        )}
        {report && <p className="measure-coverage">{coverageDetail(report)}{comparison ? ` — ${comparison}` : ''}</p>}
      </section>

      {report ? (
        <>
          <div className="analysis-grid">
            <section className="panel space-panel">
              <div className="panel-heading">
                <div>
                  <h2>Répartition par catégorie</h2>
                  <p>
                    Mesure du {formatDateTime(report.scannedAtMs)} · {report.root}
                  </p>
                </div>
                <button className="button secondary" onClick={() => openAction('Sélectionner un disque')}>
                  <HardDrive size={14} /> {report.root} <ChevronDown size={14} />
                </button>
              </div>
              {slices.length ? (
                <div className="space-chart-row">
                  <div className="large-donut" style={{ background: donut }} aria-label="Répartition mesurée">
                    <div>
                      <strong>{formatBytes(measured)}</strong>
                      <span>mesurés</span>
                    </div>
                  </div>
                  <div className="space-legend">
                    {slices.map((slice) => {
                      const Icon = CATEGORY_ICONS[slice.category] ?? File
                      const share = measured > 0 ? Math.round((slice.bytes / measured) * 100) : 0
                      return (
                        <div key={slice.label}>
                          <i style={{ background: slice.color }} />
                          <span>
                            <Icon size={11} /> {slice.label}
                          </span>
                          <strong>{formatBytes(slice.bytes)}</strong>
                          <small>{share}%</small>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ) : (
                <p className="state-note">
                  La mesure n’a trouvé aucun fichier lisible : aucune catégorie ne peut être affichée.
                </p>
              )}
            </section>

            <section className="panel insight-panel">
              <div className="panel-heading">
                <div>
                  <h2>Constats mesurés</h2>
                  <p>Calculés uniquement sur ce qui a été parcouru</p>
                </div>
              </div>
              <div className="duplicate-card">
                <div className="duplicate-icon">
                  <Copy size={18} />
                </div>
                <div>
                  <strong>Détection des doublons</strong>
                  <p>Disponible au lot C5 · aucune analyse de doublons n’a lieu pour l’instant.</p>
                </div>
                <button className="button secondary" disabled title="Disponible au lot C5">
                  Indisponible
                </button>
              </div>
              <Insights report={report} />
            </section>
          </div>

          <div className="two-panels">
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Dossiers les plus volumineux</h2>
                  <p>Contenu direct mesuré · 10 premiers</p>
                </div>
                <button className="button secondary" disabled>
                  Taille <ArrowDown size={14} />
                </button>
              </div>
              {report.topFolders.length ? (
                <Ranking
                  rows={report.topFolders.map((folder) => [
                    folder.path,
                    formatBytes(folder.bytes),
                    rankingPercent(folder.bytes, report.topFolders[0].bytes),
                  ])}
                />
              ) : (
                <p className="state-note">Aucun dossier mesuré.</p>
              )}
            </section>
            <section className="panel">
              <div className="panel-heading">
                <div>
                  <h2>Fichiers volumineux</h2>
                  <p>Plus gros fichiers mesurés · 20 premiers</p>
                </div>
                <button className="button secondary" disabled>
                  <FolderOpen size={14} /> Fichiers
                </button>
              </div>
              {report.largestFiles.length ? (
                <Ranking
                  files
                  rows={report.largestFiles.slice(0, 10).map((file) => [
                    file.name,
                    formatBytes(file.bytes),
                    rankingPercent(file.bytes, report.largestFiles[0].bytes),
                  ])}
                />
              ) : (
                <p className="state-note">Aucun fichier mesuré.</p>
              )}
            </section>
          </div>
        </>
      ) : (
        <section className="panel">
          <div className="empty-state">
            <Activity size={24} />
            <strong>Aucune mesure dans cette session</strong>
            <p>
              Choisissez un périmètre puis lancez la mesure : les catégories, les dossiers et les fichiers
              affichés ensuite proviendront uniquement de ce parcours.
            </p>
            {demo && <p>Le moteur de démonstration ne fournit aucune mesure réelle.</p>}
          </div>
        </section>
      )}
    </>
  )
}
