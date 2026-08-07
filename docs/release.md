Die erste Fassung von Milch — dem Programm für die Abrechnung einer Alpsaison.

Es führt die Bauern und ihre Kühe, nimmt die Gemelke zweimal am Tag auf, hält
Behandlungen mit ihren Wartezeiten fest und rechnet den Käse Tag für Tag nach
dem Milchanteil auf die Bauern um. Dazu Kalender, Abholungen und eine
Auswertung, die sich auf jeden Stichtag stellen lässt.

Kein Konto, kein Server, keine Wolke: alles steht in einer Datei auf dem eigenen
Rechner, und Sichern heißt, diese Datei zu kopieren. Wer die Werte lieber im
Stall einträgt als in der Hütte, schaltet in den Einstellungen die Freigabe im
Heimnetz ein und filmt den QR-Code mit dem Telefon ab — dieselbe Oberfläche,
derselbe Datenbestand.

## Welche Datei

| System                | Datei                        |
| --------------------- | ---------------------------- |
| Mac mit Apple Silicon | `Milch_0.1.0_aarch64.dmg`    |
| Mac mit Intel         | `Milch_0.1.0_x64.dmg`        |
| Windows               | `Milch_0.1.0_x64-setup.exe`  |
| Linux                 | `Milch_0.1.0_amd64.AppImage` |

Für Windows liegt daneben eine `.msi` und für Linux ein `.deb` und ein `.rpm`,
falls jemand sie über die Paketverwaltung einspielen will. Die Dateien mit der
Endung `.sig` und die `latest.json` sind für die Aktualisierung da und müssen
nicht heruntergeladen werden.

## Beim ersten Start

Die Pakete sind nicht bei Apple beziehungsweise Microsoft beglaubigt — das
kostet Geld und beantwortet eine Frage, die hier niemand hat. Beide Systeme
warnen deshalb **einmal**, beim ersten Öffnen:

- **macOS** meldet, das Programm sei „beschädigt". Das stimmt nicht, es fehlt
  nur die Beglaubigung. Meldung wegklicken, dann Systemeinstellungen →
  Datenschutz & Sicherheit → ganz nach unten scrollen → „Dennoch öffnen".
- **Windows** zeigt „Der Computer wurde durch Windows geschützt". Über „Weitere
  Informationen" erscheint „Trotzdem ausführen".
- **Linux** fragt nicht.

Ab dann meldet sich das Programm von selbst, wenn es eine neuere Fassung gibt,
und spielt sie auf Wunsch ein. Ist alles aktuell, erscheint nichts.

## Wo die Daten liegen

macOS `~/Library/Application Support/de.alp.milch/milch.db`, Windows
`%APPDATA%\de.alp.milch\milch.db`, Linux
`~/.local/share/de.alp.milch/milch.db`. Der Ordner steht neben dem Programm,
nicht darin: eine neue Fassung darüberzuinstallieren rührt ihn nicht an. Den
vollständigen Pfad zeigen die Einstellungen an.
