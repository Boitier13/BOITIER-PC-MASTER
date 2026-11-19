-- BOITIER PC MASTER — schéma initial (version 1)
--
-- Ce fichier est EMBARQUÉ dans le binaire (include_str!) mais N'EST PAS EXÉCUTÉ
-- en phase 1 : aucune base n'est créée tant que la couche d'accès (rusqlite)
-- n'est pas en place. Objectif : figer le modèle de données avant de coder.
--
-- Conventions :
--   * toutes les tailles sont en OCTETS (INTEGER), jamais en chaînes localisées ;
--   * toutes les dates sont en ISO 8601 UTC (TEXT) ;
--   * aucune donnée personnelle n'est collectée en dehors des chemins inventoriés.

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS schema_version (
    version    INTEGER NOT NULL,
    applied_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Réglages persistants de l'application (thème, confirmations, rétention…).
CREATE TABLE IF NOT EXISTS settings (
    key        TEXT PRIMARY KEY,
    value      TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Inventaires datés : un instantané = un état complet à une date donnée.
CREATE TABLE IF NOT EXISTS snapshots (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at  TEXT    NOT NULL,
    scope       TEXT    NOT NULL,              -- ex. « tous les volumes », « C:\Users »
    entry_count INTEGER NOT NULL DEFAULT 0,
    status      TEXT    NOT NULL DEFAULT 'pending', -- pending | running | complete | failed
    note        TEXT
);

-- Volumes observés lors d'un instantané.
CREATE TABLE IF NOT EXISTS volumes (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    letter      TEXT    NOT NULL,
    label       TEXT,
    kind        TEXT,                          -- SSD NVMe, SSD SATA, HDD, amovible…
    filesystem  TEXT,
    total_bytes INTEGER NOT NULL DEFAULT 0,
    free_bytes  INTEGER NOT NULL DEFAULT 0,
    UNIQUE (snapshot_id, letter)
);

-- Entrées de fichiers : une ligne par élément et par instantané.
CREATE TABLE IF NOT EXISTS entries (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    parent_id   INTEGER REFERENCES entries(id) ON DELETE CASCADE,
    path        TEXT    NOT NULL,
    name        TEXT    NOT NULL,
    extension   TEXT,
    is_directory INTEGER NOT NULL DEFAULT 0,
    size_bytes  INTEGER NOT NULL DEFAULT 0,
    modified_at TEXT,
    attributes  INTEGER,
    UNIQUE (snapshot_id, path)
);

CREATE INDEX IF NOT EXISTS idx_entries_snapshot_size ON entries (snapshot_id, size_bytes DESC);
CREATE INDEX IF NOT EXISTS idx_entries_snapshot_name ON entries (snapshot_id, name);
CREATE INDEX IF NOT EXISTS idx_entries_parent        ON entries (parent_id);

-- Applications réellement installées (registre 64/32 bits, MSI, MSIX/Store).
CREATE TABLE IF NOT EXISTS installed_apps (
    id                INTEGER PRIMARY KEY AUTOINCREMENT,
    snapshot_id       INTEGER NOT NULL REFERENCES snapshots(id) ON DELETE CASCADE,
    display_name      TEXT    NOT NULL,
    publisher         TEXT,
    version           TEXT,
    install_date      TEXT,
    install_location  TEXT,
    uninstall_command TEXT,
    quiet_uninstall_command TEXT,
    product_code      TEXT,                    -- GUID MSI si disponible
    installer_type    TEXT,                    -- MSI | NSIS | Inno | MSIX | autre
    source            TEXT    NOT NULL,        -- registry64 | registry32 | msix | store
    estimated_bytes   INTEGER,
    is_system         INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_apps_snapshot_name ON installed_apps (snapshot_id, display_name);

-- Résidus détectés pour une application, avec un score explicable.
CREATE TABLE IF NOT EXISTS residues (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    app_id        INTEGER NOT NULL REFERENCES installed_apps(id) ON DELETE CASCADE,
    kind          TEXT    NOT NULL,            -- file | folder | registry | service | task | shortcut
    path          TEXT    NOT NULL,
    size_bytes    INTEGER,
    confidence    TEXT    NOT NULL,            -- high | medium | low | system
    classification TEXT   NOT NULL,            -- personal | shared | system
    score         INTEGER NOT NULL DEFAULT 0,
    reasons       TEXT,                        -- justification lisible (JSON ou texte)
    proposed_action TEXT,                      -- examine | keep | quarantine
    created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_residues_app ON residues (app_id, confidence);

-- Journal d'audit : toute action entreprise, avec possibilité de restauration.
CREATE TABLE IF NOT EXISTS audit_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    occurred_at  TEXT    NOT NULL DEFAULT (datetime('now')),
    action       TEXT    NOT NULL,             -- scan | uninstall | quarantine | restore | export
    target       TEXT,
    result       TEXT    NOT NULL,             -- ok | refused | partial | error
    detail       TEXT,
    reversible   INTEGER NOT NULL DEFAULT 0
);

-- Quarantaine : sauvegarde préalable obligatoire à tout nettoyage.
CREATE TABLE IF NOT EXISTS quarantine (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    audit_log_id INTEGER REFERENCES audit_log(id) ON DELETE SET NULL,
    original_path TEXT   NOT NULL,
    stored_path   TEXT   NOT NULL,
    kind          TEXT    NOT NULL,            -- file | folder | registry
    size_bytes    INTEGER,
    checksum      TEXT,
    created_at    TEXT    NOT NULL DEFAULT (datetime('now')),
    restored_at   TEXT
);

-- Le runner de migrations insérera la ligne de version après exécution :
-- INSERT INTO schema_version (version) VALUES (1);
