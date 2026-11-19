import { Activity, ChevronRight, CircleHelp, Folder, HardDrive, History, Info, MoreHorizontal } from 'lucide-react'
import { PageHeading } from '@/components/PageHeading'
import { useEngineMode } from '@/hooks/use-engine-mode'
import { useVolumes } from '@/hooks/use-volumes'
import { formatBytes, usagePercent } from '@/lib/format'
import { useAppState } from '@/store/app-state'

/** Inventaire des disques — données de démonstration, actions simulées. */
export function InventoryPage() {
  const { volumes, loading, error } = useVolumes()
  const demo = useEngineMode() === 'demo'
  const { selectedDisk, setSelectedDisk, openAction } = useAppState()

  return (
    <>
      <PageHeading
        eyebrow="ESPACE DE TRAVAIL / STOCKAGE"
        title="Inventaire des disques"
        description="Capacité et occupation de vos volumes inventoriés."
        action={
          <button className="button primary" onClick={() => openAction('Analyser un disque')}>
            <Activity size={15} /> Analyser un disque
          </button>
        }
      />

      <div className="info-banner">
        <Info size={17} />
        <span>
          {demo
            ? 'Vue de démonstration — les capacités affichées sont des exemples et ne proviennent pas de votre PC.'
            : 'Volumes et capacités lus sur ce PC, en lecture seule. Aucune écriture n’est effectuée sur les disques.'}
        </span>
      </div>

      {Boolean(error) && (
        <div className="error-banner" role="alert">
          <Info size={16} />
          <div>
            <strong>Volumes indisponibles</strong>
            <span>Le moteur n’a pas pu énumérer les volumes de ce PC.</span>
          </div>
        </div>
      )}

      {loading && <div className="state-note">Lecture des volumes en cours…</div>}

      <div className="inventory-cards">
        {volumes.map((volume) => (
          <article
            key={volume.id}
            className={`inventory-card ${selectedDisk === volume.letter ? 'chosen' : ''}`}
            onClick={() => setSelectedDisk(volume.letter)}
          >
            <div className="inventory-head">
              <div className="drive-icon large">
                <HardDrive size={21} />
              </div>
              <div>
                <span className="drive-type">{volume.kind}</span>
                <h2>
                  {volume.letter} {volume.label}
                </h2>
              </div>
              <button
                className="icon-button"
                aria-label={`Options ${volume.letter}`}
                onClick={(event) => {
                  event.stopPropagation()
                  openAction('Options du disque')
                }}
              >
                <MoreHorizontal size={18} />
              </button>
            </div>
            <div className="inventory-usage">
              <div className="usage-track">
                <span
                  style={{ width: `${usagePercent(volume.usedBytes, volume.totalBytes)}%`, background: volume.accent }}
                />
              </div>
              <div className="usage-labels">
                <strong>{formatBytes(volume.usedBytes)} utilisés</strong>
                <span>{formatBytes(volume.totalBytes)} au total</span>
              </div>
            </div>
            <div className="capacity-grid">
              <div>
                <span>Utilisé</span>
                <strong>{formatBytes(volume.usedBytes)}</strong>
              </div>
              <div>
                <span>Disponible</span>
                <strong className="free-space">{formatBytes(volume.freeBytes)}</strong>
              </div>
              <div>
                <span>Occupation</span>
                <strong>{usagePercent(volume.usedBytes, volume.totalBytes)}%</strong>
              </div>
            </div>
            <div className="inventory-actions">
              <button
                className="button secondary"
                onClick={(event) => {
                  event.stopPropagation()
                  openAction('Analyse du disque')
                }}
              >
                <Activity size={14} /> Analyser
              </button>
              <button
                className="button ghost"
                onClick={(event) => {
                  event.stopPropagation()
                  openAction('Analyser un dossier')
                }}
              >
                <Folder size={14} /> Choisir un dossier
              </button>
              <button
                className="icon-button"
                title="Inventaires enregistrés"
                onClick={(event) => {
                  event.stopPropagation()
                  openAction('Inventaires enregistrés')
                }}
              >
                <History size={15} />
              </button>
            </div>
          </article>
        ))}
      </div>

      <div className="bottom-tip">
        <CircleHelp size={17} />
        <span>
          <strong>Besoin d’un inventaire précédent ?</strong> Retrouvez vos instantanés et comparez leur évolution.
        </span>
        <button className="text-link" onClick={() => openAction('Inventaires enregistrés')}>
          Consulter l’historique <ChevronRight size={14} />
        </button>
      </div>
    </>
  )
}
