//! Das fertige Programm: Oberfläche und Datenschicht in einem Prozess.
//!
//! Hier steht nur, was das Programm zusammensetzt. Gerechnet wird in der
//! Oberfläche, gespeichert in `lib.rs` — diese Datei kennt beide und sonst
//! nichts.
//!
//! Auf Windows fährt das Programm ohne Konsolenfenster hoch. Der Aufsatz gilt
//! nur dort und nur außerhalb der Entwicklung, damit `cargo run` seine
//! Ausgaben weiter zeigt.
#![cfg_attr(
    not(debug_assertions),
    cfg_attr(windows, windows_subsystem = "windows")
)]

mod net;

use serde_json::Value;
use tauri::Manager;

use milch::model::CommandResult;
use milch::{db, Store};

use net::{Hosting, Sharing};

/// Der einzige Weg von der Oberfläche in die Datenschicht.
///
/// Ein Name, eine Nutzlast, der vollständige Stand zurück — dieselbe Form wie
/// beim Entwickeln über `bin/serve.rs`, nur ohne Umweg über einen Port. Ein
/// Fehler kommt als Text an; die Oberfläche zeigt ihn, wie er hier entsteht.
#[tauri::command]
fn run(
    store: tauri::State<'_, Store>,
    name: String,
    payload: Value,
) -> Result<CommandResult, String> {
    store.run(&name, payload)
}

/// Die Freigabe im Heimnetz ein- und ausschalten oder nachsehen, wie sie steht.
///
/// Steht neben `run` und nicht darin: hier geht es nicht um die Daten, sondern
/// um einen Dienst, und der Stand der Saison ändert sich dabei nicht.
#[tauri::command]
fn host(
    app: tauri::AppHandle,
    sharing: tauri::State<'_, Sharing>,
    action: String,
) -> Result<Hosting, String> {
    match action.as_str() {
        "status" => sharing.status(),
        "start" => sharing.start(&app),
        "stop" => sharing.stop(),
        other => Err(format!("Unbekannte Anweisung an die Freigabe: {other}")),
    }
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        // Die Aktualisierung fragt beim Start bei GitHub nach und spielt auf
        // Wunsch ein; `process` liefert nur den Neustart danach. Beide reden
        // ausschließlich mit der Oberfläche — hier ist nichts anzumelden
        // außer den Plugins selbst.
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .setup(|app| {
            /*
              Wo die Datenbank liegt, entscheidet das Betriebssystem und nicht
              das Programm: `app_data_dir` ist der Ort, den ein Rechner für die
              Daten eines Programms vorsieht — auf dem Mac unter
              `~/Library/Application Support`, auf Windows unter `AppData`. Nur
              `MILCH_DB` sticht ihn, und das braucht, wer zwei Bestände
              nebeneinander führt oder einen Testlauf machen will.
            */
            let store = Store::open(db::resolve_path(app.path().app_data_dir().ok()))?;
            app.manage(store);
            // Ausgeschaltet, und zwar bei jedem Start wieder: eine Freigabe,
            // die sich merkt, dass sie an war, wäre eine offene Tür, an die
            // niemand mehr denkt.
            app.manage(Sharing::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![run, host])
        .run(tauri::generate_context!())
        .expect("Das Programm lässt sich nicht starten");
}
