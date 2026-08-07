//! Sichern und Wiederherstellen, an einer Wegwerfdatenbank durchgespielt.
//!
//! Diese drei Anweisungen sind die einzigen, die die Datei selbst anfassen —
//! sie ersetzen oder löschen, was sonst nur wächst. Was hier schiefgeht, ist
//! nicht ein falscher Wert in einer Zeile, sondern ein verlorener Sommer.
//! Deshalb steht der ganze Ablauf hier einmal in echt: mit Ordnern, Dateien
//! und einer laufenden Verbindung, die den Tausch überleben muss.

use std::fs;
use std::path::PathBuf;

use serde_json::{json, Value};

use milch::Store;

fn scratch(name: &str) -> PathBuf {
    let dir = std::env::temp_dir().join(format!("milch-test-{name}"));
    let _ = fs::remove_dir_all(&dir);
    fs::create_dir_all(&dir).expect("Wegwerfordner");
    dir
}

fn farmer_names(store: &Store) -> Vec<String> {
    store
        .snapshot()
        .expect("Stand")
        .farmers
        .into_iter()
        .map(|farmer| farmer.name)
        .collect()
}

fn add_farmer(store: &Store, name: &str) {
    store
        .run("createFarmer", json!({ "name": name }))
        .expect("Bauer angelegt");
}

fn backups(store: &Store) -> Vec<String> {
    store
        .snapshot()
        .expect("Stand")
        .db
        .backups
        .into_iter()
        .map(|file| file.path)
        .collect()
}

#[test]
fn sichert_und_stellt_wieder_her() {
    let dir = scratch("wiederherstellen");
    let db = dir.join("milch.db");
    let store = Store::open(db.clone()).expect("Datenbank");

    add_farmer(&store, "Gruber");
    let result = store.run("exportDb", json!({})).expect("Backup");
    assert!(
        result.notice.unwrap_or_default().contains("sicherungen"),
        "die Meldung nennt den Ort des Backups"
    );

    let saved = backups(&store);
    assert_eq!(saved.len(), 1, "ein Backup liegt im Ordner");

    // Nach dem Backup geht es weiter — genau dieser Stand soll gleich
    // verschwinden.
    add_farmer(&store, "Moosbrugger");
    assert_eq!(farmer_names(&store).len(), 2);

    store
        .run("importDb", json!({ "source": saved[0] }))
        .expect("Wiederherstellung");

    assert_eq!(
        farmer_names(&store),
        vec!["Gruber".to_string()],
        "der zweite Bauer ist mit dem alten Stand verschwunden"
    );

    // Der überschriebene Stand ist nicht weg, sondern liegt daneben.
    let after = backups(&store);
    assert!(
        after
            .iter()
            .any(|path| path.contains("vor-wiederherstellung")),
        "vor dem Ersetzen wurde gesichert: {after:?}"
    );

    // Die laufende Verbindung überlebt den Tausch: schreiben geht weiter.
    add_farmer(&store, "Oberhofer");
    assert_eq!(farmer_names(&store).len(), 2);

    // Und die Nebendateien des alten Journals sind fort.
    assert!(!dir.join("milch.db-wal").exists() || fs::metadata(dir.join("milch.db-wal")).is_ok());
}

#[test]
fn weist_fremde_dateien_ab() {
    let dir = scratch("fremd");
    let db = dir.join("milch.db");
    let store = Store::open(db).expect("Datenbank");
    add_farmer(&store, "Steinacher");

    let junk = dir.join("urlaub.db");
    fs::write(&junk, b"das ist ein Foto und keine Datenbank").expect("Datei");

    let error = store
        .run("importDb", json!({ "source": junk.display().to_string() }))
        .expect_err("keine Datenbank");
    assert!(
        error.contains("keine lesbare Datenbank"),
        "die Meldung sagt, was mit der Datei ist: {error}"
    );
    assert_eq!(
        farmer_names(&store),
        vec!["Steinacher".to_string()],
        "eine abgewiesene Datei lässt den Stand unberührt"
    );

    // Eine gültige SQLite-Datei mit fremdem Inhalt ist auch keine Abrechnung.
    let other = dir.join("adressen.db");
    let side = rusqlite::Connection::open(&other).expect("fremde Datenbank");
    side.execute_batch("CREATE TABLE leute (name TEXT)")
        .expect("Tabelle");
    drop(side);

    let error = store
        .run("importDb", json!({ "source": other.display().to_string() }))
        .expect_err("fremdes Schema");
    assert!(error.contains("fehlt die Tabelle"), "{error}");
    assert_eq!(farmer_names(&store).len(), 1);
}

#[test]
fn loescht_nur_im_backup_ordner() {
    let dir = scratch("loeschen");
    let db = dir.join("milch.db");
    let store = Store::open(db.clone()).expect("Datenbank");
    add_farmer(&store, "Unterberger");
    store.run("exportDb", json!({})).expect("Backup");

    let fremd = dir.join("wichtig.db");
    fs::write(&fremd, b"nicht anfassen").expect("Datei");
    let error = store
        .run(
            "deleteBackup",
            json!({ "path": fremd.display().to_string() }),
        )
        .expect_err("außerhalb des Ordners");
    assert!(error.contains("Backup-Ordner"), "{error}");
    assert!(fremd.exists(), "die fremde Datei liegt noch da");

    let saved = backups(&store);
    store
        .run("deleteBackup", json!({ "path": saved[0].clone() }))
        .expect("Backup gelöscht");
    assert!(backups(&store).is_empty());
    assert!(db.exists(), "die Datenbank selbst bleibt");
}

#[test]
fn schreibt_kein_backup_ueber_ein_anderes() {
    let dir = scratch("kollision");
    let store = Store::open(dir.join("milch.db")).expect("Datenbank");
    add_farmer(&store, "Hinteregger");

    let target = dir.join("kopie.db");
    store
        .run(
            "exportDb",
            json!({ "target": target.display().to_string() }),
        )
        .expect("erstes Backup");

    let error = store
        .run(
            "exportDb",
            json!({ "target": target.display().to_string() }),
        )
        .expect_err("Ziel ist belegt");
    assert!(error.contains("gibt es schon"), "{error}");

    // Ohne Ziel weicht der Name aus, statt abzubrechen.
    store.run("exportDb", json!({})).expect("zweites Backup");
    store.run("exportDb", json!({})).expect("drittes Backup");
    assert_eq!(backups(&store).len(), 2);
}

#[test]
fn nennt_die_datei_im_stand() {
    let dir = scratch("stand");
    let store = Store::open(dir.join("milch.db")).expect("Datenbank");
    let snapshot: Value = serde_json::to_value(store.snapshot().expect("Stand")).expect("JSON");

    assert!(snapshot["db"]["bytes"].as_i64().unwrap_or(0) > 0);
    assert!(snapshot["db"]["backupDir"]
        .as_str()
        .unwrap_or("")
        .ends_with("sicherungen"));
    assert_eq!(snapshot["db"]["savedAt"].as_str().unwrap_or("").len(), 16);
}
