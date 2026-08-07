# Updates über GitHub

Die Desktop-Fassung von Milch holt sich ihre Updates selbst. Beim Start
fragt sie eine Datei namens `latest.json` beim jüngsten GitHub-Release ab,
vergleicht die dort genannte Versionsnummer mit der eigenen und bietet, falls es
etwas Neueres gibt, unten links eine Karte an. Es gibt bewusst keine Rückmeldung,
wenn alles aktuell ist — ein Normalzustand braucht keine Anzeige, gemeldet wird
nur, was eine Entscheidung verlangt. Aus demselben Grund ist auch ein
gescheiterter Abruf beim Start stumm: wer das Programm öffnet, wartet auf die
Saison und nicht auf eine Auskunft über GitHub. Erst wenn jemand selbst auf
„Jetzt einspielen“ gedrückt hat und _das_ scheitert, steht eine Meldung da.

Beteiligt sind vier Stellen:

- `src-tauri/tauri.conf.json` — enthält unter `plugins.updater` die Adresse der
  `latest.json` und den öffentlichen Schlüssel, gegen den geprüft wird, sowie
  `bundle.createUpdaterArtifacts`, ohne das gar keine Updater-Pakete entstehen.
- `src-tauri/capabilities/default.json` — muss `updater:default` **und**
  `process:default` führen. Siehe unten, das ist die eine Falle des Aufbaus.
- `components/Update.tsx` — führt die Prüfung aus und zeigt die Karte. Sie
  hängt in `components/Shell.tsx` in derselben Ecke wie die Meldungen der
  Aufträge; das `div.meldungen` stapelt beide, weil das Update an keinem Auftrag
  hängt und deshalb neben einer Auftragsmeldung stehen kann.
- `.github/workflows/release.yml` — baut die Pakete für alle Systeme, signiert
  sie für den Updater und legt den Release samt `latest.json` an.

Die Prüfung läuft nur im Programmfenster. Im Browser — beim Entwickeln mit
`npm run dev` und über die Freigabe im Heimnetz — gibt es weder Tauris IPC noch
etwas zu aktualisieren, deshalb fragt die Komponente erst `inTauri()`.

Die CSP in `tauri.conf.json` bleibt unberührt, obwohl hier über das Netz
gesprochen wird: den Abruf und den Download erledigt der Rust-Teil, nicht die
Webansicht. Ein `connect-src` für GitHub wäre also nicht nur unnötig, sondern
irreführend.

## Die beiden Signaturen bitte nicht verwechseln

Das ist die Stelle, an der die meiste Verwirrung entsteht, weil beides
„Signatur" heißt und beides mit Schlüsseln zu tun hat, aber sonst nichts
miteinander zu tun hat.

**Die Updater-Signatur (minisign) ist verpflichtend und kostenlos.** Tauri
weigert sich, ein Update einzuspielen, das es nicht gegen den in der
Konfiguration hinterlegten öffentlichen Schlüssel prüfen kann; abschalten lässt
sich das nicht. Das Schlüsselpaar erzeugt man selbst mit
`npx tauri signer generate`, es kostet nichts und braucht keine
Zertifizierungsstelle. Es beantwortet genau eine Frage: stammt dieses Paket
wirklich aus diesem Repository?

**Die Code-Signatur des Betriebssystems (Apple Developer ID, Windows
Authenticode) ist die kostenpflichtige, und die benutzen wir hier bewusst
nicht.** Sie beantwortet eine andere Frage, nämlich ob Apple beziehungsweise
Microsoft den Herausgeber kennt. Was das für die Benutzer bedeutet, steht weiter
unten unter „Was beim ersten Start passiert".

## Die Falle in der Rechteliste

`tauri add process` trägt seine eigene ACL-Zeile **nicht** von selbst in
`src-tauri/capabilities/default.json` ein. Fehlt `process:default` dort, baut
alles anstandslos durch, das Update lädt und installiert sich auch — und
erst der Neustart danach bricht zur Laufzeit an der Rechteprüfung ab. Also genau
in dem Moment, in dem die neue Version schon auf der Platte liegt und niemand
mehr eine Fehlermeldung erwartet.

Die Komponente fängt diesen Fall ab: scheitert nur noch der Neustart, steht dort
nicht „fehlgeschlagen", sondern die Bitte, das Programm einmal von Hand zu
schließen und wieder zu öffnen. Das ist die Wahrheit — eingespielt ist es dann
längst. Die Zeile trotzdem stehenzulassen wäre aber nachlässig, deshalb hält der
`description`-Text der Datei fest, warum sie da ist.

## Einmalige Einrichtung

Das Schlüsselpaar ist bereits erzeugt und liegt unter `~/.tauri/milch.key`
(privat) und `~/.tauri/milch.key.pub` (öffentlich). Der öffentliche Teil steht
schon in `src-tauri/tauri.conf.json`. Der private Teil gehört **nicht** ins
Repository, sondern ausschließlich in die GitHub-Secrets:

```bash
gh secret set TAURI_SIGNING_PRIVATE_KEY < ~/.tauri/milch.key
```

Dazu kommt das zugehörige Kennwort. Beim Erzeugen wurde ein leeres Kennwort
gewählt, das Secret muss aber trotzdem existieren, weil der Build sonst auf eine
interaktive Abfrage wartet und im CI hängen bleibt:

```bash
printf '' | gh secret set TAURI_SIGNING_PRIVATE_KEY_PASSWORD
```

Der naheliegende Weg über `--body ""` funktioniert nicht: `gh` hält den leeren
Wert für „nichts angegeben" und fragt trotzdem interaktiv nach. Über die
stdin geht es. Streng nötig ist das Secret übrigens nicht — fehlt es,
setzt der Workflow einen leeren String ein, und genau die ist ja das
richtige Kennwort. Es ausdrücklich anzulegen ist trotzdem sauberer, weil man
sonst später nicht unterscheiden kann, ob es leer ist oder vergessen wurde.

Wichtig: **Geht der private Schlüssel verloren, lässt sich für alle bereits
installierten Kopien nie wieder ein Update ausliefern.** Sie prüfen
gegen den öffentlichen Schlüssel, der in ihrer Binärdatei fest eingebacken ist;
ein neues Schlüsselpaar passt dort nicht mehr hinein. Ein Backup von
`~/.tauri/milch.key` an einem Ort außerhalb dieses Rechners ist deshalb keine
Vorsichtsmaßnahme, sondern Bedingung. Nur eben nicht über einen Weg, der
unterwegs mitliest — kein Chat, keine Benachrichtigung aufs Telefon, kein
Sperrbildschirm.

## Eine Version veröffentlichen

Zuerst den Text zur neuen Version in `docs/release.md` schreiben — er wird beim
Bauen mit eingesammelt und lässt sich hinterher nicht mehr überall nachbessern
(siehe unten). Stehen dort Dateinamen mit der alten Versionsnummer, gehören sie
mitgezogen.

Die Versionsnummer selbst steht nur an einer Stelle, nämlich in `package.json`.
`src-tauri/tauri.conf.json` verweist mit `"version": "../package.json"` darauf,
damit die Nummer im Paket und die Nummer im Repository nicht auseinanderlaufen
können.

```bash
npm version patch
```

```bash
git push --follow-tags
```

In `package.json` steht neben `app:build` noch ein Eintrag `"tauri": "tauri"`.
Der sieht überflüssig aus und ist es nicht: `tauri-action` ruft im Workflow fest
`npm run tauri build` auf und kennt unsere eigenen Namen nicht. Fehlt die Zeile,
brechen alle vier Jobs sofort mit `npm error Missing script: "tauri"` ab, noch
bevor irgendetwas gebaut wird. Von Hand baut man weiterhin über `app:build` —
der Eintrag ist ausschließlich für den Workflow da und gehört nicht
weggeräumt.

Der Tag `v…` soll den Workflow auslösen — verlassen sollte man sich darauf
nicht. Beim ersten Release ist der Push des Tags zweimal hintereinander
folgenlos geblieben, obwohl Actions eingeschaltet waren und `release.yml` am Tag
lag; GitHub hat schlicht keinen Lauf angelegt. Deshalb nach dem Push einmal
nachsehen und, wenn nichts läuft, von Hand anstoßen:

```bash
gh run list --workflow release.yml --limit 3
```

```bash
gh workflow run release.yml --ref v0.1.0
```

Das ist kein Notbehelf mit anderem Ergebnis: der Workflow hört zusätzlich auf
`workflow_dispatch`, und `github.ref_name` ist dabei derselbe Tag. Es entstehen
also derselbe Release-Name und derselbe Tag wie beim automatischen Lauf.

Der Workflow baut vier Pakete — macOS auf Apple Silicon, macOS auf Intel, Linux
und Windows — und legt sie an einem **Release im Entwurfsstatus** ab. Erst wenn
der Entwurf von Hand veröffentlicht wird, ist die `latest.json` unter
`releases/latest/download/` erreichbar und die installierten Kopien finden das
Update. Das ist Absicht: solange ein Job noch läuft oder fehlgeschlagen
ist, soll niemand ein halbes Release mit fehlenden Plattformen angeboten
bekommen.

Am fertigen Entwurf hängen die Installationspakete (`.dmg` für beide
Mac-Architekturen, `.AppImage`, `.deb`, `.rpm`, `.exe`, `.msi`), daneben die
Updater-Pakete (`.app.tar.gz`) und zu jedem davon eine `.sig`, und schließlich
die `latest.json`. Die `.dmg` haben bewusst keine Signatur: über sie
installiert man das erste Mal von Hand, aktualisiert wird nicht über sie.

## Der Text zur Version

Er steht in `docs/release.md` und wird **vor** dem Tag geschrieben. Der Workflow
liest die Datei und gibt sie an zwei Stellen weiter: auf die Release-Seite und
in die `latest.json`, aus der ihn die Karte unten links im Programm nimmt.

Daraus folgt die Falle: Wer den Entwurf nachträglich in der GitHub-Oberfläche
umschreibt, ändert nur die Seite. Die `latest.json` liegt als fertige Datei am
Release und wird davon nicht berührt — die Karte zeigt weiterhin den alten
Text. Wer nachbessert, muss die `latest.json` also mit ändern und neu hochladen,
oder gleich die Datei im Repository richtigstellen und neu bauen.

Weil derselbe Text in der Karte landet, gehört er kurz gehalten. Die Karte ist
schmal, wertet kein Markdown aus und zeigt nur Zeilenumbrüche; Überschriften und
Tabellen stehen dort als Zeichen da, was sie sind. Was ausführlich sein muss —
welche Datei man lädt, was beim ersten Start passiert — steht besser in der
README und wird verlinkt. Die erste Version macht davon eine Ausnahme: bei ihr
sieht niemand eine Karte, weil es nichts gibt, was sich aktualisieren könnte.

Auf dem eigenen Rechner bauen — für einen Blick auf das Paket, nicht für eine
Veröffentlichung — geht weiterhin mit `npm run app:build` beziehungsweise
`npm run app:build:win`. Diese Pakete sind unsigniert und taugen deshalb nicht
als Update; der Weg dorthin führt über den Tag.

Der Befehl endet dabei mit einer roten Zeile, und das ist erwartbar:

```
A public key has been found, but no private key. Make sure to set `TAURI_SIGNING_PRIVATE_KEY` environment variable.
```

Sobald ein öffentlicher Schlüssel in der Konfiguration steht, will Tauri das
Updater-Paket auch signieren und bricht ohne den privaten ab. Die Meldung kommt
aber **nach** dem Packen: `Milch.app`, die `.dmg` und das
`Milch.app.tar.gz` liegen fertig da, nur die `.sig` daneben fehlt. Wer sie
loswerden oder das Updater-Paket lokal signiert haben will, gibt den Schlüssel
für den einen Aufruf mit:

```bash
TAURI_SIGNING_PRIVATE_KEY="$(cat ~/.tauri/milch.key)" TAURI_SIGNING_PRIVATE_KEY_PASSWORD="" npm run app:build
```

Für den gewöhnlichen Blick aufs Paket braucht es das nicht — dann ist die rote
Zeile schlicht zu überlesen.

## Was beim ersten Start passiert

Weil die Pakete nicht beim Betriebssystem-Hersteller signiert sind, warnen macOS
und Windows beim **ersten** Öffnen. Beides lässt sich umgehen, aber es ist gut
zu wissen, wovon die Benutzer berichten werden.

**macOS.** Der Hinweis lautet sinngemäß, das Programm sei „beschädigt und kann
nicht geöffnet werden". Das ist irreführend — die Datei ist in Ordnung, es fehlt
nur die Beglaubigung. Seit macOS 15 (Sequoia) hilft der frühere Trick, mit
gedrückter Control-Taste auf „Öffnen" zu gehen, nicht mehr. Der Weg ist jetzt:
einmal versuchen zu öffnen, die Meldung wegklicken, dann Systemeinstellungen →
Datenschutz & Sicherheit → ganz nach unten scrollen → dort steht das Programm
mit einem Knopf „Dennoch öffnen". Alternativ auf der Kommandozeile:

```bash
xattr -dr com.apple.quarantine /Applications/Milch.app
```

**Windows.** SmartScreen meldet „Der Computer wurde durch Windows geschützt".
Über „Weitere Informationen" erscheint der Knopf „Trotzdem ausführen". Diese
Meldung kommt bei jedem Update wieder, weil der Installer keinen Ruf
aufbauen kann, solange er unsigniert ist.

**Linux.** Keine Hürde, das AppImage startet direkt.

Erwartungsgemäß betrifft die Warnung nur die **erste** Installation: die
späteren Updates lädt das laufende Programm selbst herunter, und dabei
wird unter macOS kein Quarantäne-Merkmal gesetzt. Das ist bislang nicht
nachgemessen, sondern aus dem Verhalten von Gatekeeper abgeleitet — bei der
ersten echten Update also bitte einmal nachsehen.

## Grenzen, die man kennen sollte

- **Das Repository muss öffentlich sein.** Der Updater ruft die `latest.json`
  ohne Anmeldung ab. Bei einem privaten Repository müsste ein Zugriffstoken im
  Programm liegen, und ein Token in einer ausgelieferten Binärdatei ist keines.
  Wer das Repository privat halten will, braucht stattdessen einen eigenen
  kleinen Endpunkt, der die Anfrage weiterreicht.
- **Unter Linux aktualisiert sich nur das AppImage selbst.** Die ebenfalls
  gebauten `.deb`- und `.rpm`-Pakete kann der Updater nicht ersetzen; wer sie
  benutzt, aktualisiert über den Paketmanager.
- **Ein Downgrade ist nicht vorgesehen.** Der Updater vergleicht die Versionen
  und bietet nur Höheres an. Ein zurückgezogenes Release muss also durch ein
  neues, höheres ersetzt werden, nicht durch das Wiederveröffentlichen des
  alten.
- **„Überspringen" gilt pro Version und pro Rechner.** Die Nummer liegt im
  `localStorage` unter `milch.update.skipped`; die nächsthöhere
  Version fragt wieder. Wer sich verklickt hat, wird also nicht dauerhaft
  abgeschnitten, muss aber auf die übernächste warten oder den Eintrag löschen.
