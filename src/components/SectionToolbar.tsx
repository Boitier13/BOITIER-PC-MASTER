import { ChevronDown, Filter, Search } from 'lucide-react'

/**
 * Composant conservé depuis la maquette (audit B17) : il n'est rendu par aucun
 * écran et sa recherche ne met rien à jour (`onChange` vide).
 * Conservé pour ne rien retirer de l'existant ; il sera soit branché, soit
 * supprimé lors de la refonte des barres d'outils (phase 3).
 */
export function SectionToolbar({
  placeholder,
  query,
  onAction,
  actions = [],
}: {
  placeholder: string
  query?: string
  onAction: (action: string) => void
  actions?: string[]
}) {
  return (
    <div className="section-toolbar">
      <label className="table-search">
        <Search size={15} />
        <input placeholder={placeholder} value={query} onChange={() => {}} aria-label={placeholder} />
      </label>
      <button className="button secondary" onClick={() => onAction('Filtres')}>
        <Filter size={15} /> Filtres <ChevronDown size={14} />
      </button>
      <div className="toolbar-spacer" />
      {actions.map((action) => (
        <button key={action} className="button secondary" onClick={() => onAction(action)}>
          {action}
        </button>
      ))}
    </div>
  )
}
