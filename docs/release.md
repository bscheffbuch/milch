Neu in dieser Fassung: der Alpkäse.

Das ist der Käse, den die Alp selbst hergibt — was in der Hütte gegessen wird
und was Helfer als Lohn mitnehmen dürfen. Er steht unter „Alpkäse" als eigene
Liste: Menge eintragen, Notiz dazu, fertig. Ein Datum braucht es nicht, weil sich
beim Laib, den jemand im Herbst mitnimmt, ohnehin nicht mehr sagen lässt, aus
welchem Kessel er stammt.

Abgezogen wird er am Ende, von dem was noch offen ist, und getragen von allen
Bauern im Verhältnis dessen, was jedem zusteht. Die Tage und die
Monatsabschlüsse bleiben davon unberührt — ein Eintrag lässt sich also jederzeit
nachtragen, ohne dass sich eine abgerechnete Zahl von gestern verschiebt. Wer
wieviel davon trägt, steht auf der Seite selbst und in der Abrechnung als eigene
Spalte im Käsekonto.

Der eingestellte Abzug in den Einstellungen bleibt daneben unverändert. Die
beiden sehen ähnlich aus, sind es aber nicht: der Abzug ist ein Satz, der Tag für
Tag greift, der Alpkäse eine gewogene Menge ohne Datum.

Sonst: kleinere Verbesserungen am Wortlaut der Oberfläche.

## Welche Datei

| System                | Datei                        |
| --------------------- | ---------------------------- |
| Mac mit Apple Silicon | `Milch_0.2.0_aarch64.dmg`    |
| Mac mit Intel         | `Milch_0.2.0_x64.dmg`        |
| Windows               | `Milch_0.2.0_x64-setup.exe`  |
| Linux                 | `Milch_0.2.0_amd64.AppImage` |

Für Windows liegt daneben ein `.msi`, für Linux ein `.deb` und ein `.rpm`, falls
jemand sie lieber über den Paketmanager installiert. Die Dateien mit der Endung
`.sig` und die `latest.json` gehören zum Update-Mechanismus und müssen nicht
heruntergeladen werden.

Wer schon eine ältere Fassung hat, muss nichts davon laden: das Programm meldet
sich beim Start von selbst und spielt die neue Version auf Wunsch ein. Die Daten
bleiben dabei, wo sie sind — der Ordner steht neben dem Programm, nicht darin.

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

## Wo die Daten liegen

macOS `~/Library/Application Support/de.alp.milch/milch.db`, Windows
`%APPDATA%\de.alp.milch\milch.db`, Linux
`~/.local/share/de.alp.milch/milch.db`. Den vollständigen Pfad zeigen die
Einstellungen an.
