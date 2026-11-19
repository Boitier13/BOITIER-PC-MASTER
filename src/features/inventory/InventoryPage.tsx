import { Activity, ChevronRight, CircleHelp, Folder, HardDrive, History, Info, MoreHorizontal } from 'lucide-react'
import { PageHeading } from '@/components/PageHeading'
import { useWorkspace } from '@/data/use-workspace'
import { formatGigabytes, usagePercent } from '@/lib/format'
import { useAppState } from '@/store/app-state'

/** Inventaire des disques — données de démonstration, actions simulées. */
export function InventoryPage() {
  const { volumes } = useWorkspace()
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
        <span>Vue de démonstration — les capacités affichées sont des exemples et ne proviennent pas de votre PC.</span>
      </div>

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
                  style={{ width: `${(volume.usedGb / volume.totalGb) * 100}%`, background: volume.accent }}
                />
              </div>
              <div className="usage-labels">
                <strong>{formatGigabytes(volume.usedGb)} utilisés</strong>
                <span>{formatGigabytes(volume.totalGb)} au total</span>
              </div>
            </div>
            <div className="capacity-grid">
              <div>
                <span>Utilisé</span>
                <strong>{formatGigabytes(volume.usedGb)}</strong>
              </div>
              <div>
                <span>Disponible</span>
                <strong className="free-space">{formatGigabytes(volume.freeGb)}</strong>
              </div>
              <div>
                <span>Occupation</span>
                <strong>{usagePercent(volume.usedGb, volume.totalGb)}%</strong>
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
