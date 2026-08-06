//! Die Datenschicht als kleiner HTTP-Dienst — nur für die Entwicklung.
//!
//! Im fertigen Programm laufen Oberfläche und Datenschicht im selben Prozess
//! und reden über Tauris IPC. Beim Entwickeln liegt die Oberfläche aber auf
//! `next dev` und damit in einem gewöhnlichen Browser, der kein IPC hat.
//! Statt für diesen Fall eine zweite Datenschicht in JavaScript zu pflegen —
//! zwei Wahrheiten, die auseinanderlaufen, sobald man wegsieht — hört dieselbe
//! Rust-Schicht hier zusätzlich auf einem Port.

use std::sync::Arc;

use serde_json::{json, Value};
use tiny_http::{Header, Method, Response, Server};

use milch::{db, Store};

const ADDR: &str = "127.0.0.1:8787";

fn main() {
    let path = db::resolve_path(None);
    let store = match Store::open(path) {
        Ok(store) => Arc::new(store),
        Err(error) => {
            eprintln!("{error}");
            std::process::exit(1);
        }
    };

    let addr = std::env::var("MILCH_ADDR").unwrap_or_else(|_| ADDR.to_string());
    let server = match Server::http(&addr) {
        Ok(server) => server,
        Err(error) => {
            eprintln!("Port {addr} lässt sich nicht öffnen: {error}");
            std::process::exit(1);
        }
    };
    eprintln!(
        "Datenschicht auf http://{addr} — Datenbank {}",
        store.path()
    );

    for mut request in server.incoming_requests() {
        // Die Oberfläche liegt beim Entwickeln auf einem anderen Port, also
        // fragt der Browser vorher um Erlaubnis.
        if request.method() == &Method::Options {
            let _ = request.respond(cors(Response::empty(204)));
            continue;
        }

        if request.method() != &Method::Post || request.url() != "/call" {
            let _ = request.respond(cors(
                Response::from_string("nur POST /call").with_status_code(404),
            ));
            continue;
        }

        let mut body = String::new();
        if request.as_reader().read_to_string(&mut body).is_err() {
            let _ = request.respond(cors(json_response(&fail("Anfrage nicht lesbar"), 400)));
            continue;
        }

        let answer = match serde_json::from_str::<Value>(&body) {
            Err(error) => fail(&format!("Anfrage ist kein JSON: {error}")),
            Ok(value) => {
                let name = value.get("name").and_then(Value::as_str).unwrap_or("");
                let payload = value.get("payload").cloned().unwrap_or(json!({}));
                match store.run(name, payload) {
                    Ok(result) => json!({ "ok": true, "data": result }),
                    Err(error) => fail(&error),
                }
            }
        };

        let status = if answer["ok"] == json!(true) {
            200
        } else {
            400
        };
        let _ = request.respond(cors(json_response(&answer, status)));
    }
}

fn fail(message: &str) -> Value {
    json!({ "ok": false, "error": message })
}

fn json_response(value: &Value, status: u16) -> Response<std::io::Cursor<Vec<u8>>> {
    Response::from_string(value.to_string())
        .with_status_code(status)
        .with_header(header("Content-Type", "application/json; charset=utf-8"))
}

fn cors<R: std::io::Read>(response: Response<R>) -> Response<R> {
    response
        .with_header(header("Access-Control-Allow-Origin", "*"))
        .with_header(header("Access-Control-Allow-Headers", "Content-Type"))
        .with_header(header("Access-Control-Allow-Methods", "POST, OPTIONS"))
}

fn header(name: &str, value: &str) -> Header {
    Header::from_bytes(name.as_bytes(), value.as_bytes()).expect("Kopfzeile ist gültig")
}
