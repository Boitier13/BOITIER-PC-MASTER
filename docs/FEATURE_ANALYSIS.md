# Mesure d'espace — contrat et limites

**Version** : 0.1.0 · **Commande** : `analysis_scan` · **Module** :
`src-tauri/src/fs_engine/analysis.rs` · **Écrans** : tableau de bord, analyse de
l'espace, historique.

---

## 1. Principe

L'interface n'affiche un nombre de fichiers, une répartition par catégorie ou un
classement qu'après une mesure **réellement exécutée** sur une racine que
l'utilisateur a désignée. Aucune mesure n'est lancée automatiquement, ni à
l'ouverture de l'application, ni à l'arrivée sur un écran.

Tant qu'aucune mesure n'existe dans la session, les emplacements concernés
affichent un état vide explicite (« Aucune mesure dans cette session »), jamais
un exemple.

## 2. Contrat IPC

```
analysis_scan(scan_id: string, request: AnalysisRequest) -> AnalysisReport
walk_cancel(scan_id: string)     // arrête une mesure comme un parcours
```

`AnalysisRequest`

| Champ | Défaut | Borne |
|---|---|---|
| `root` | — (obligatoire) | chaîne vide refusée (`invalid_argument`) |
| `maxEntries` | 200 000 | 1 000 à 1 000 000 |
| `maxDepth` | 32 | 1 à 64 |

`AnalysisReport`

| Champ | Sens |
|---|---|
| `root`, `scannedAtMs`, `elapsedMs` | racine réellement parcourue, horodatage et durée |
| `files`, `folders` | entrées rencontrées, filtres compris |
| `totalSizeBytes` | somme des tailles des fichiers rencontrés |
| `visited` | entrées visitées (dont celles ignorées par les filtres) |
| `denied` | entrées refusées par le système de fichiers |
| `skippedProtected` | dossiers protégés dont le contenu n'a pas été parcouru |
| `truncated` | plafond d'entrées atteint : totaux **partiels** |
| `cancelled` | mesure interrompue par l'utilisateur |
| `byCategory` | fichiers et octets par catégorie du moteur |
| `topFolders` | 10 dossiers, par contenu **direct** mesuré |
| `largestFiles` | 20 plus gros fichiers mesurés |

## 3. Sémantique des agrégats

- Un dossier ne s'attribue **pas** la taille de ses sous-dossiers : le
  classement porte sur le contenu direct, ce qui évite les doubles comptages et
  les totaux impossibles à vérifier.
- Les fichiers cachés et système sont comptés : les exclure sous-estimerait
  l'espace occupé.
- Les liens symboliques ne sont jamais suivis ; ils sont comptés comme une
  entrée rencontrée, sans que leur cible soit attribuée.
- Un dossier protégé par la politique de sécurité est compté
  (`skippedProtected`) mais son contenu n'est pas lu.
- Une seule boucle de parcours : `walk()` (exploration) et `analysis_scan` (mesure)
  partagent `fs_engine::walker::traverse`. Les règles de sécurité ne peuvent donc
  pas diverger entre les deux.

## 4. Couverture affichée

Chaque rapport est accompagné de sa couverture, à côté des totaux :

```
214 312 entrées visitées · 1 842 refusées par Windows · 37 dossiers protégés non parcourus
Mesure partielle — plafond d'entrées atteint
mesuré 412 Go sur 512 Go utilisés — l'écart correspond aux fichiers système, protégés ou hors périmètre
```

L'écart avec l'espace utilisé Windows n'est calculé que si la racine correspond à
un volume connu. Il n'est jamais présenté comme une erreur : c'est la
conséquence normale des dossiers non parcourus.

## 5. États d'écran

| État | Ce qui est affiché |
|---|---|
| Aucune mesure | état vide + invitation à mesurer |
| En cours | entrées visitées, dossier courant, bouton **Annuler** |
| Terminée | totaux, catégories, classements, couverture |
| Partielle / annulée | mêmes blocs, mention explicite et compteurs concernés |
| Erreur | message du moteur (`ServiceError.userMessage`), **aucun chiffre** |
| Démonstration | « mesure indisponible en démonstration », bouton inerte |

## 6. Journal de session

`src/store/measurements.tsx` conserve en mémoire les mesures réellement
exécutées (horodatage, racine, fichiers, octets, résultat). L'historique et le
tableau de bord s'en servent. Le journal n'est **pas** persisté : il disparaît à
la fermeture, et l'interface le dit.

## 7. Sécurité

- Aucune écriture, aucun `std::process`, aucune suppression : les contrôles de
  `scripts/check-foundation.mjs` vérifient les modules d'analyse (tests exclus).
- Aucune élévation de privilèges ; les dossiers protégés restent non parcourus.
- Aucune commande générique : `analysis_scan` prend un chemin et des bornes, pas
  une opération.
- La mesure est annulable, bornée et sans état résiduel
  (`AppState::finish_scan` retire le jeton).

## 8. Limites assumées

1. **Aucune persistance** : les rapports ne survivent pas à la fermeture
   (base locale, lot D).
2. **Comparaison volume/utilisation indicative** : le total mesuré n'égale
   jamais l'espace utilisé Windows, par construction.
3. **Doublons** : non détectés (lot C5).
4. **Résidus, surveillance** : non disponibles (lots C2 et C4).
5. **Coût** : un parcours de volume complet peut durer plusieurs minutes ; il
   reste borné, progressif et annulable.
