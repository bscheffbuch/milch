# Milch — Alpabrechnung

Milchmenge, Messungen, Behandlungen und die Käseabrechnung einer Alpsaison.
Ein Programm für den eigenen Rechner: kein Konto, kein Server, keine Cloud.
Alles steht in **einer** Datei, und ein Backup heißt, diese Datei zu kopieren.

## Installieren

Die fertigen Pakete liegen bei den
[Releases](https://github.com/bscheffbuch/milch/releases). Zu laden ist genau
eine Datei:

|                       |                              |
| --------------------- | ---------------------------- |
| Mac mit Apple Silicon | `Milch_<Version>_aarch64.dmg`  |
| Mac mit Intel         | `Milch_<Version>_x64.dmg`      |
| Windows               | `Milch_<Version>_x64-setup.exe` |
| Linux                 | `Milch_<Version>_amd64.AppImage` |

Daneben liegen für Windows ein `.msi` und für Linux ein `.deb` und ein `.rpm`,
falls jemand sie lieber über den Paketmanager installiert. Die Dateien mit der
Endung `.sig`, die `.app.tar.gz` und die `latest.json` gehören zum
Update-Mechanismus und müssen nicht heruntergeladen werden.

Wer schon eine ältere Version hat, lädt gar nichts: das Programm meldet sich
beim Start von selbst und installiert die neue auf Wunsch.

### Beim ersten Start

Die Pakete sind nicht bei Apple beziehungsweise Microsoft signiert — das kostet
Geld und beantwortet eine Frage, die hier niemand hat. Beide Systeme warnen
deshalb **einmal**, beim ersten Öffnen:

- **macOS** meldet, das Programm sei „beschädigt“. Das stimmt nicht, es fehlt
  nur die Signatur. Meldung wegklicken, dann Systemeinstellungen → Datenschutz
  & Sicherheit → ganz nach unten scrollen → „Dennoch öffnen“.
- **Windows** zeigt „Der Computer wurde durch Windows geschützt“. Über „Weitere
  Informationen“ erscheint „Trotzdem ausführen“.
- **Linux** fragt nicht.

## Aufbau

Zwei Hälften, eine Naht:

|                  |                                                                                                                                                                          |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Oberfläche**   | Next.js, statisch gebaut (`output: "export"`). Hier wird auch gerechnet — der Rechenkern in `lib/calc/` bekommt die ganze Saison und gibt die fertige Auswertung zurück. |
| **Datenschicht** | Rust mit SQLite, in `src-tauri/`. Sie liest und schreibt, mehr nicht.                                                                                                    |

Dazwischen liegt genau ein Aufruf: ein Name, eine Nutzlast, der vollständige
Stand zurück. Er endet immer in `Store::run` — im fertigen Programm über Tauris
IPC, beim Entwickeln über einen kleinen HTTP-Dienst auf `127.0.0.1:8787`, weil
ein gewöhnlicher Browser kein IPC hat. Es gibt keine zweite Datenschicht in
JavaScript, die auseinanderlaufen könnte.

## Entwickeln

Im Programmfenster — so, wie es die Alp später auch benutzt:

```bash
npm run app
```

Im Browser, mit den Entwicklerwerkzeugen. Dann braucht es zwei Fenster, weil
die Datenschicht getrennt läuft:

```bash
npm run data
```

```bash
npm run dev
```

Prüfen:

```bash
npm test
```

```bash
npm run typecheck
```

Dazu die Tests der Datenschicht — `cargo test` in `src-tauri/`.

Gegenrechnen, ohne das Fenster zu öffnen: `npm run check` rechnet die aktive
Saison durch und schreibt die Kennzahlen ins Terminal. Es fragt die
Datenschicht über denselben Port wie die Oberfläche, `npm run data` muss also
laufen. Mit einem Datum als Argument gilt dieses als Stichtag.

## Bauen

```bash
npm run app:build
```

Baut die Oberfläche nach `out/`, übersetzt die Datenschicht und packt beides
zusammen. Auf dem Mac entstehen `Milch.app` und ein DMG unter
`src-tauri/target/release/bundle/`.

Die Windows-Fassung entsteht ebenfalls auf dem Mac:

```bash
npm run app:build:win
```

Daraus wird `milch.exe` und daneben `Milch_<Version>_x64-setup.exe`, beides
unter `src-tauri/target/x86_64-pc-windows-msvc/release/`. Einmalig einzurichten
sind dafür `rustup target add x86_64-pc-windows-msvc`,
`cargo install cargo-xwin` und `brew install makensis`; fehlt NSIS, entsteht nur
die Programmdatei. Um die drei Fallstricke dieses Baus kümmert sich
`scripts/build-windows.ts` — dort steht auch, welche es sind. Signiert wird
nicht: Windows zeigt beim ersten Start eine Warnung. Auf dem Zielrechner setzt
das Programm WebView2 voraus, das unter Windows 11 und aktuellem Windows 10
mitgeliefert wird.

Für Linux gilt weiterhin: denselben Befehl (`npm run app:build`) auf einem
Linux-Rechner ausführen. Der Quelltext ist für alle drei derselbe.

## Veröffentlichen und aktualisieren

Eine neue Version entsteht nicht von Hand, sondern an einem Tag:

```bash
npm version patch
```

```bash
git push --follow-tags
```

Der Tag baut auf GitHub alle vier Pakete — macOS auf Apple Silicon, macOS auf
Intel, Linux und Windows — und legt sie als Release-Entwurf ab. Wird der Entwurf
veröffentlicht, findet ihn jede installierte Kopie beim nächsten Start von
selbst und bietet unten links an, ihn einzuspielen. Ist alles aktuell, erscheint
nichts.

Wie das im einzelnen zusammenhängt — die beiden verschiedenen Signaturen, warum
macOS und Windows beim ersten Start trotzdem warnen, und was passiert, wenn der
Schlüssel verlorengeht — steht in [`docs/updates.md`](docs/updates.md).

## Im Heimnetz freigeben

Gemolken wird im Stall, gerechnet am Rechner — dazwischen liegt der Weg zurück
in die Hütte. Deshalb kann das Programm dieselbe Oberfläche im Heimnetz
ausliefern: in den Einstellungen unter **Freigabe** einschalten, den QR-Code mit
dem Telefon abfilmen, und die Messwerte lassen sich am Melkstand eintragen.

Was dabei geschieht, steht auch in der Oberfläche:

- Ein kleiner Dienst horcht auf Port **8788** und liefert genau zwei Dinge aus:
  die gebaute Oberfläche — dieselben Dateien, die auch im Programmfenster
  stehen — und `POST /call`, denselben einen Aufruf. Es gibt keinen zweiten
  Datenbestand; das Telefon schreibt in die Datei auf dem Rechner.
- Die Freigabe ist **aus**, bis jemand sie einschaltet, sie endet mit dem
  Programm, und sie merkt sich nichts. Solange sie läuft, hat **jeder im selben
  Netz** vollen Zugriff — ein Kennwort gibt es nicht.
- Die Adresse wird nicht geraten, sondern beim Betriebssystem erfragt (welche
  Netzwerkkarte trüge den Weg nach draußen). Sie steht als QR-Code daneben,
  damit niemand vier Zahlen abtippen muss.

Die Oberfläche ist bis zur Telefonbreite durchgezeichnet: die Navigation steht
fort und kommt über den drei Strichen in der linken oberen Ecke ganz nach vorn,
die Werkzeugleiste am Rand wird zum Blatt von unten, und „Hinzufügen“ schwebt
über der Tabelle rechts unten, wo der Daumen liegt.

## Wo die Daten liegen

Den Ort bestimmt das Betriebssystem, nicht das Programm:

|                 |                                                       |
| --------------- | ----------------------------------------------------- |
| macOS           | `~/Library/Application Support/de.alp.milch/milch.db` |
| Windows         | `%APPDATA%\de.alp.milch\milch.db`                     |
| Linux           | `~/.local/share/de.alp.milch/milch.db`                |
| beim Entwickeln | `data/milch.db` im Projektordner                      |

Der Ordner gehört nicht zum Programm, sondern steht daneben: Eine neue Version
darüberzuinstallieren rührt ihn nicht an, und auch der Windows-Installer löscht
beim Aktualisieren nichts — er tut das nur, wenn man das Programm von Hand
entfernt _und_ dabei „Anwendungsdaten löschen“ anhakt. Woran der Ordner hängt,
ist die Kennung `de.alp.milch`; wer sie ändert, lässt den bisherigen Bestand
unter dem alten Namen zurück. Eine Prüfung hält sie deshalb fest.

Die Einstellungen zeigen den vollständigen Pfad an. Wer zwei Bestände
nebeneinander führen will — einen echten und einen zum Ausprobieren —, setzt
`MILCH_DB` auf eine andere Datei; das sticht alles andere.

Backups legt das Programm daneben ab und überschreibt dabei nie ein
älteres. Beim Wiederherstellen wird die neue Datei zuerst geprüft und der
bisherige Stand gesichert: Ist die Datei keine Alpabrechnung oder ist sie
beschädigt, bleibt alles stehen, wie es ist.
