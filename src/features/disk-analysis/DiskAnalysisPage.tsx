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
  Filter,
  HardDrive,
  Info,
  Music2,
  TrendingUp,
  Video,
} from 'lucide-react'
import { PageHeading } from '@/components/PageHeading'
import { Ranking } from '@/components/Ranking'
import { useAppState } from '@/store/app-state'

/**
 * Analyse de l'espace disque.
 * Catégories et classements figés (maquette) ; l'agrégation réelle viendra de
 * SQLite en phase 3 (table `entries`, requêtes `GROUP BY`).
 */
export function DiskAnalysisPage() {
  const { openAction } = useAppState()

  const categories = [
    { name: 'Documents', size: '326 Go', pct: 16, color: '#4388ff', icon: FileText },
    { name: 'Images', size: '214 Go', pct: 10, color: '#8b78ef', icon: FileImage },
    { name: 'Vidéos', size: '512 Go', pct: 25, color: '#20c5d7', icon: Video },
    { name: 'Musique', size: '96 Go', pct: 5, color: '#e49b58', icon: Music2 },
    { name: 'Archives', size: '288 Go', pct: 14, color: '#d76e8c', icon: Archive },
    { name: 'Applications', size: '684 Go', pct: 33, color: '#5968db', icon: AppWindow },
    { name: 'Autres', size: '42 Go', pct: 2, color: '#657184', icon: File },
  ]

  return (
    <>
      <PageHeading
        eyebrow="ESPACE DE TRAVAIL / STOCKAGE"
        title="Analyse de l’espace"
        description="Comprenez la répartition de l’espace dans votre inventaire."
        action={
          <button className="button primary" onClick={() => openAction('Lancer l’analyse d’espace')}>
            <Activity size={15} /> Nouvelle analyse
          </button>
        }
      />

      <div className="info-banner">
        <Info size={17} />
        <span>Les volumes et fichiers présentés sont fictifs. Aucune analyse de disque réel n’a lieu.</span>
      </div>

      <div className="analysis-grid">
        <section className="panel space-panel">
          <div className="panel-heading">
            <div>
              <h2>Répartition par catégorie</h2>
              <p>Volume total inventorié · 2,16 To</p>
            </div>
            <button className="button secondary" onClick={() => openAction('Sélectionner un disque')}>
              <HardDrive size={14} /> Tous les disques <ChevronDown size={14} />
            </button>
          </div>
          <div className="space-chart-row">
            <div className="large-donut">
              <div>
                <strong>2,16</strong>
                <span>To utilisés</span>
              </div>
            </div>
            <div className="space-legend">
              {categories.map((category) => (
                <div key={category.name}>
                  <i style={{ background: category.color }} />
                  <span>{category.name}</span>
                  <strong>{category.size}</strong>
                  <small>{category.pct}%</small>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="panel insight-panel">
          <div className="panel-heading">
            <div>
              <h2>Analyse facultative</h2>
              <p>Repérez des éléments à examiner</p>
            </div>
          </div>
          <div className="duplicate-card">
            <div className="duplicate-icon">
              <Copy size={18} />
            </div>
            <div>
              <strong>Détection des doublons</strong>
              <p>Identifier les fichiers identiques dans l’inventaire.</p>
            </div>
            <button className="button secondary" onClick={() => openAction('Analyser les doublons')}>
              Configurer
            </button>
          </div>
          <div className="insight-row">
            <TrendingUp size={16} />
            <span>Le dossier le plus volumineux</span>
            <strong>Vidéos · 512 Go</strong>
          </div>
          <div className="insight-row">
            <File size={16} />
            <span>Fichiers volumineux (&gt; 500 Mo)</span>
            <strong>248 éléments</strong>
          </div>
        </section>
      </div>

      <div className="two-panels">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Dossiers les plus volumineux</h2>
              <p>Classement par taille estimée</p>
            </div>
            <button className="button secondary" onClick={() => openAction('Trier les dossiers')}>
              Taille <ArrowDown size={14} />
            </button>
          </div>
          <Ranking
            rows={[
              ['Vidéos / Projets', '186 Go', 76],
              ['Documents / Archives', '124 Go', 54],
              ['Images / Bibliothèque', '92 Go', 40],
              ['Téléchargements', '68 Go', 30],
            ]}
          />
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <h2>Fichiers volumineux</h2>
              <p>Plus grands éléments répertoriés</p>
            </div>
            <button className="button secondary" onClick={() => openAction('Filtrer les fichiers')}>
              Filtres <Filter size={14} />
            </button>
          </div>
          <Ranking
            files
            rows={[
              ['Sauvegarde_projet.zip', '1,28 Go', 88],
              ['Vidéo_démonstration.mp4', '842 Mo', 62],
              ['Image_disque.iso', '6,4 Go', 100],
              ['Rendu_final.mov', '724 Mo', 52],
            ]}
          />
        </section>
      </div>
    </>
  )
}
