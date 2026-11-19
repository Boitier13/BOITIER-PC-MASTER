import type { FileAttributes, FileCategory, FileEntry } from '@/domain/types'

/**
 * Libellés et dérivation du type affiché.
 *
 * Le moteur Rust renvoie des données neutres (`category`, `extension`,
 * `isDirectory`) ; la traduction en français reste ici, côté interface, pour ne
 * pas figer la langue dans le moteur.
 */

export const CATEGORY_LABELS: Record<FileCategory, string> = {
  folder: 'Dossier',
  document: 'Document',
  image: 'Image',
  video: 'Vidéo',
  audio: 'Audio',
  archive: 'Archive',
  application: 'Application',
  system: 'Élément système',
  other: 'Fichier',
}

const EXTENSION_LABELS: Record<string, string> = {
  pdf: 'Document PDF',
  doc: 'Document Word',
  docx: 'Document Word',
  odt: 'Document texte',
  rtf: 'Document texte',
  txt: 'Fichier texte',
  md: 'Fichier Markdown',
  xls: 'Feuille de calcul',
  xlsx: 'Feuille de calcul',
  ods: 'Feuille de calcul',
  csv: 'Fichier CSV',
  ppt: 'Présentation',
  pptx: 'Présentation',
  odp: 'Présentation',
  jpg: 'Image JPG',
  jpeg: 'Image JPEG',
  png: 'Image PNG',
  bmp: 'Image BMP',
  gif: 'Image GIF',
  webp: 'Image WebP',
  svg: 'Image vectorielle',
  mp4: 'Vidéo MP4',
  mkv: 'Vidéo MKV',
  avi: 'Vidéo AVI',
  mov: 'Vidéo MOV',
  mp3: 'Audio MP3',
  wav: 'Audio WAV',
  flac: 'Audio FLAC',
  zip: 'Archive ZIP',
  rar: 'Archive RAR',
  '7z': 'Archive 7z',
  iso: 'Image disque ISO',
  msi: 'Programme d’installation MSI',
  exe: 'Application',
  dll: 'Bibliothèque DLL',
  sys: 'Pilote système',
  lnk: 'Raccourci',
  bat: 'Script de commandes',
  ps1: 'Script PowerShell',
}

/** Type lisible d'une entrée, sans dépendre de son index d'affichage. */
export function describeEntry(core: {
  isDirectory: boolean
  isSymlink: boolean
  extension: string | null
  category: FileCategory
}): string {
  if (core.isDirectory) return core.isSymlink ? 'Lien vers un dossier' : 'Dossier de fichiers'
  if (core.isSymlink) return 'Lien symbolique'

  const extension = core.extension?.toLowerCase()
  if (extension && EXTENSION_LABELS[extension]) return EXTENSION_LABELS[extension]
  if (extension) return `Fichier ${extension.toUpperCase()}`
  return 'Fichier sans extension'
}

/** Complète une entrée brute avec son libellé de type. */
export function withEntryType(core: Omit<FileEntry, 'type'>): FileEntry {
  return { ...core, type: describeEntry(core) }
}

/** Attributs actifs, en clair, pour le panneau Propriétés. */
export function describeAttributes(attributes: FileAttributes): string[] {
  const labels: string[] = []
  if (attributes.readonly) labels.push('Lecture seule')
  if (attributes.hidden) labels.push('Caché')
  if (attributes.system) labels.push('Système')
  if (attributes.archive) labels.push('Archive')
  if (attributes.compressed) labels.push('Compressé (NTFS)')
  if (attributes.encrypted) labels.push('Chiffré (EFS)')
  if (attributes.sparse) labels.push('Sparse')
  if (attributes.offline) labels.push('Hors ligne')
  if (attributes.temporary) labels.push('Temporaire')
  if (attributes.reparsePoint) labels.push('Point d’analyse')
  return labels
}

/** Options du filtre de l'explorateur (valeur stable → libellé). */
export const CATEGORY_FILTERS: { value: FileCategory | 'all'; label: string }[] = [
  { value: 'all', label: 'Tous les éléments' },
  { value: 'folder', label: 'Dossiers' },
  { value: 'document', label: 'Documents' },
  { value: 'image', label: 'Images' },
  { value: 'video', label: 'Vidéos' },
  { value: 'audio', label: 'Audio' },
  { value: 'archive', label: 'Archives' },
  { value: 'application', label: 'Applications' },
  { value: 'system', label: 'Éléments système' },
  { value: 'other', label: 'Autres fichiers' },
]

/** Segments navigables d'un chemin Windows (`C:\A\B` → `C:`, `A`, `B`). */
export function pathSegments(path: string): { name: string; path: string }[] {
  const normalized = path.replace(/\//g, '\\').replace(/\\+$/, '')
  if (!normalized) return []

  const parts = normalized.split('\\').filter(Boolean)
  const segments: { name: string; path: string }[] = []
  let current = ''

  parts.forEach((part, index) => {
    if (index === 0) {
      current = /^[A-Za-z]:$/.test(part) ? `${part}\\` : part
    } else if (current.endsWith('\\')) {
      current = `${current}${part}`
    } else {
      current = `${current}\\${part}`
    }
    segments.push({ name: part, path: current })
  })

  return segments
}

export function parentPathOf(path: string): string | null {
  const segments = pathSegments(path)
  if (segments.length <= 1) return null
  return segments[segments.length - 2].path
}

export function joinPath(parent: string, name: string): string {
  const base = parent.replace(/[\\/]+$/, '')
  if (!base) return name
  return `${base}\\${name}`
}

export function normalizePathKey(path: string): string {
  const normalized = path.replace(/\//g, '\\').replace(/\\+$/, '')
  return normalized.toLowerCase()
}
