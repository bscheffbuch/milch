//! Datenbank: Öffnen, Schema, Voreinstellungen.
//!
//! Zeitangaben stehen überall als ISO-Datum 'YYYY-MM-DD' plus Tageszeit
//! ('AM' = morgens, 'PM' = abends). Umgerechnet auf die Gemelk-Achse wird erst
//! im Rechenkern der Oberfläche, nie hier und nie in SQL.

use std::fs;
use std::path::{Path, PathBuf};

use rusqlite::Connection;

pub const SCHEMA_VERSION: i64 = 3;

/// Die beiden PRAGMA-Zeilen stehen bewusst nicht hier, sondern in [`open`] —
/// `journal_mode` liefert eine Ergebniszeile zurück und würde einen Stapellauf
/// abbrechen.
pub const SCHEMA_SQL: &str = r#"
CREATE TABLE IF NOT EXISTS meta (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS seasons (
  id                      INTEGER PRIMARY KEY,
  name                    TEXT    NOT NULL,
  start_date              TEXT    NOT NULL,
  end_date                TEXT    NOT NULL,
  is_active               INTEGER NOT NULL DEFAULT 0,
  deduction_percent       REAL    NOT NULL DEFAULT 0,
  deduction_fixed_per_day REAL    NOT NULL DEFAULT 0,
  created_at              TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS farmers (
  id       INTEGER PRIMARY KEY,
  name     TEXT    NOT NULL,
  contact  TEXT,
  note     TEXT,
  archived INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS cows (
  id          INTEGER PRIMARY KEY,
  farmer_id   INTEGER NOT NULL REFERENCES farmers(id) ON DELETE CASCADE,
  bell_number TEXT    NOT NULL,
  name        TEXT    NOT NULL,
  note        TEXT,
  archived    INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_cows_farmer ON cows(farmer_id);

-- Teilnahme einer Kuh an einer Saison. farmer_id wird hier mitgeführt, damit
-- eine spätere Besitzeränderung alte Abrechnungen nicht rückwirkend verändert.
CREATE TABLE IF NOT EXISTS cow_seasons (
  id             INTEGER PRIMARY KEY,
  season_id      INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  cow_id         INTEGER NOT NULL REFERENCES cows(id)    ON DELETE CASCADE,
  farmer_id      INTEGER NOT NULL REFERENCES farmers(id),
  arrival_date   TEXT    NOT NULL,
  arrival_slot   TEXT    NOT NULL DEFAULT 'AM',
  departure_date TEXT,
  departure_slot TEXT,
  dry_off_date   TEXT,
  dry_off_slot   TEXT,
  note           TEXT,
  UNIQUE(season_id, cow_id)
);

-- Eine Messung umfasst zwei aufeinanderfolgende Gemelke. first_slot='AM'
-- bedeutet morgens+abends desselben Tages, first_slot='PM' bedeutet abends und
-- am Folgetag morgens.
CREATE TABLE IF NOT EXISTS measurement_rounds (
  id         INTEGER PRIMARY KEY,
  season_id  INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  first_date TEXT    NOT NULL,
  first_slot TEXT    NOT NULL DEFAULT 'AM',
  note       TEXT,
  created_at TEXT    NOT NULL DEFAULT (datetime('now')),
  UNIQUE(season_id, first_date, first_slot)
);

-- Milchmengen stehen in Litern, Käse in Kilogramm. Deshalb heißen die Spalten
-- hier `_l` und in `cheese_production`/`pickups` schlicht `kg`.
CREATE TABLE IF NOT EXISTS measurement_values (
  id       INTEGER PRIMARY KEY,
  round_id INTEGER NOT NULL REFERENCES measurement_rounds(id) ON DELETE CASCADE,
  cow_id   INTEGER NOT NULL REFERENCES cows(id)               ON DELETE CASCADE,
  first_l  REAL,
  second_l REAL,
  UNIQUE(round_id, cow_id)
);

-- Voreinstellungen für die häufigsten Behandlungen. Die Sperrfrist wird intern
-- immer in Gemelken geführt (3 Tage = 6 Gemelke).
CREATE TABLE IF NOT EXISTS treatment_types (
  id                       INTEGER PRIMARY KEY,
  name                     TEXT    NOT NULL UNIQUE,
  default_withhold_gemelke INTEGER NOT NULL,
  note                     TEXT,
  archived                 INTEGER NOT NULL DEFAULT 0
);

-- end_date/end_slot dürfen fehlen: eine Behandlung, deren Ende noch nicht
-- feststeht, läuft weiter. Sie sperrt dann bis auf Weiteres — was fehlt, ist
-- nicht der Tag, sondern die Entscheidung, und die trägt man später nach.
CREATE TABLE IF NOT EXISTS treatments (
  id               INTEGER PRIMARY KEY,
  season_id        INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  cow_id           INTEGER NOT NULL REFERENCES cows(id)    ON DELETE CASCADE,
  type_id          INTEGER REFERENCES treatment_types(id)  ON DELETE SET NULL,
  label            TEXT    NOT NULL,
  start_date       TEXT    NOT NULL,
  start_slot       TEXT    NOT NULL,
  end_date         TEXT,
  end_slot         TEXT,
  withhold_gemelke INTEGER NOT NULL,
  note             TEXT
);
CREATE INDEX IF NOT EXISTS idx_treatments_season ON treatments(season_id, cow_id);

CREATE TABLE IF NOT EXISTS cheese_production (
  id        INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
  date      TEXT    NOT NULL,
  kg        REAL    NOT NULL,
  note      TEXT,
  UNIQUE(season_id, date)
);

CREATE TABLE IF NOT EXISTS pickups (
  id        INTEGER PRIMARY KEY,
  season_id INTEGER NOT NULL REFERENCES seasons(id)  ON DELETE CASCADE,
  farmer_id INTEGER NOT NULL REFERENCES farmers(id)  ON DELETE CASCADE,
  date      TEXT    NOT NULL,
  kg        REAL    NOT NULL,
  wheels    INTEGER,
  note      TEXT
);
CREATE INDEX IF NOT EXISTS idx_pickups_season ON pickups(season_id, farmer_id);
"#;

/// Voreinstellungen, die eine frische Datenbank mitbringt, damit die
/// Behandlungserfassung nicht bei null anfängt. Sperrfristen in Gemelken —
/// 6 Gemelke sind 3 Tage. Alle Werte sind in den Einstellungen änderbar und
/// werden nach dem Löschen nicht wieder angelegt.
const DEFAULT_TREATMENT_TYPES: &[(&str, i64, &str)] = &[
    (
        "Eutertube (Mastitis)",
        6,
        "Übliche Wartezeit 3 Tage — am Präparat prüfen",
    ),
    (
        "Antibiotikum, Injektion",
        10,
        "Übliche Wartezeit 5 Tage — am Präparat prüfen",
    ),
    ("Entzündungshemmer", 4, "Übliche Wartezeit 2 Tage"),
    ("Biestmilch nach Kalbung", 10, "Nicht verkäsbar"),
    (
        "Klauenbehandlung",
        0,
        "Ohne Wartezeit — Milch bleibt verwertbar",
    ),
];

/// Wo die Datenbank liegt. `MILCH_DB` sticht alles — damit laufen Seed- und
/// Prüfskripte auf einer Wegwerfdatei, ohne die echte anzufassen.
pub fn resolve_path(app_dir: Option<PathBuf>) -> PathBuf {
    if let Some(from_env) = std::env::var_os("MILCH_DB") {
        return PathBuf::from(from_env);
    }
    match app_dir {
        Some(dir) => dir.join("milch.db"),
        None => PathBuf::from("data").join("milch.db"),
    }
}

pub fn open(path: &Path) -> rusqlite::Result<Connection> {
    if let Some(dir) = path.parent() {
        let _ = fs::create_dir_all(dir);
    }

    let conn = Connection::open(path)?;
    // WAL antwortet mit dem gesetzten Modus; die Zeile muss abgeholt werden.
    conn.query_row("PRAGMA journal_mode = WAL", [], |_| Ok(()))?;
    conn.pragma_update(None, "foreign_keys", true)?;
    conn.execute_batch(SCHEMA_SQL)?;
    migrate(&conn)?;

    conn.execute(
        "INSERT INTO meta(key, value) VALUES('schema_version', ?1)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value",
        [SCHEMA_VERSION.to_string()],
    )?;
    seed_defaults(&conn)?;

    Ok(conn)
}

/// Nachträgliche Änderungen am Schema. `CREATE TABLE IF NOT EXISTS` rührt eine
/// bestehende Tabelle nicht an — was sich an einer schon angelegten Datenbank
/// ändern soll, muss deshalb hier stehen.
///
/// Fassung 2: Milch wird in Litern geführt, nicht in Kilogramm. Umgerechnet
/// wird nichts — die Zahlen waren immer schon die abgelesenen Litermengen, nur
/// die Spalten waren falsch beschriftet.
///
/// Fassung 3: Das Ende einer Behandlung darf offen bleiben. SQLite kann eine
/// Spalte nicht von `NOT NULL` befreien — die Tabelle wird deshalb neben der
/// alten neu gebaut und der Inhalt hinübergeschrieben.
fn migrate(conn: &Connection) -> rusqlite::Result<()> {
    let has_old: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('measurement_values') WHERE name = 'first_kg'",
        [],
        |row| row.get(0),
    )?;
    if has_old > 0 {
        conn.execute_batch(
            "ALTER TABLE measurement_values RENAME COLUMN first_kg  TO first_l;
             ALTER TABLE measurement_values RENAME COLUMN second_kg TO second_l;",
        )?;
    }

    let end_required: i64 = conn.query_row(
        "SELECT COUNT(*) FROM pragma_table_info('treatments')
         WHERE name = 'end_date' AND \"notnull\" = 1",
        [],
        |row| row.get(0),
    )?;
    if end_required > 0 {
        // Der Index hängt am alten Namen mit und stünde dem neuen im Weg.
        conn.execute_batch(
            r#"
            PRAGMA foreign_keys = off;
            BEGIN;
            DROP INDEX IF EXISTS idx_treatments_season;
            ALTER TABLE treatments RENAME TO treatments_v2;
            CREATE TABLE treatments (
              id               INTEGER PRIMARY KEY,
              season_id        INTEGER NOT NULL REFERENCES seasons(id) ON DELETE CASCADE,
              cow_id           INTEGER NOT NULL REFERENCES cows(id)    ON DELETE CASCADE,
              type_id          INTEGER REFERENCES treatment_types(id)  ON DELETE SET NULL,
              label            TEXT    NOT NULL,
              start_date       TEXT    NOT NULL,
              start_slot       TEXT    NOT NULL,
              end_date         TEXT,
              end_slot         TEXT,
              withhold_gemelke INTEGER NOT NULL,
              note             TEXT
            );
            INSERT INTO treatments
              SELECT id, season_id, cow_id, type_id, label, start_date, start_slot,
                     end_date, end_slot, withhold_gemelke, note
              FROM treatments_v2;
            DROP TABLE treatments_v2;
            CREATE INDEX IF NOT EXISTS idx_treatments_season ON treatments(season_id, cow_id);
            COMMIT;
            PRAGMA foreign_keys = on;
            "#,
        )?;
    }
    Ok(())
}

fn seed_defaults(conn: &Connection) -> rusqlite::Result<()> {
    let seeded: i64 = conn.query_row(
        "SELECT COUNT(*) FROM meta WHERE key = 'seeded_treatment_types'",
        [],
        |row| row.get(0),
    )?;
    if seeded > 0 {
        return Ok(());
    }

    for (name, gemelke, note) in DEFAULT_TREATMENT_TYPES {
        conn.execute(
            "INSERT OR IGNORE INTO treatment_types (name, default_withhold_gemelke, note)
             VALUES (?1, ?2, ?3)",
            rusqlite::params![name, gemelke, note],
        )?;
    }
    conn.execute(
        "INSERT INTO meta(key, value) VALUES('seeded_treatment_types', '1')",
        [],
    )?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Der Ort der Datenbank hängt an der Kennung des Programms: `app_data_dir`
    /// hängt sie an den Ordner des Betriebssystems an. Wer sie ändert, legt den
    /// bisherigen Bestand still — er läge dann unter dem alten Namen und das
    /// Programm suchte unter dem neuen. Ein neues Bündel darüberzuinstallieren
    /// oder auf eine neue Fassung zu heben rührt den Ordner dagegen nicht an;
    /// nur ein von Hand angehaktes „Anwendungsdaten löschen“ beim Entfernen tut
    /// das. Diese Zeile hält die Kennung fest.
    #[test]
    fn die_kennung_traegt_den_bestand_und_bleibt() {
        let conf = include_str!("../tauri.conf.json");
        assert!(
            conf.contains("\"identifier\": \"de.alp.milch\""),
            "Die Kennung in tauri.conf.json ist nicht mehr `de.alp.milch` — \
             damit wandert der Datenordner und der bisherige Bestand ist fort."
        );
    }

    /// Ohne Ordner vom Betriebssystem — beim Entwickeln — liegt sie im Projekt.
    #[test]
    fn ohne_ordner_liegt_sie_im_projekt() {
        let _guard = std::env::var_os("MILCH_DB");
        if _guard.is_some() {
            return;
        }
        assert_eq!(resolve_path(None), PathBuf::from("data").join("milch.db"));
        assert_eq!(
            resolve_path(Some(PathBuf::from("/tmp/x"))),
            PathBuf::from("/tmp/x/milch.db")
        );
    }
}
