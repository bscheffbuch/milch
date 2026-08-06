//! Sichern und Wiederherstellen der einen Datei.
//!
//! Alles steht in einer SQLite-Datei, und genau das macht das Sichern einfach:
//! eine Kopie genügt. Gezogen wird sie aber nicht mit dem Dateiwerkzeug,
//! sondern von SQLite selbst — `VACUUM INTO` schreibt einen in sich
//! geschlossenen Stand, auch wenn im Journal gerade noch Änderungen stehen.
//! Eine nebenher kopierte Datei wäre ohne ihre `-wal`-Datei unvollständig, und
//! zwar ohne dass man es ihr ansieht.
//!
//! Eine Sicherung überschreibt nie etwas: eine Sicherung, die eine ältere
//! Sicherung zerstört, ist keine.

use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

use rusqlite::{Connection, OpenFlags};

use crate::model::{BackupFile, DbFile};

/// Sicherungen ohne eigenes Ziel landen in diesem Ordner neben der Datenbank.
const FOLDER: &str = "sicherungen";

/// So viele Sicherungen zeigt die Übersicht; ältere liegen weiter im Ordner.
const LISTED: usize = 40;

/// Die Namen, unter denen das Programm von selbst sichert.
///
/// Von Hand angelegte Sicherungen (`milch-…`) und die eine vor einer
/// Wiederherstellung (`vor-wiederherstellung-…`) stehen bewusst nicht dabei:
/// wer selbst sichert, will die Datei behalten, und die vor einer
/// Wiederherstellung ist der einzige Weg zurück.
pub const AUTO: &[&str] = &["vor-messung", "vor-loeschen"];

/// So viele selbsttätige Sicherungen bleiben liegen. Beim Eintragen einer
/// Messung entsteht eine je Messung — zehn reichen über einen Alpsommer
/// zurück, ohne dass der Ordner zuwächst.
pub const AUTO_KEEP: usize = 10;

/// Der Schlüssel in `meta`, unter dem der Schalter steht.
pub const AUTO_KEY: &str = "auto_backup";

/// Tabellen, ohne die eine Datei keine Alpabrechnung ist. Die Prüfung ist grob
/// mit Absicht — sie soll das versehentlich gewählte Urlaubsfoto abfangen,
/// nicht eine fremde Fassung des Schemas aussperren.
const REQUIRED: &[&str] = &[
    "seasons",
    "farmers",
    "cows",
    "measurement_rounds",
    "measurement_values",
    "treatments",
];

/// Der Sicherungsordner zu einer Datenbank.
pub fn folder(db_path: &str) -> PathBuf {
    let parent = Path::new(db_path).parent().unwrap_or(Path::new(""));
    if parent.as_os_str().is_empty() {
        PathBuf::from(FOLDER)
    } else {
        parent.join(FOLDER)
    }
}

/// Zeitstempel in Ortszeit, ohne Kalenderbibliothek: SQLite kann das, und es
/// liegt ohnehin schon offen.
pub fn stamp(conn: &Connection) -> String {
    conn.query_row(
        "SELECT strftime('%Y-%m-%d-%H%M', 'now', 'localtime')",
        [],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_else(|_| "ohne-datum".to_string())
}

/// Was die Einstellungen über die Datei anzeigen: ihre Größe, ihr Alter und
/// die Sicherungen, die daneben liegen.
pub fn describe(conn: &Connection, db_path: &str) -> DbFile {
    let dir = folder(db_path);
    DbFile {
        bytes: size_of(Path::new(db_path)),
        saved_at: modified_at(conn, Path::new(db_path)),
        backup_dir: dir.display().to_string(),
        backups: list(conn, &dir),
        auto: auto_enabled(conn),
        auto_keep: AUTO_KEEP as i64,
    }
}

/// Ob von selbst gesichert wird. Ohne Eintrag: ja — wer nichts eingestellt
/// hat, will eher eine Sicherung zuviel als eine zuwenig.
pub fn auto_enabled(conn: &Connection) -> bool {
    conn.query_row("SELECT value FROM meta WHERE key = ?1", [AUTO_KEY], |row| {
        row.get::<_, String>(0)
    })
    .map(|value| value != "0")
    .unwrap_or(true)
}

/// Legt die überzähligen selbsttätigen Sicherungen ab, älteste zuerst.
///
/// Gezählt wird über alle selbsttätigen Namen zusammen: der Ordner soll
/// überschaubar bleiben, und ob eine Kopie vor einer Messung oder vor einem
/// Löschen entstand, ändert daran nichts.
pub fn sweep(dir: &Path) {
    let Ok(entries) = fs::read_dir(dir) else {
        return;
    };

    let mut found: Vec<(i64, PathBuf)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("db") {
            continue;
        }
        let name = entry.file_name().to_string_lossy().to_string();
        if !AUTO
            .iter()
            .any(|prefix| name.starts_with(&format!("{prefix}-")))
        {
            continue;
        }
        let age = entry
            .metadata()
            .and_then(|meta| meta.modified())
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|since| since.as_secs() as i64)
            .unwrap_or(0);
        found.push((age, path));
    }

    if found.len() <= AUTO_KEEP {
        return;
    }
    // Neueste zuerst; alles hinter der zehnten Stelle fällt weg.
    found.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.cmp(&b.1)));
    for (_, path) in found.into_iter().skip(AUTO_KEEP) {
        let _ = fs::remove_file(path);
    }
}

/// Zeigt eine Datei im Dateiverwalter des Betriebssystems.
///
/// Der Pfad wird nie an eine Kommandozeile weitergereicht, sondern als
/// einzelnes Argument übergeben — sonst entschiede ein Ordnername mit
/// Anführungszeichen darüber, was ausgeführt wird.
pub fn reveal(path: &Path) -> Result<(), String> {
    if !path.exists() {
        return Err(format!("{} gibt es nicht mehr.", path.display()));
    }

    let started = if cfg!(target_os = "macos") {
        std::process::Command::new("open")
            .arg("-R")
            .arg(path)
            .spawn()
    } else if cfg!(target_os = "windows") {
        // Der Explorer will Auswahl und Pfad in einem Wort: `/select,C:\…`.
        let mut arg = std::ffi::OsString::from("/select,");
        arg.push(path.as_os_str());
        std::process::Command::new("explorer").arg(arg).spawn()
    } else {
        // Anderswo gibt es kein Anwählen, nur ein Öffnen des Ordners.
        let dir = path.parent().unwrap_or(path);
        std::process::Command::new("xdg-open").arg(dir).spawn()
    };

    started
        .map(|_| ())
        .map_err(|error| format!("Der Ordner ließ sich nicht öffnen: {error}"))
}

/// Schreibt einen geschlossenen Stand an einen neuen Ort.
///
/// Ohne Ziel entsteht ein Name aus dem Zeitpunkt im Sicherungsordner; ein
/// angegebenes Ziel wird nie überschrieben, ein selbst vergebener Name weicht
/// einem schon belegten aus.
pub fn export(
    conn: &Connection,
    db_path: &str,
    target: Option<&str>,
    prefix: &str,
) -> Result<PathBuf, String> {
    let path = match target.map(str::trim).filter(|raw| !raw.is_empty()) {
        Some(raw) => {
            let chosen = PathBuf::from(raw);
            if chosen.exists() {
                return Err(format!(
                    "{} gibt es schon — bitte einen anderen Namen wählen.",
                    chosen.display()
                ));
            }
            chosen
        }
        None => free_name(&folder(db_path), prefix, &stamp(conn))?,
    };

    if let Some(dir) = path.parent() {
        if !dir.as_os_str().is_empty() {
            fs::create_dir_all(dir).map_err(|error| {
                format!("Ordner {} lässt sich nicht anlegen: {error}", dir.display())
            })?;
        }
    }

    conn.execute("VACUUM INTO ?1", [path.to_string_lossy().as_ref()])
        .map_err(|error| {
            format!(
                "Die Sicherung nach {} ist fehlgeschlagen: {error}",
                path.display()
            )
        })?;
    Ok(path)
}

/// Prüft eine Datei, bevor irgendetwas ersetzt wird.
///
/// Geöffnet wird nur lesend — eine Datei, die man wiederherstellen will, darf
/// von der Prüfung nicht angefasst werden.
pub fn inspect(source: &Path) -> Result<(), String> {
    if !source.is_file() {
        return Err(format!("{} ist keine Datei.", source.display()));
    }

    let conn =
        Connection::open_with_flags(source, OpenFlags::SQLITE_OPEN_READ_ONLY).map_err(|error| {
            format!(
                "{} lässt sich nicht als Datenbank öffnen: {error}",
                source.display()
            )
        })?;

    // SQLite sieht der Datei beim Öffnen noch nichts an; erst wer sie liest,
    // merkt, dass gar keine Datenbank darin steht.
    let check: String = conn
        .query_row("PRAGMA integrity_check", [], |row| row.get(0))
        .map_err(|error| format!("{} ist keine lesbare Datenbank: {error}", source.display()))?;
    if check != "ok" {
        return Err(format!("Die Datei ist beschädigt: {check}"));
    }

    for table in REQUIRED {
        let found: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type = 'table' AND name = ?1",
                [table],
                |row| row.get(0),
            )
            .unwrap_or(0);
        if found == 0 {
            return Err(format!(
                "In {} fehlt die Tabelle {table} — das ist keine Alpabrechnung.",
                source.display()
            ));
        }
    }
    Ok(())
}

/// Löscht eine Sicherung. Nur im Sicherungsordner und nur `.db` — von hier aus
/// lässt sich nichts anderes im Dateisystem entfernen.
pub fn remove(db_path: &str, target: &str) -> Result<String, String> {
    let path = PathBuf::from(target.trim());
    let dir = folder(db_path);
    let inside = match (path.parent(), fs::canonicalize(&dir)) {
        (Some(parent), Ok(canonical)) => fs::canonicalize(parent)
            .map(|parent| parent == canonical)
            .unwrap_or(false),
        _ => false,
    };
    if !inside || path.extension().and_then(|ext| ext.to_str()) != Some("db") {
        return Err(format!(
            "{} liegt nicht im Sicherungsordner — von hier aus wird nichts anderes gelöscht.",
            path.display()
        ));
    }

    fs::remove_file(&path)
        .map_err(|error| format!("{} lässt sich nicht löschen: {error}", path.display()))?;
    Ok(path
        .file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_default())
}

/// Legt die Datei neben der Datenbank ab, bevor getauscht wird. Bricht das
/// Kopieren ab, steht die alte Datei unversehrt da.
pub fn stage(source: &Path, db_path: &Path) -> Result<PathBuf, String> {
    let staged = db_path.with_extension("wiederherstellung");
    let _ = fs::remove_file(&staged);
    fs::copy(source, &staged).map_err(|error| {
        format!(
            "{} lässt sich nicht nach {} kopieren: {error}",
            source.display(),
            staged.display()
        )
    })?;
    Ok(staged)
}

/// Die Nebendateien des Journals. Nach dem Tausch gehören sie zu einer
/// Datenbank, die es nicht mehr gibt — bliebe eine stehen, läse SQLite sie als
/// Fortsetzung der neuen.
pub fn drop_journal(db_path: &Path) {
    for suffix in ["-wal", "-shm"] {
        let mut name = db_path.as_os_str().to_os_string();
        name.push(suffix);
        let _ = fs::remove_file(PathBuf::from(name));
    }
}

/// Zwei Angaben auf dieselbe Datei? Verglichen wird aufgelöst, sonst gälten
/// `data/milch.db` und `./data/milch.db` als verschieden.
pub fn same_file(a: &Path, b: &Path) -> bool {
    match (fs::canonicalize(a), fs::canonicalize(b)) {
        (Ok(a), Ok(b)) => a == b,
        _ => a == b,
    }
}

fn free_name(dir: &Path, prefix: &str, stamp: &str) -> Result<PathBuf, String> {
    let first = dir.join(format!("{prefix}-{stamp}.db"));
    if !first.exists() {
        return Ok(first);
    }
    // Zwei Sicherungen in derselben Minute sind selten, aber der Zeitstempel
    // reicht dann eben nicht mehr aus.
    for nth in 2..100 {
        let next = dir.join(format!("{prefix}-{stamp}-{nth}.db"));
        if !next.exists() {
            return Ok(next);
        }
    }
    Err(format!(
        "Im Ordner {} liegen schon zu viele Sicherungen dieser Minute.",
        dir.display()
    ))
}

fn size_of(path: &Path) -> i64 {
    fs::metadata(path)
        .map(|meta| meta.len() as i64)
        .unwrap_or(0)
}

fn modified_at(conn: &Connection, path: &Path) -> String {
    let seconds = fs::metadata(path)
        .and_then(|meta| meta.modified())
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .map(|since| since.as_secs() as i64);

    let Some(seconds) = seconds else {
        return String::new();
    };
    conn.query_row(
        "SELECT strftime('%Y-%m-%d %H:%M', ?1, 'unixepoch', 'localtime')",
        [seconds],
        |row| row.get::<_, String>(0),
    )
    .unwrap_or_default()
}

fn list(conn: &Connection, dir: &Path) -> Vec<BackupFile> {
    let Ok(entries) = fs::read_dir(dir) else {
        return Vec::new();
    };

    let mut found: Vec<(i64, BackupFile)> = Vec::new();
    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|ext| ext.to_str()) != Some("db") {
            continue;
        }
        let Ok(meta) = entry.metadata() else { continue };
        if !meta.is_file() {
            continue;
        }
        let age = meta
            .modified()
            .ok()
            .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
            .map(|since| since.as_secs() as i64)
            .unwrap_or(0);

        found.push((
            age,
            BackupFile {
                name: entry.file_name().to_string_lossy().to_string(),
                path: path.display().to_string(),
                bytes: meta.len() as i64,
                saved_at: modified_at(conn, &path),
            },
        ));
    }

    found.sort_by(|a, b| b.0.cmp(&a.0).then_with(|| a.1.name.cmp(&b.1.name)));
    found.truncate(LISTED);
    found.into_iter().map(|(_, file)| file).collect()
}
