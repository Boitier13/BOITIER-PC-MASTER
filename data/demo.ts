export const disks = [
  { letter: 'C:', name: 'Système', type: 'SSD NVMe', total: 476, used: 312, free: 164, color: '#4388ff' },
  { letter: 'D:', name: 'Données', type: 'SSD SATA', total: 953, used: 581, free: 372, color: '#20c5d7' },
  { letter: 'E:', name: 'Archives', type: 'HDD', total: 1863, used: 1042, free: 821, color: '#8b78ef' },
]

export const apps = [
  { name: 'Microsoft 365 - fr-fr', publisher: 'Microsoft Corporation', version: '16.0.17928.20114', date: '12/11/2026', size: '2,84 Go', type: 'MSI', state: 'Installé' },
  { name: 'Adobe Photoshop 2025', publisher: 'Adobe Inc.', version: '26.1.0', date: '08/11/2026', size: '4,12 Go', type: 'Installateur', state: 'Installé' },
  { name: 'Google Chrome', publisher: 'Google LLC', version: '131.0.6778.86', date: '06/11/2026', size: '1,08 Go', type: 'MSI', state: 'Installé' },
  { name: 'Mozilla Firefox', publisher: 'Mozilla Corporation', version: '132.0.2', date: '04/11/2026', size: '612 Mo', type: 'MSI', state: 'Installé' },
  { name: 'Visual Studio Code', publisher: 'Microsoft Corporation', version: '1.95.3', date: '02/11/2026', size: '486 Mo', type: 'Inno Setup', state: 'Installé' },
  { name: 'Spotify', publisher: 'Spotify AB', version: '1.2.52.442', date: '29/10/2026', size: '312 Mo', type: 'MSIX', state: 'Installé' },
  { name: 'VLC media player', publisher: 'VideoLAN', version: '3.0.21', date: '21/10/2026', size: '184 Mo', type: 'NSIS', state: 'Installé' },
  { name: '7-Zip 24.09', publisher: 'Igor Pavlov', version: '24.09', date: '18/10/2026', size: '8,2 Mo', type: 'MSI', state: 'Installé' },
  { name: 'NVIDIA Graphics Driver', publisher: 'NVIDIA Corporation', version: '566.14', date: '14/10/2026', size: '1,62 Go', type: 'Pilote', state: 'Système' },
]

export const explorerItems = [
  { name: 'Projets', type: 'Dossier de fichiers', size: '—', date: '19/11/2026 09:42', path: 'C:\\Utilisateurs\\Alexandre' },
  { name: 'Documents', type: 'Dossier de fichiers', size: '—', date: '18/11/2026 16:12', path: 'C:\\Utilisateurs\\Alexandre' },
  { name: 'Images', type: 'Dossier de fichiers', size: '—', date: '17/11/2026 11:08', path: 'C:\\Utilisateurs\\Alexandre' },
  { name: 'Rapport_annuel_2026.pdf', type: 'Document PDF', size: '8,4 Mo', date: '15/11/2026 14:30', path: 'C:\\Utilisateurs\\Alexandre\\Documents' },
  { name: 'Présentation_projet.pptx', type: 'Présentation', size: '24,1 Mo', date: '14/11/2026 10:18', path: 'C:\\Utilisateurs\\Alexandre\\Documents' },
  { name: 'Sauvegarde_projet.zip', type: 'Archive ZIP', size: '1,28 Go', date: '12/11/2026 18:05', path: 'D:\\Sauvegardes' },
  { name: 'Vidéo_démonstration.mp4', type: 'Vidéo MP4', size: '842 Mo', date: '10/11/2026 09:20', path: 'D:\\Vidéos' },
]

export const residues = [
  { name: 'Cache utilisateur', type: 'Dossier', path: 'C:\\Utilisateurs\\Alexandre\\AppData\\Roaming\\Adobe\\Photoshop', app: 'Adobe Photoshop 2025', confidence: 'Élevée', action: 'Examiner' },
  { name: 'Préférences locales', type: 'Fichier', path: 'C:\\Utilisateurs\\Alexandre\\AppData\\Local\\Adobe\\Photoshop\\prefs.dat', app: 'Adobe Photoshop 2025', confidence: 'Probable', action: 'Examiner' },
  { name: 'Clé de configuration', type: 'Registre', path: 'HKCU\\Software\\Adobe\\Photoshop', app: 'Adobe Photoshop 2025', confidence: 'Probable', action: 'Examiner' },
  { name: 'Bibliothèque partagée', type: 'Partagé / système', path: 'C:\\Program Files\\Common Files\\Adobe', app: 'Plusieurs applications', confidence: 'Système', action: 'Conserver' },
]

export const history = [
  { date: '19 nov. 2026 · 09:42', name: 'Inventaire rapide', detail: '3 disques · 1 284 éléments', result: 'Terminé', kind: 'Inventaire' },
  { date: '18 nov. 2026 · 16:08', name: 'Surveillance installation', detail: 'Visual Studio Code · 36 changements', result: 'Rapport prêt', kind: 'Surveillance' },
  { date: '16 nov. 2026 · 11:24', name: 'Analyse du disque C:', detail: '124 806 fichiers · 312 Go', result: 'Terminé', kind: 'Analyse' },
  { date: '12 nov. 2026 · 15:51', name: 'Désinstallation avancée', detail: 'Ancienne version de VLC · 8 résidus', result: 'Rapport prêt', kind: 'Désinstallation' },
]
