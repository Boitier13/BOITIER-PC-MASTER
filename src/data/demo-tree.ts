import { joinPath, normalizePathKey, withEntryType } from '@/domain/file-entry'
import type { FileAttributes, FileCategory, FileEntry, UserFolder, Volume } from '@/domain/types'
import { disks } from '@/data/demo'

/**
 * Arborescence de démonstration du moteur de fichiers.
 *
 * Elle remplace l'ancienne liste plate de sept lignes par une **vraie
 * arborescence** (dossiers, sous-dossiers, tailles en octets, horodatages,
 * attributs, liens, dossiers protégés, accès refusés) : sans accès disque, le
 * mode démo exerce exactement les mêmes chemins de code que le moteur Windows.
 *
 * Les données restent fictives et clairement identifiées comme telles.
 */

export interface DemoNodeSpec {
  /** Chemin du dossier parent (forme `C:\A\B`). */
  parent: string
  name: string
  kind: 'dir' | 'file'
  sizeBytes?: number
  modifiedAtMs?: number
  createdAtMs?: number
  symlink?: boolean
  /** Dossier système sensible : affiché, jamais parcouru. */
  protected?: boolean
  /** Lecture impossible : l'entrée reste visible, sans métadonnées. */
  denied?: boolean
  flags?: Partial<FileAttributes>
}

const NOVEMBER_2026 = (day: number, hour: number, minute = 0): number =>
  Date.UTC(2026, 10, day, hour, minute)

export const DEMO_VOLUME_ROOTS = ['C:\\', 'D:\\', 'E:\\']

export const DEMO_NODES: DemoNodeSpec[] = [
  /* C: — racine */
  { parent: 'C:\\', name: 'Utilisateurs', kind: 'dir', modifiedAtMs: NOVEMBER_2026(19, 9, 20) },
  { parent: 'C:\\', name: 'Windows', kind: 'dir', modifiedAtMs: NOVEMBER_2026(12, 4, 10) },
  { parent: 'C:\\', name: 'Program Files', kind: 'dir', modifiedAtMs: NOVEMBER_2026(8, 18, 2) },
  {
    parent: 'C:\\',
    name: 'System Volume Information',
    kind: 'dir',
    protected: true,
    denied: true,
    flags: { hidden: true, system: true },
  },
  {
    parent: 'C:\\',
    name: 'pagefile.sys',
    kind: 'file',
    sizeBytes: 16 * 1024 ** 3,
    protected: true,
    flags: { hidden: true, system: true },
  },

  /* Utilisateurs */
  { parent: 'C:\\Utilisateurs', name: 'Alexandre', kind: 'dir', modifiedAtMs: NOVEMBER_2026(19, 9, 42) },
  { parent: 'C:\\Utilisateurs', name: 'Public', kind: 'dir', modifiedAtMs: NOVEMBER_2026(2, 8, 15) },

  /* Profil d'Alexandre */
  { parent: 'C:\\Utilisateurs\\Alexandre', name: 'Bureau', kind: 'dir', modifiedAtMs: NOVEMBER_2026(19, 8, 5) },
  { parent: 'C:\\Utilisateurs\\Alexandre', name: 'Documents', kind: 'dir', modifiedAtMs: NOVEMBER_2026(18, 16, 12) },
  { parent: 'C:\\Utilisateurs\\Alexandre', name: 'Images', kind: 'dir', modifiedAtMs: NOVEMBER_2026(17, 11, 8) },
  { parent: 'C:\\Utilisateurs\\Alexandre', name: 'Projets', kind: 'dir', modifiedAtMs: NOVEMBER_2026(19, 9, 42) },
  { parent: 'C:\\Utilisateurs\\Alexandre', name: 'Téléchargements', kind: 'dir', modifiedAtMs: NOVEMBER_2026(16, 20, 31) },
  {
    parent: 'C:\\Utilisateurs\\Alexandre',
    name: 'notes_personnelles.txt',
    kind: 'file',
    sizeBytes: 12_480,
    modifiedAtMs: NOVEMBER_2026(15, 7, 12),
    flags: { archive: true },
  },
  {
    parent: 'C:\\Utilisateurs\\Alexandre',
    name: '.config_projet',
    kind: 'file',
    sizeBytes: 512,
    modifiedAtMs: NOVEMBER_2026(11, 22, 4),
    flags: { hidden: true },
  },

  /* Bureau */
  { parent: 'C:\\Utilisateurs\\Alexandre\\Bureau', name: 'Raccourci_Inventaire.lnk', kind: 'file', sizeBytes: 2_048, modifiedAtMs: NOVEMBER_2026(19, 8, 5) },
  { parent: 'C:\\Utilisateurs\\Alexandre\\Bureau', name: 'photo_vacances.jpg', kind: 'file', sizeBytes: 3_450_880, modifiedAtMs: NOVEMBER_2026(3, 14, 26) },

  /* Documents */
  {
    parent: 'C:\\Utilisateurs\\Alexandre\\Documents',
    name: 'Rapport_annuel_2026.pdf',
    kind: 'file',
    sizeBytes: 8_808_038,
    modifiedAtMs: NOVEMBER_2026(15, 14, 30),
    flags: { archive: true },
  },
  {
    parent: 'C:\\Utilisateurs\\Alexandre\\Documents',
    name: 'Présentation_projet.pptx',
    kind: 'file',
    sizeBytes: 25_270_732,
    modifiedAtMs: NOVEMBER_2026(14, 10, 18),
    flags: { archive: true },
  },
  {
    parent: 'C:\\Utilisateurs\\Alexandre\\Documents',
    name: 'budget_2026.xlsx',
    kind: 'file',
    sizeBytes: 1_258_291,
    modifiedAtMs: NOVEMBER_2026(13, 17, 45),
    flags: { archive: true },
  },
  { parent: 'C:\\Utilisateurs\\Alexandre\\Documents', name: 'Archives', kind: 'dir', modifiedAtMs: NOVEMBER_2026(10, 9, 0) },
  {
    parent: 'C:\\Utilisateurs\\Alexandre\\Documents\\Archives',
    name: 'Rapport_2025.pdf',
    kind: 'file',
    sizeBytes: 6_291_456,
    modifiedAtMs: NOVEMBER_2026(10, 9, 0),
  },

  /* Images */
  { parent: 'C:\\Utilisateurs\\Alexandre\\Images', name: 'photo_2026_01.jpg', kind: 'file', sizeBytes: 4_404_019, modifiedAtMs: NOVEMBER_2026(17, 11, 8) },
  { parent: 'C:\\Utilisateurs\\Alexandre\\Images', name: 'capture_ecran.png', kind: 'file', sizeBytes: 798_720, modifiedAtMs: NOVEMBER_2026(16, 18, 44) },

  /* Projets */
  { parent: 'C:\\Utilisateurs\\Alexandre\\Projets', name: 'notes_projet.md', kind: 'file', sizeBytes: 4_096, modifiedAtMs: NOVEMBER_2026(19, 9, 42) },
  { parent: 'C:\\Utilisateurs\\Alexandre\\Projets', name: 'app_bancaire', kind: 'dir', modifiedAtMs: NOVEMBER_2026(18, 22, 10) },
  { parent: 'C:\\Utilisateurs\\Alexandre\\Projets\\app_bancaire', name: 'index.ts', kind: 'file', sizeBytes: 2_048, modifiedAtMs: NOVEMBER_2026(18, 22, 10) },

  /* Téléchargements */
  { parent: 'C:\\Utilisateurs\\Alexandre\\Téléchargements', name: 'installateur_outils.exe', kind: 'file', sizeBytes: 125_829_120, modifiedAtMs: NOVEMBER_2026(16, 20, 31) },

  /* Windows */
  { parent: 'C:\\Windows', name: 'System32', kind: 'dir', modifiedAtMs: NOVEMBER_2026(12, 4, 10) },
  { parent: 'C:\\Windows', name: 'WinSxS', kind: 'dir', protected: true, modifiedAtMs: NOVEMBER_2026(12, 4, 10) },
  { parent: 'C:\\Windows', name: 'CSC', kind: 'dir', protected: true, denied: true, modifiedAtMs: NOVEMBER_2026(12, 4, 10) },
  { parent: 'C:\\Windows', name: 'explorer.exe', kind: 'file', sizeBytes: 4_874_240, modifiedAtMs: NOVEMBER_2026(12, 4, 10), flags: { system: true, archive: true } },

  { parent: 'C:\\Windows\\System32', name: 'kernel32.dll', kind: 'file', sizeBytes: 759_808, modifiedAtMs: NOVEMBER_2026(12, 4, 10), flags: { system: true, hidden: true } },
  { parent: 'C:\\Windows\\System32', name: 'notepad.exe', kind: 'file', sizeBytes: 201_728, modifiedAtMs: NOVEMBER_2026(12, 4, 10), flags: { system: true } },
  { parent: 'C:\\Windows\\System32', name: 'config', kind: 'dir', protected: true, modifiedAtMs: NOVEMBER_2026(12, 4, 10) },

  /* Program Files */
  { parent: 'C:\\Program Files', name: 'Adobe', kind: 'dir', modifiedAtMs: NOVEMBER_2026(8, 18, 2) },
  { parent: 'C:\\Program Files', name: 'Google', kind: 'dir', modifiedAtMs: NOVEMBER_2026(6, 12, 55) },
  { parent: 'C:\\Program Files\\Adobe', name: 'Photoshop 2025', kind: 'dir', modifiedAtMs: NOVEMBER_2026(8, 18, 2) },
  { parent: 'C:\\Program Files\\Google', name: 'Chrome', kind: 'dir', modifiedAtMs: NOVEMBER_2026(6, 12, 55) },

  /* D: — données */
  { parent: 'D:\\', name: 'Sauvegardes', kind: 'dir', modifiedAtMs: NOVEMBER_2026(12, 18, 5) },
  { parent: 'D:\\', name: 'Vidéos', kind: 'dir', modifiedAtMs: NOVEMBER_2026(10, 9, 20) },
  { parent: 'D:\\', name: 'Lien_vers_Sauvegardes', kind: 'dir', symlink: true, modifiedAtMs: NOVEMBER_2026(12, 18, 6) },

  {
    parent: 'D:\\Sauvegardes',
    name: 'Sauvegarde_projet.zip',
    kind: 'file',
    sizeBytes: 1_374_389_535,
    modifiedAtMs: NOVEMBER_2026(12, 18, 5),
    flags: { archive: true },
  },
  {
    parent: 'D:\\Sauvegardes',
    name: 'sauvegarde_2025.zip',
    kind: 'file',
    sizeBytes: 933_232_640,
    modifiedAtMs: NOVEMBER_2026(2, 21, 40),
    flags: { archive: true },
  },
  {
    parent: 'D:\\Vidéos',
    name: 'Vidéo_démonstration.mp4',
    kind: 'file',
    sizeBytes: 882_900_992,
    modifiedAtMs: NOVEMBER_2026(10, 9, 20),
    flags: { archive: true },
  },

  /* E: — archives */
  { parent: 'E:\\', name: 'Archives', kind: 'dir', modifiedAtMs: NOVEMBER_2026(4, 10, 0) },
  {
    parent: 'E:\\Archives',
    name: 'archive_2019.zip',
    kind: 'file',
    sizeBytes: 2_254_857_830,
    modifiedAtMs: NOVEMBER_2026(4, 10, 0),
  },
]

const DEFAULT_FLAGS: FileAttributes = {
  readonly: false,
  hidden: false,
  system: false,
  archive: false,
  directory: false,
  reparsePoint: false,
  offline: false,
  temporary: false,
  sparse: false,
  compressed: false,
  encrypted: false,
  raw: 0,
}

function attributesFor(spec: DemoNodeSpec): FileAttributes {
  return {
    ...DEFAULT_FLAGS,
    directory: spec.kind === 'dir',
    reparsePoint: spec.symlink === true,
    ...spec.flags,
  }
}

export function demoEntryFromSpec(spec: DemoNodeSpec): FileEntry {
  const path = joinPath(spec.parent, spec.name)
  const isDirectory = spec.kind === 'dir'
  const extension = isDirectory ? null : spec.name.includes('.') ? spec.name.split('.').pop()!.toLowerCase() : null
  const category: FileCategory = isDirectory ? 'folder' : categoryOf(extension)

  return withEntryType({
    name: spec.name,
    path,
    parent: spec.parent,
    extension,
    category,
    sizeBytes: isDirectory ? 0 : (spec.sizeBytes ?? 0),
    createdAtMs: spec.createdAtMs ?? spec.modifiedAtMs ?? null,
    modifiedAtMs: spec.modifiedAtMs ?? null,
    accessedAtMs: spec.modifiedAtMs ?? null,
    isDirectory,
    isSymlink: spec.symlink === true,
    isProtected: spec.protected === true,
    accessDenied: spec.denied === true,
    attributes: attributesFor(spec),
  })
}

/** Copie locale de la règle de catégorie (miroir de `category_for` en Rust). */
function categoryOf(extension: string | null): FileCategory {
  if (!extension) return 'other'
  const groups: Record<FileCategory, string[]> = {
    folder: [],
    document: ['pdf', 'doc', 'docx', 'odt', 'rtf', 'txt', 'md', 'xls', 'xlsx', 'ods', 'csv', 'ppt', 'pptx', 'odp', 'epub'],
    image: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'tif', 'tiff', 'svg', 'heic', 'raw', 'psd', 'ico'],
    video: ['mp4', 'mkv', 'avi', 'mov', 'wmv', 'flv', 'webm', 'm4v', 'mpg', 'mpeg'],
    audio: ['mp3', 'wav', 'flac', 'aac', 'ogg', 'wma', 'm4a', 'opus'],
    archive: ['zip', 'rar', '7z', 'tar', 'gz', 'bz2', 'xz', 'iso', 'img', 'cab', 'msi'],
    application: ['exe', 'dll', 'msix', 'appx', 'bat', 'cmd', 'ps1', 'sys', 'com', 'scr'],
    system: ['lnk', 'ini', 'inf', 'reg', 'log', 'tmp', 'dat'],
    other: [],
  }
  for (const [category, extensions] of Object.entries(groups) as [FileCategory, string[]][]) {
    if (extensions.includes(extension)) return category
  }
  return 'other'
}

/** Tous les nœuds, indexés par dossier parent (clé normalisée). */
export const DEMO_TREE: Record<string, DemoNodeSpec[]> = DEMO_NODES.reduce(
  (accumulator, spec) => {
    const key = normalizePathKey(spec.parent)
    accumulator[key] = [...(accumulator[key] ?? []), spec]
    return accumulator
  },
  {} as Record<string, DemoNodeSpec[]>,
)

export const DEMO_VOLUMES: Volume[] = disks.map((disk, index) => ({
  id: `volume-${disk.letter.replace(':', '').toLowerCase()}`,
  letter: disk.letter,
  label: disk.name,
  kind: disk.type,
  kindCode: index === 0 ? 'ssd' : index === 1 ? 'ssd' : 'hdd',
  filesystem: 'NTFS',
  totalBytes: disk.total * 1024 ** 3,
  usedBytes: disk.used * 1024 ** 3,
  freeBytes: disk.free * 1024 ** 3,
  isRemovable: false,
  accent: disk.color,
}))

export const DEMO_USER_FOLDERS: UserFolder[] = [
  { id: 'home', label: 'Profil', path: 'C:\\Utilisateurs\\Alexandre' },
  { id: 'desktop', label: 'Bureau', path: 'C:\\Utilisateurs\\Alexandre\\Bureau' },
  { id: 'downloads', label: 'Téléchargements', path: 'C:\\Utilisateurs\\Alexandre\\Téléchargements' },
  { id: 'documents', label: 'Documents', path: 'C:\\Utilisateurs\\Alexandre\\Documents' },
  { id: 'pictures', label: 'Images', path: 'C:\\Utilisateurs\\Alexandre\\Images' },
]

/** Dossiers dont la lecture est refusée dans la démonstration. */
export const DEMO_DENIED_PATHS = ['C:\\Windows\\CSC', 'C:\\System Volume Information']
