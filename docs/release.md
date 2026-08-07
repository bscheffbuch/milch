Die erste Version von Milch — dem Programm für die Abrechnung einer Alpsaison.

Es führt die Bauern und ihre Kühe, nimmt die Gemelke zweimal am Tag auf, hält
Behandlungen mit ihren Wartezeiten fest und rechnet den Käse Tag für Tag nach
dem Milchanteil auf die Bauern um. Dazu Kalender, Abholungen und eine
Auswertung, die sich auf jeden Stichtag stellen lässt.

Kein Konto, kein Server, keine Cloud: alles steht in einer Datei auf dem eigenen
Rechner, und ein Backup heißt, diese Datei zu kopieren. Wer die Werte lieber im
Stall einträgt als in der Hütte, schaltet in den Einstellungen die Freigabe im
Heimnetz ein und scannt den QR-Code mit dem Telefon — dieselbe Oberfläche,
dieselben Daten.

## Welche Datei

| System                | Datei                        |
| --------------------- | ---------------------------- |
| Mac mit Apple Silicon | `Milch_0.1.0_aarch64.dmg`    |
| Mac mit Intel         | `Milch_0.1.0_x64.dmg`        |
| Windows               | `Milch_0.1.0_x64-setup.exe`  |
| Linux                 | `Milch_0.1.0_amd64.AppImage` |

Für Windows liegt daneben ein `.msi`, für Linux ein `.deb` und ein `.rpm`, falls
jemand sie lieber über den Paketmanager installiert. Die Dateien mit der Endung
`.sig` und die `latest.json` gehören zum Update-Mechanismus und müssen nicht
heruntergeladen werden.

## Beim ersten Start

Die Pakete sind nicht bei Apple beziehungsweise Microsoft signiert — das kostet
Geld und beantwortet eine Frage, die hier niemand hat. Beide Systeme warnen
deshalb **einmal**, beim ersten Öffnen:

- **macOS** meldet, das Programm sei „beschädigt". Das stimmt nicht, es fehlt
  nur die Signatur. Meldung wegklicken, dann Systemeinstellungen → Datenschutz &
  Sicherheit → ganz nach unten scrollen → „Dennoch öffnen".
- **Windows** zeigt „Der Computer wurde durch Windows geschützt". Über „Weitere
  Informationen" erscheint „Trotzdem ausführen".
- **Linux** fragt nicht.

Ab dann meldet sich das Programm von selbst, wenn es eine neuere Version gibt,
und installiert sie auf Wunsch. Ist alles aktuell, erscheint nichts.

## Wo die Daten liegen

macOS `~/Library/Application Support/de.alp.milch/milch.db`, Windows
`%APPDATA%\de.alp.milch\milch.db`, Linux
`~/.local/share/de.alp.milch/milch.db`. Der Ordner steht neben dem Programm,
nicht darin: ein Update darüberzuinstallieren rührt ihn nicht an. Den
vollständigen Pfad zeigen die Einstellungen an.
