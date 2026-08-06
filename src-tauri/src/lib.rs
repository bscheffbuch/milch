//! Die Datenschicht der Alpabrechnung.
//!
//! Alles, was die Datenbank berührt, steht hier. Die Oberfläche kennt genau
//! zwei Dinge: sie fragt nach dem Stand, und sie schickt benannte Anweisungen.
//! Beide Wege enden in [`Store::run`] — im fertigen Programm über Tauris IPC,
//! während der Entwicklung über den kleinen HTTP-Dienst in `bin/serve.rs`.

pub mod backup;
pub mod db;
pub mod model;
pub mod read;
pub mod write;

use std::collections::HashSet;
use std::path::{Path, PathBuf};
use std::sync::Mutex;

use rusqlite::Connection;
use serde_json::Value;

use model::{CommandResult, Snapshot};

pub struct Store {
    conn: Mutex<Connection>,
    path: String,
    /// Messungen, für die in diesem Lauf schon von selbst gesichert wurde.
    ///
    /// Das Meßblatt speichert beim Tippen, und die Tastatureingabe speichert je
    /// Kuh — eine Sicherung je Speichervorgang wären hundert Dateien für einen
    /// Abend. Gesichert wird deshalb beim ersten Zugriff auf eine Messung, und
    /// zwar der Stand davor; die weiteren Änderungen derselben Messung stehen
    /// dann in derselben Sitzung.
    secured: Mutex<HashSet<i64>>,
}

impl Store {
    pub fn open(path: PathBuf) -> Result<Self, String> {
        let conn = db::open(&path).map_err(|error| {
            format!(
                "Datenbank {} lässt sich nicht öffnen: {error}",
                path.display()
            )
        })?;
        Ok(Store {
            conn: Mutex::new(conn),
            path: path.display().to_string(),
            secured: Mutex::new(HashSet::new()),
        })
    }

    pub fn path(&self) -> &str {
        &self.path
    }

    pub fn snapshot(&self) -> Result<Snapshot, String> {
        let conn = self.lock()?;
        read::snapshot(&conn, &self.path).map_err(|error| error.to_string())
    }

    /// Führt eine Anweisung aus und gibt den Stand danach zurück.
    ///
    /// Der frische Stand kommt immer mit: nach jeder Änderung stimmt die
    /// gesamte Auswertung nicht mehr, und ein zweiter Weg, das zu bemerken,
    /// wäre nur eine weitere Stelle zum Vergessen. `"snapshot"` ist die
    /// Anweisung, die nichts ändert.
    ///
    /// Drei Anweisungen fassen die Datei an und nicht ihren Inhalt. Sie stehen
    /// deshalb hier und nicht in `write` — dort gibt es nur die Verbindung, sie
    /// aber brauchen den Pfad und beim Ersetzen die Verbindung als Ganzes.
    pub fn run(&self, name: &str, payload: Value) -> Result<CommandResult, String> {
        let mut inserted_id = None;
        let mut notice = None;

        match name {
            "snapshot" => {}
            "exportDb" => notice = Some(self.export_db(&payload)?),
            "importDb" => notice = Some(self.import_db(&payload)?),
            "deleteBackup" => notice = Some(self.delete_backup(&payload)?),
            "revealPath" => self.reveal_path(&payload)?,
            "setAutoBackup" => notice = Some(self.set_auto_backup(&payload)?),
            _ => {
                notice = self.secure(name, &payload);
                let conn = self.lock()?;
                inserted_id = write::dispatch(&conn, name, payload)?;
            }
        }

        let conn = self.lock()?;
        let snapshot = read::snapshot(&conn, &self.path).map_err(|error| error.to_string())?;
        Ok(CommandResult {
            snapshot,
            inserted_id,
            notice,
        })
    }

    fn export_db(&self, payload: &Value) -> Result<String, String> {
        let target = payload.get("target").and_then(Value::as_str);
        let conn = self.lock()?;
        let written = backup::export(&conn, &self.path, target, "milch")?;
        Ok(format!("Sicherung geschrieben: {}", written.display()))
    }

    /// Ersetzt die laufende Datenbank durch eine geprüfte Datei.
    ///
    /// Die Reihenfolge ist die ganze Vorsicht: erst prüfen, dann den alten
    /// Stand sichern, dann die neue Datei danebenlegen — und erst zuletzt, in
    /// einem einzigen Umbenennen, tauschen. Jeder Abbruch davor lässt alles so,
    /// wie es war.
    fn import_db(&self, payload: &Value) -> Result<String, String> {
        let raw = payload
            .get("source")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim()
            .to_string();
        if raw.is_empty() {
            return Err("Es ist keine Datei angegeben.".to_string());
        }

        let source = PathBuf::from(&raw);
        let current = PathBuf::from(&self.path);
        if backup::same_file(&source, &current) {
            return Err("Das ist die Datei, die gerade in Gebrauch ist.".to_string());
        }
        backup::inspect(&source)?;

        let mut conn = self.lock()?;

        let safety =
            backup::export(&conn, &self.path, None, "vor-wiederherstellung").map_err(|error| {
                format!("Es ließ sich nichts sichern, also wurde nichts ersetzt: {error}")
            })?;

        let staged = backup::stage(&source, &current)?;

        // Die Verbindung muss die Datei loslassen, bevor sie ersetzt wird. Ein
        // leerer Platzhalter im Speicher tut das, ohne das Schloss zu öffnen —
        // die Zuweisung verwirft die alte Verbindung und schreibt dabei das
        // Journal zurück.
        *conn = Connection::open_in_memory()
            .map_err(|error| format!("Der Platzhalter lässt sich nicht anlegen: {error}"))?;

        let swapped = std::fs::rename(&staged, &current).map_err(|error| {
            let _ = std::fs::remove_file(&staged);
            format!("Der Tausch ist fehlgeschlagen, der alte Stand steht noch: {error}")
        });
        if swapped.is_ok() {
            backup::drop_journal(&current);
        }

        // Ob getauscht wurde oder nicht — am Ende muss wieder eine offene
        // Datenbank dastehen, sonst antwortet das Programm auf gar nichts mehr.
        *conn = db::open(&current)
            .map_err(|error| format!("Die Datenbank lässt sich nicht mehr öffnen: {error}"))?;
        swapped?;

        Ok(format!(
            "{} wiederhergestellt. Der vorherige Stand liegt als {}.",
            file_name(&source),
            file_name(&safety)
        ))
    }

    /// Sichert von selbst, bevor eine größere Änderung geschrieben wird.
    ///
    /// Zwei Fälle sind gemeint. Das Eintragen einer Messung ist der eine — dort
    /// entstehen an einem Abend hundert Speichervorgänge, gesichert wird aber
    /// nur vor dem ersten je Messung (siehe [`Store::secured`]). Der andere
    /// sind die wenigen Anweisungen, die etwas fortnehmen; die sind selten
    /// genug, dass jede eine eigene Kopie bekommen kann.
    ///
    /// Schlägt das Sichern fehl, wird trotzdem geschrieben: der vorhandene
    /// Stand nimmt dadurch keinen Schaden, und ein Programm, das den Eintrag
    /// verweigert, weil die Platte voll ist, hilft im Melkstand niemandem. Es
    /// sagt aber, was es nicht konnte.
    fn secure(&self, name: &str, payload: &Value) -> Option<String> {
        let conn = self.lock().ok()?;
        if !backup::auto_enabled(&conn) {
            return None;
        }

        let prefix = match name {
            "saveRoundValues" => {
                let round = payload.get("roundId").and_then(Value::as_i64)?;
                if !self.secured.lock().ok()?.insert(round) {
                    return None;
                }
                "vor-messung"
            }
            "deleteRound" | "deleteSeason" | "reset" => "vor-loeschen",
            _ => return None,
        };

        match backup::export(&conn, &self.path, None, prefix) {
            Ok(_) => {
                drop(conn);
                backup::sweep(&backup::folder(&self.path));
                None
            }
            Err(error) => Some(format!("Vorher sichern ging nicht: {error}")),
        }
    }

    /// Öffnet den Ordner einer Datei und wählt sie an.
    ///
    /// Erlaubt sind nur die Datenbank selbst, ihr Sicherungsordner und was
    /// darin liegt. Die Oberfläche schickt hier zwar nur Pfade her, die sie
    /// selbst aus dem Stand hat — aber ein Befehl, der jeden Ordner des
    /// Rechners öffnet, ist eine Tür, die niemand braucht.
    fn reveal_path(&self, payload: &Value) -> Result<(), String> {
        let raw = payload
            .get("path")
            .and_then(Value::as_str)
            .unwrap_or("")
            .trim();
        if raw.is_empty() {
            return Err("Es ist kein Pfad angegeben.".to_string());
        }

        let target = PathBuf::from(raw);
        let db = PathBuf::from(&self.path);
        let dir = backup::folder(&self.path);
        let allowed = backup::same_file(&target, &db)
            || backup::same_file(&target, &dir)
            || target
                .parent()
                .map(|parent| backup::same_file(parent, &dir))
                .unwrap_or(false);
        if !allowed {
            return Err(format!(
                "{} gehört nicht zur Datenbank — von hier aus wird nichts anderes geöffnet.",
                target.display()
            ));
        }

        backup::reveal(&target)
    }

    fn set_auto_backup(&self, payload: &Value) -> Result<String, String> {
        let on = payload.get("on").and_then(Value::as_bool).unwrap_or(true);
        let conn = self.lock()?;
        conn.execute(
            "INSERT INTO meta(key, value) VALUES(?1, ?2)
             ON CONFLICT(key) DO UPDATE SET value = excluded.value",
            rusqlite::params![backup::AUTO_KEY, if on { "1" } else { "0" }],
        )
        .map_err(|error| format!("Der Schalter ließ sich nicht ablegen: {error}"))?;
        Ok(if on {
            "Vor größeren Änderungen wird jetzt von selbst gesichert.".to_string()
        } else {
            "Es wird nicht mehr von selbst gesichert.".to_string()
        })
    }

    fn delete_backup(&self, payload: &Value) -> Result<String, String> {
        let target = payload.get("path").and_then(Value::as_str).unwrap_or("");
        let removed = backup::remove(&self.path, target)?;
        Ok(format!("Sicherung {removed} gelöscht."))
    }

    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Connection>, String> {
        self.conn
            .lock()
            .map_err(|_| "Datenbankzugriff ist zusammengebrochen".to_string())
    }
}

fn file_name(path: &Path) -> String {
    path.file_name()
        .map(|name| name.to_string_lossy().to_string())
        .unwrap_or_else(|| path.display().to_string())
}
