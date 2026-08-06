# Aktualisierungen über GitHub

Die Desktop-Fassung von milch holt sich ihre Aktualisierungen selbst. Beim Start
fragt sie eine Datei namens `latest.json` beim jüngsten GitHub-Release ab,
vergleicht die dort genannte Versionsnummer mit der eigenen und bietet, falls es
etwas Neueres gibt, ein kleines Fenster unten rechts an. Es gibt bewusst keine
Rückmeldung, wenn alles aktuell ist — ein Normalzustand braucht keine Anzeige,
gemeldet wird nur, was eine Entscheidung verlangt.

Beteiligt sind drei Stellen:

- `src-tauri/tauri.conf.json` — enthält unter `plugins.updater` die Adresse der
  `latest.json` und den öffentlichen Schlüssel, gegen den geprüft wird.
- `app/komponenten/aktualisierung.tsx` — führt die Prüfung aus und zeigt das
  Fenster.
- `.github/workflows/release.yml` — baut die Pakete für alle Systeme, signiert
  sie für den Updater und legt den Release samt `latest.json` an.

## Die beiden Signaturen bitte nicht verwechseln

Das ist die Stelle, an der die meiste Verwirrung entsteht, weil beides
„Signatur" heisst und beides mit Schlüsseln zu tun hat, aber sonst nichts
miteinander zu tun hat.

**Die Updater-Signatur (minisign) ist verpflichtend und kostenlos.** Tauri
weigert sich, ein Update einzuspielen, das es nicht gegen den in der
Konfiguration hinterlegten öffentlichen Schlüssel prüfen kann; abschalten lässt
sich das nicht. Das Schlüsselpaar erzeugt man selbst, es kostet nichts und
braucht keine Zertifizierungsstelle. Es beantwortet genau eine Frage: stammt
dieses Paket wirklich aus diesem Repository?

**Die Code-Signatur des Betriebssystems (Apple Developer ID, Windows
Authenticode) ist die kostenpflichtige, und die benutzen wir hier bewusst
nicht.** Sie beantwortet eine andere Frage, nämlich ob Apple beziehungsweise
Microsoft den Herausgeber kennt. Was das für die Benutzer bedeutet, steht weiter
unten unter „Was beim ersten Start passiert".

## Einmalige Einrichtung

Das Schlüsselpaar ist bereits erzeugt und liegt unter `~/.tauri/milch.key`
(privat) und `~/.tauri/milch.key.pub` (öffentlich). Der öffentliche Teil steht
schon in `src-tauri/tauri.conf.json`. Der private Teil gehört **nicht** ins
Repository, sondern ausschliesslich in die GitHub-Secrets:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/milch.key
```

Dazu kommt das zugehörige Kennwort. Beim Erzeugen wurde ein leeres Kennwort
gewählt, das Secret muss aber trotzdem existieren, weil der Build sonst auf eine
interaktive Abfrage wartet und im CI hängen bleibt:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD --body ""
```

Wichtig: **Geht der private Schlüssel verloren, lässt sich für alle bereits
installierten Kopien nie wieder ein Update ausliefern.** Sie prüfen gegen den
öffentlichen Schlüssel, der in ihrer Binärdatei fest eingebacken ist; ein neues
Schlüsselpaar passt dort nicht mehr hinein. Eine Sicherungskopie von
`~/.tauri/milch.key` an einem Ort ausserhalb dieses Rechners ist deshalb keine
Vorsichtsmassnahme, sondern Bedingung.

## Eine Version veröffentlichen

Die Versionsnummer steht nur an einer Stelle, nämlich in `package.json`.
`src-tauri/tauri.conf.json` verweist mit `"version": "../package.json"` darauf,
damit die Nummer im Paket und die Nummer im Repository nicht auseinanderlaufen
können.

```bash
npm version patch   # oder minor / major
git push --follow-tags
```

Der Tag `v…` löst den Workflow aus. Er baut vier Pakete — macOS auf Apple
Silicon, macOS auf Intel, Linux und Windows — und legt sie an einem **Release im
Entwurfsstatus** ab. Erst wenn der Entwurf von Hand veröffentlicht wird, ist die
`latest.json` unter `releases/latest/download/` erreichbar und die installierten
Kopien finden das Update. Das ist Absicht: solange ein Job noch läuft oder
fehlgeschlagen ist, soll niemand ein halbes Release mit fehlenden Plattformen
angeboten bekommen.

Der Text, den man im Release-Entwurf einträgt, ist genau der Text, den das
Aktualisierungsfenster in der Anwendung anzeigt.

## Was beim ersten Start passiert

Weil die Pakete nicht beim Betriebssystem-Hersteller signiert sind, warnen macOS
und Windows beim **ersten** Öffnen. Beides lässt sich umgehen, aber es ist gut
zu wissen, wovon die Benutzer berichten werden.

**macOS.** Der Hinweis lautet sinngemäss, die Anwendung sei „beschädigt und kann
nicht geöffnet werden". Das ist irreführend — die Datei ist in Ordnung, es fehlt
nur die Beglaubigung. Seit macOS 15 (Sequoia) hilft der frühere Trick,
mit gedrückter Control-Taste auf „Öffnen" zu gehen, nicht mehr. Der Weg ist
jetzt: einmal versuchen zu öffnen, die Meldung wegklicken, dann
Systemeinstellungen → Datenschutz & Sicherheit → ganz nach unten scrollen → dort
steht die Anwendung mit einem Knopf „Dennoch öffnen". Alternativ auf der
Kommandozeile:

```bash
xattr -dr com.apple.quarantine /Applications/milch.app
```

**Windows.** SmartScreen meldet „Der Computer wurde durch Windows geschützt".
Über „Weitere Informationen" erscheint der Knopf „Trotzdem ausführen". Diese
Meldung kommt bei jeder Aktualisierung wieder, weil der Installer keinen Ruf
aufbauen kann, solange er unsigniert ist.

**Linux.** Keine Hürde, das AppImage startet direkt.

Erwartungsgemäss betrifft die Warnung nur die **erste** Installation: die
späteren Aktualisierungen lädt die laufende Anwendung selbst herunter, und
dabei wird unter macOS kein Quarantäne-Merkmal gesetzt. Das ist bislang nicht
nachgemessen, sondern aus dem Verhalten von Gatekeeper abgeleitet — beim ersten
echten Update also bitte einmal nachsehen.

## Grenzen, die man kennen sollte

- **Das Repository muss öffentlich sein.** Der Updater ruft die `latest.json`
  ohne Anmeldung ab. Bei einem privaten Repository müsste ein Zugriffstoken im
  Programm liegen, und ein Token in einer ausgelieferten Binärdatei ist keines.
  Wer das Repository privat halten will, braucht stattdessen einen eigenen
  kleinen Endpunkt, der die Anfrage weiterreicht.
- **Unter Linux aktualisiert sich nur das AppImage selbst.** Die ebenfalls
  gebauten `.deb`- und `.rpm`-Pakete kann der Updater nicht ersetzen; wer sie
  benutzt, aktualisiert über die Paketverwaltung.
- **Die Oberfläche wird statisch exportiert.** In `next.config.ts` steht
  `output: "export"`, weil im Paket kein Node-Server mitläuft. Damit entfallen
  Server Actions, Route Handler mit Zugriff auf den Request, Cookies, Rewrites,
  Redirects, Headers und ISR. Serverseitige Logik gehört stattdessen als
  Tauri-Command nach `src-tauri/`.
- **Ein Downgrade ist nicht vorgesehen.** Der Updater vergleicht die Versionen
  und bietet nur Höheres an. Ein zurückgezogenes Release muss also durch ein
  neues, höheres ersetzt werden, nicht durch das Wiederveröffentlichen des
  alten.
