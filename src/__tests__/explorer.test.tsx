import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { App } from '@/app/App'

/**
 * Explorateur : navigation réelle dans une arborescence, tri, filtres,
 * propriétés, recherche récursive avec progression et annulation.
 *
 * Tous les tests s'exécutent avec le moteur de démonstration (hors Tauri), mais
 * ils empruntent le contrat `SystemService` réellement utilisé en production.
 */

const PROFILE = 'C:\\Utilisateurs\\Alexandre'

function renderExplorer() {
  return render(
    <MemoryRouter initialEntries={['/explorer']}>
      <App />
    </MemoryRouter>,
  )
}

function table() {
  return within(screen.getByRole('table'))
}

async function openRow(user: ReturnType<typeof userEvent.setup>, name: string) {
  await user.dblClick(await table().findByText(name))
}

function rowNames(): string[] {
  const table = screen.getByRole('table')
  return within(table)
    .getAllByRole('row')
    .slice(1)
    .map((row) => row.querySelector('strong')?.textContent ?? '')
}

describe('Explorateur de fichiers', () => {
  it('affiche le dossier de départ, dossiers d’abord, puis les fichiers', async () => {
    renderExplorer()

    expect(await screen.findByText('6 éléments · Données fictives')).toBeInTheDocument()
    expect(rowNames()).toEqual([
      'Bureau',
      'Documents',
      'Images',
      'Projets',
      'Téléchargements',
      'notes_personnelles.txt',
    ])
    expect(screen.getByLabelText('Chemin courant')).toHaveTextContent('Alexandre')
    expect(screen.getByText('12,2 Ko')).toBeInTheDocument()
  })

  it('ouvre un dossier par double-clic, puis revient avec « Dossier parent »', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await openRow(user, 'Documents')
    expect(await screen.findByText('4 éléments · Données fictives')).toBeInTheDocument()
    expect(rowNames()).toContain('Rapport_annuel_2026.pdf')

    await user.click(screen.getByRole('button', { name: 'Dossier parent' }))
    expect(await screen.findByText('6 éléments · Données fictives')).toBeInTheDocument()
  })

  it('remonte au parent via l’arborescence des volumes et revient en arrière', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await screen.findByText('6 éléments · Données fictives')
    await user.click(screen.getByRole('button', { name: /C: Système/ }))
    expect(await screen.findByText('3 éléments · Données fictives')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Précédent' }))
    expect(await screen.findByText('6 éléments · Données fictives')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Suivant' }))
    expect(await screen.findByText('3 éléments · Données fictives')).toBeInTheDocument()
  })

  it('trie par taille dans les deux sens, dossiers toujours en tête', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await openRow(user, 'Documents')
    await screen.findByText('4 éléments · Données fictives')

    await user.click(screen.getByRole('button', { name: 'Trier par Taille' }))
    expect(rowNames()).toEqual([
      'Archives',
      'budget_2026.xlsx',
      'Rapport_annuel_2026.pdf',
      'Présentation_projet.pptx',
    ])

    await user.click(screen.getByRole('button', { name: 'Trier par Taille' }))
    expect(rowNames()).toEqual([
      'Archives',
      'Présentation_projet.pptx',
      'Rapport_annuel_2026.pdf',
      'budget_2026.xlsx',
    ])
  })

  it('filtre par catégorie depuis la liste courante', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await openRow(user, 'Documents')
    await screen.findByText('4 éléments · Données fictives')

    await user.selectOptions(screen.getByLabelText('Filtrer les éléments'), 'document')
    expect(await screen.findByText('3 éléments · Données fictives')).toBeInTheDocument()
    expect(rowNames()).toEqual(['budget_2026.xlsx', 'Présentation_projet.pptx', 'Rapport_annuel_2026.pdf'])
  })

  it('affiche les éléments cachés à la demande', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await screen.findByText('6 éléments · Données fictives')
    expect(screen.queryByText('.config_projet')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Afficher les éléments cachés' }))
    expect(await screen.findByText('7 éléments · Données fictives')).toBeInTheDocument()
    expect(screen.getByText('.config_projet')).toBeInTheDocument()
  })

  it('affiche les propriétés réelles de l’élément sélectionné', async () => {
    const user = userEvent.setup()
    const { container } = renderExplorer()

    await openRow(user, 'Documents')
    await user.click(await table().findByText('Rapport_annuel_2026.pdf'))

    const panel = container.querySelector('.properties-panel') as HTMLElement
    expect(panel).toHaveTextContent('Rapport_annuel_2026.pdf')
    expect(panel).toHaveTextContent('Document PDF')
    expect(panel).toHaveTextContent('8,4 Mo')
    expect(panel).toHaveTextContent(`${PROFILE}\\Documents`)
    expect(panel).toHaveTextContent('Lecture seule')
  })

  it('signale les dossiers protégés sans les parcourir', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await user.click(await screen.findByRole('button', { name: /C: Système/ }))
    await openRow(user, 'Windows')
    await screen.findByText('4 éléments · Données fictives')

    expect(screen.getAllByTitle('Dossier protégé — jamais parcouru').length).toBeGreaterThan(0)

    await openRow(user, 'WinSxS')
    const dialog = await screen.findByRole('dialog')
    expect(dialog).toHaveTextContent('Dossier protégé — non parcouru')
  })

  it('lance une recherche récursive et affiche ses résultats', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await screen.findByText('6 éléments · Données fictives')

    await user.type(screen.getByLabelText('Rechercher dans ce dossier'), 'rapport')
    await user.click(screen.getByRole('button', { name: 'Lancer une recherche récursive' }))

    expect(await screen.findByText(/2 résultats/)).toBeInTheDocument()
    expect(rowNames()).toEqual(['Rapport_2025.pdf', 'Rapport_annuel_2026.pdf'])

    await user.click(screen.getByRole('button', { name: 'Revenir au dossier' }))
    expect(await screen.findByText('6 éléments · Données fictives')).toBeInTheDocument()
  })

  it('annule une recherche en cours', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await user.click(await screen.findByRole('button', { name: /C: Système/ }))
    await screen.findByText('3 éléments · Données fictives')

    await user.type(screen.getByLabelText('Rechercher dans ce dossier'), 'e')
    await user.click(screen.getByRole('button', { name: 'Lancer une recherche récursive' }))
    await user.click(screen.getByRole('button', { name: 'Annuler' }))

    expect(await screen.findByText(/Recherche annulée/)).toBeInTheDocument()
  })

  it('n’exécute aucune action destructive : les boutons expliquent seulement', async () => {
    const user = userEvent.setup()
    renderExplorer()

    await screen.findByText('6 éléments · Données fictives')

    for (const label of ['Déplacer', 'Renommer', 'Supprimer']) {
      await user.click(screen.getByRole('button', { name: label }))
      const dialog = await screen.findByRole('dialog')
      expect(dialog).toHaveTextContent(`${label} — opération non disponible`)
      expect(dialog).toHaveTextContent(/Aucune opération réelle ne sera effectuée/i)
      await user.click(within(dialog).getByRole('button', { name: 'Compris' }))
    }

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})
