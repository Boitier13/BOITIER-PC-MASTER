//! Emplacement prévu des appels Windows (aucun code actif en phase 1).
//!
//! Plan des modules, dans l'ordre de développement :
//!
//! - `volumes`   : `GetLogicalDrives`, `GetDiskFreeSpaceExW`, type de média,
//!                 système de fichiers, point de montage (phase 2) ;
//! - `walk`      : énumération des fichiers (`FindFirstFileExW`), gestion des
//!                 accès refusés, des jonctions et des points d'analyse ;
//!                 option MFT/USN pour les volumes de plusieurs millions de
//!                 fichiers (phase 3) ;
//! - `registry`  : `RegEnumKeyExW` sur les deux vues (64 et 32 bits),
//!                 inventaire des applications installées (phase 5) ;
//! - `msi`       : `MsiEnumProductsW`, `MsiGetProductInfoW` (phase 5) ;
//! - `process`   : lancement du désinstalleur officiel, suivi du code de
//!                 retour, sans élévation implicite (phase 5) ;
//! - `services`  : services et tâches planifiées (phase 6) ;
//! - `elevation` : détection des droits courants et, plus tard, helper élevé
//!                 à la demande pour les seules opérations qui l'exigent
//!                 (phase 7).
//!
//! Règles de sécurité qui s'appliqueront à tous ces modules :
//!  1. jamais de suppression directe : quarantaine réversible uniquement ;
//!  2. jamais d'exécution d'une ligne de commande issue du registre sans
//!     validation, affichage et confirmation ;
//!  3. refus des chemins protégés et des liens symboliques lors des parcours ;
//!  4. toute opération journalisée (audit) avant et après exécution.
