//! Freigabe im Heimnetz: dieselbe Oberfläche auf dem Telefon.
//!
//! Das Programm liegt auf dem Rechner in der Hütte, das Telefon hat man in der
//! Hand — und der Weg dazwischen soll keine Cloud sein. Solange die Freigabe
//! läuft, hört ein kleiner Dienst auf allen Netzwerkkarten und liefert genau
//! zwei Dinge aus: die gebaute Oberfläche (dieselben Dateien, die auch im
//! Programmfenster stehen, hier über Tauris `AssetResolver`) und `POST /call`,
//! also denselben einen Aufruf, der auch im Fenster in [`Store::run`] endet.
//! Es gibt damit keine zweite Datenschicht und keinen zweiten Datenbestand.
//!
//! Zwei Dinge sind bewusst so und nicht anders:
//!
//!   * Die Freigabe ist **aus**, bis jemand sie einschaltet, und sie endet mit
//!     dem Programm. Wer sie einschaltet, öffnet den vollen Zugriff für jeden
//!     im selben Netz — es gibt kein Kennwort. Das steht so auch in der
//!     Oberfläche.
//!   * Die Adresse wird nicht geraten. Sie kommt aus der Wegewahl des
//!     Betriebssystems (siehe [`lan_address`]) und steht als QR-Code daneben,
//!     damit niemand vier Zahlen abtippen muss.

use std::net::{Ipv4Addr, UdpSocket};
use std::sync::{Arc, Mutex};
use std::thread;

use qrcode::{Color, QrCode};
use serde::Serialize;
use serde_json::{json, Value};
use tauri::{AppHandle, Manager, Runtime};
use tiny_http::{Header, Method, Request, Response, Server};

use milch::Store;

/// Nicht 8787 — auf dem Port liegt beim Entwickeln schon die Datenschicht.
const PORT: u16 = 8788;

/// Was die Oberfläche über die Freigabe wissen muss.
#[derive(Serialize, Clone, Debug)]
#[serde(rename_all = "camelCase")]
pub struct Hosting {
    pub active: bool,
    pub port: u16,
    /// Die Adresse zum Eintippen, sobald die Freigabe läuft.
    pub url: Option<String>,
    /// Der QR-Code als Feld aus Wahrheitswerten, zeilenweise, ohne Rand —
    /// gezeichnet wird er in der Oberfläche. Ein Bild hierher zu schicken hieße,
    /// es zweimal zu haben: als Kästchen und als Pixel.
    pub qr: Option<Vec<Vec<bool>>>,
    /// Steht nur da, wenn etwas im Weg war.
    pub trouble: Option<String>,
}

impl Hosting {
    fn off() -> Self {
        Hosting {
            active: false,
            port: PORT,
            url: None,
            qr: None,
            trouble: None,
        }
    }
}

/// Der laufende Dienst, solange es einen gibt.
struct Live {
    server: Arc<Server>,
    url: String,
    qr: Vec<Vec<bool>>,
}

/// Der Zustand der Freigabe, von Tauri verwaltet.
#[derive(Default)]
pub struct Sharing(Mutex<Option<Live>>);

impl Sharing {
    fn lock(&self) -> Result<std::sync::MutexGuard<'_, Option<Live>>, String> {
        self.0
            .lock()
            .map_err(|_| "Die Freigabe ist zusammengebrochen".to_string())
    }

    pub fn status(&self) -> Result<Hosting, String> {
        let live = self.lock()?;
        Ok(match live.as_ref() {
            None => Hosting::off(),
            Some(live) => Hosting {
                active: true,
                port: PORT,
                url: Some(live.url.clone()),
                qr: Some(live.qr.clone()),
                trouble: None,
            },
        })
    }

    /// Schaltet die Freigabe ein. Läuft sie schon, bleibt es dabei.
    pub fn start<R: Runtime>(&self, app: &AppHandle<R>) -> Result<Hosting, String> {
        {
            let live = self.lock()?;
            if live.is_some() {
                drop(live);
                return self.status();
            }
        }

        let address = lan_address()?;
        let url = format!("http://{address}:{PORT}/");
        let qr = qr_matrix(&url)?;

        let server = Server::http(("0.0.0.0", PORT)).map_err(|error| {
            format!("Der Port {PORT} lässt sich nicht öffnen: {error}. Läuft die Freigabe schon in einem zweiten Fenster?")
        })?;
        let server = Arc::new(server);

        // Ein einziger Faden reicht: es hängt ein Telefon daran, nicht ein
        // Rechenzentrum. `unblock` beim Abschalten lässt ihn auslaufen.
        let listener = Arc::clone(&server);
        let handle = app.clone();
        thread::spawn(move || {
            for request in listener.incoming_requests() {
                serve(&handle, request);
            }
        });

        let mut live = self.lock()?;
        *live = Some(Live {
            server,
            url: url.clone(),
            qr: qr.clone(),
        });
        Ok(Hosting {
            active: true,
            port: PORT,
            url: Some(url),
            qr: Some(qr),
            trouble: None,
        })
    }

    /// Schaltet sie wieder aus. War sie schon aus, passiert nichts.
    pub fn stop(&self) -> Result<Hosting, String> {
        let mut live = self.lock()?;
        if let Some(live) = live.take() {
            live.server.unblock();
        }
        Ok(Hosting::off())
    }
}

/// Beantwortet eine Anfrage: entweder der eine Aufruf, oder eine Datei.
fn serve<R: Runtime>(app: &AppHandle<R>, mut request: Request) {
    if request.method() == &Method::Options {
        let _ = request.respond(cors(Response::empty(204)));
        return;
    }

    if request.url().starts_with("/call") {
        if request.method() != &Method::Post {
            let _ = request.respond(cors(json_response(&fail("nur POST /call"), 405)));
            return;
        }
        let mut body = String::new();
        if request.as_reader().read_to_string(&mut body).is_err() {
            let _ = request.respond(cors(json_response(&fail("Anfrage nicht lesbar"), 400)));
            return;
        }
        let answer = match serde_json::from_str::<Value>(&body) {
            Err(error) => fail(&format!("Anfrage ist kein JSON: {error}")),
            Ok(value) => {
                let name = value.get("name").and_then(Value::as_str).unwrap_or("");
                let payload = value.get("payload").cloned().unwrap_or(json!({}));
                match app.state::<Store>().run(name, payload) {
                    Ok(result) => json!({ "ok": true, "data": result }),
                    Err(error) => fail(&error),
                }
            }
        };
        let status = if answer["ok"] == json!(true) { 200 } else { 400 };
        let _ = request.respond(cors(json_response(&answer, status)));
        return;
    }

    if request.method() != &Method::Get {
        let _ = request.respond(Response::from_string("nur GET").with_status_code(405));
        return;
    }

    // Derselbe Baum, den auch das Fenster anzeigt. Um Verzeichnisse kümmert
    // sich der Resolver selbst: er versucht `<Pfad>/index.html` und zuletzt
    // `index.html` — genau das, was eine statisch gebaute Next-Oberfläche
    // braucht.
    match app.asset_resolver().get(asset_path(request.url()).to_string()) {
        Some(asset) => {
            let response = Response::from_data(asset.bytes)
                .with_header(header("Content-Type", &asset.mime_type));
            let _ = request.respond(response);
        }
        None => {
            let _ = request.respond(Response::from_string("nicht gefunden").with_status_code(404));
        }
    }
}

/// Aus der angefragten Adresse wird der Name im eingebackenen Baum: ohne den
/// führenden Schrägstrich, ohne Frage- und Rautenteil — die stehen für die
/// Oberfläche und nicht für die Datei —, und die nackte Wurzel ist die
/// Startseite.
fn asset_path(url: &str) -> &str {
    let path = url.split(['?', '#']).next().unwrap_or("/");
    let path = path.trim_start_matches('/');
    if path.is_empty() {
        "index.html"
    } else {
        path
    }
}

/// Die Adresse dieses Rechners im Heimnetz.
///
/// Die Netzwerkkarten selbst durchzugehen hieße, zwischen WLAN, Kabel,
/// Docker-Brücken und dem virtuellen Netz einer Testumgebung raten zu müssen.
/// Stattdessen wird das Betriebssystem gefragt: ein UDP-Anschluss, „verbunden"
/// mit einer Adresse draußen, verrät in `local_addr`, über welche Karte der Weg
/// dorthin ginge. Verschickt wird dabei nichts — UDP-`connect` merkt sich nur
/// das Ziel — und ins Internet muss dafür auch niemand kommen.
fn lan_address() -> Result<Ipv4Addr, String> {
    let probe = |target: &str| -> Option<Ipv4Addr> {
        let socket = UdpSocket::bind("0.0.0.0:0").ok()?;
        socket.connect(target).ok()?;
        match socket.local_addr().ok()?.ip() {
            std::net::IpAddr::V4(address) if !address.is_loopback() => Some(address),
            _ => None,
        }
    };
    // Erst über den üblichen Weg nach draußen, dann über eine Adresse aus dem
    // Heimnetz selbst — falls gar keine Verbindung nach außen besteht.
    probe("8.8.8.8:80")
        .or_else(|| probe("192.168.1.1:80"))
        .or_else(|| probe("10.0.0.1:80"))
        .ok_or_else(|| {
            "Dieser Rechner hat keine Adresse im Netz. Hängt er am WLAN oder am Kabel?".to_string()
        })
}

/// Der QR-Code als Feld: eine Zeile je Reihe, `true` ist ein dunkles Kästchen.
fn qr_matrix(url: &str) -> Result<Vec<Vec<bool>>, String> {
    let code = QrCode::new(url.as_bytes())
        .map_err(|error| format!("Der QR-Code lässt sich nicht erzeugen: {error}"))?;
    let width = code.width();
    Ok(code
        .to_colors()
        .chunks(width)
        .map(|row| row.iter().map(|module| *module == Color::Dark).collect())
        .collect())
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn die_nackte_wurzel_ist_die_startseite() {
        assert_eq!(asset_path("/"), "index.html");
        assert_eq!(asset_path(""), "index.html");
    }

    #[test]
    fn frage_und_rautenteil_gehoeren_nicht_zum_dateinamen() {
        assert_eq!(asset_path("/messung/?id=8"), "messung/");
        assert_eq!(
            asset_path("/kalender/index.html#tag-12"),
            "kalender/index.html"
        );
        assert_eq!(
            asset_path("/_next/static/chunks/main.js"),
            "_next/static/chunks/main.js"
        );
    }

    /// Ein QR-Code, den ein Telefon lesen kann, hat in drei Ecken dasselbe
    /// 7×7-Suchmuster. Steht das, stimmt auch die Ausrichtung des Feldes —
    /// wäre es zeilen- und spaltenweise vertauscht, fiele es hier auf.
    #[test]
    fn der_qr_code_ist_quadratisch_und_traegt_seine_suchmuster() {
        let matrix = qr_matrix("http://192.168.1.23:8788/").expect("QR-Code");
        let width = matrix.len();
        // Jede gültige Kantenlänge ist 21, 25, 29 … Kästchen.
        assert!(width >= 21 && width % 4 == 1, "Kantenlänge {width}");
        for row in &matrix {
            assert_eq!(row.len(), width);
        }
        for (top, left) in [(0, 0), (0, width - 7), (width - 7, 0)] {
            for zeile in 0..7 {
                for spalte in 0..7 {
                    let rand = zeile == 0 || zeile == 6 || spalte == 0 || spalte == 6;
                    let kern = (2..=4).contains(&zeile) && (2..=4).contains(&spalte);
                    assert_eq!(
                        matrix[top + zeile][left + spalte],
                        rand || kern,
                        "Suchmuster bei {top}/{left}, Kästchen {zeile}/{spalte}"
                    );
                }
            }
        }
    }

    /// Ob dieser Rechner gerade am Netz hängt, entscheidet nicht der Quelltext.
    /// Geprüft wird deshalb beides: eine brauchbare Adresse, oder der Satz, der
    /// dem Benutzer erklärt, warum es keine gibt.
    #[test]
    fn die_adresse_taugt_zum_hinschicken_oder_es_gibt_keine() {
        match lan_address() {
            Ok(address) => {
                assert!(!address.is_loopback(), "{address} zeigt auf den Rechner");
                assert!(!address.is_unspecified(), "{address} ist keine Adresse");
            }
            Err(message) => assert!(message.contains("WLAN"), "{message}"),
        }
    }
}
