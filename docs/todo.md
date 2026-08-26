# Offene Arbeiten

Stand: 2026-08-05. Erledigtes bleibt kurz stehen, damit nichts zweimal
angefasst wird; was fertig und geprüft ist, wandert irgendwann ganz heraus.

## In Arbeit

- [ ] **Die Freigabe einmal mit einem Telefon durchspielen.** Der Bau steht, die
      Teile sind einzeln geprüft (siehe unten) — was fehlt, ist der Weg von Hand:
      im gebauten Programm unter Einstellungen → Freigabe einschalten, den
      QR-Code abfilmen, auf dem Telefon eine Messung eintragen und im
      Programmfenster nachsehen, dass der Wert dort steht. Von hier aus ist das
      nicht zu machen: es braucht einen Klick im Programmfenster, und der
      Zugriff auf den Bildschirm ist für dieses Programm nicht erteilt.

## Offen

Vom Benutzer am 05.08.2026 angemeldet, in seiner Reihenfolge.

_Zur Zeit nichts._

## Erledigt und geprüft

- [x] **Alpkäse — was die Alp selbst isst und was Helfer mitnehmen.** Am
      26.08.2026 auf Wunsch des Benutzers. Eine eigene Seite (`/alpkaese/`) und
      eine eigene Tabelle (`alp_cheese`, Schemastand 6): je Entnahme ein
      Eintrag mit Menge und einer Notiz — ein Verbrauchsbuch, kein Kalender.

      Ein Datum trägt der Eintrag bewusst nicht. Wer im Herbst einen Laib
      mitnimmt, kann nicht sagen, aus welchem Kessel er stammt, und die Alp
      führt darüber kein Buch; ein erfundener Tag wäre schlechter als gar
      keiner, weil er eine Genauigkeit vortäuschte, die es nicht gibt, und die
      Tagesabrechnung verschöbe. Zwei Zwischenstände sind unterwegs verworfen
      worden: erst ein Datum je Eintrag (Stand 4), dann ein freiwilliges Datum,
      dessen Fehlen über die Produktionstage verteilt wurde (Stand 5). Der
      Benutzer wollte beides nicht — „es soll wirklich ganz ohne zeit einfach
      stand jetzt sein".

      Deshalb geht der Alpkäse gar nicht in den Rechenkern. Der rechnet
      unverändert Tag für Tag und Monat für Monat weiter; der Alpkäse wird erst
      danach abgezogen, in `buildFarmerBalances`, und zwar vom offenen Stand:
      jeder trägt davon den Anteil, der seinem Anspruch über die Saison
      entspricht. Damit verschiebt ein nachgetragener Eintrag keinen bereits
      abgeschlossenen Monat — er mindert nur, was noch offen ist. Steht noch
      niemandem Käse zu, bleibt der Betrag liegen; die Seite sagt das dann auch.

      Der eingestellte Abzug bleibt daneben bestehen und unverändert: er ist
      eine Rate, die Tag für Tag greift und am Käse des Tages gedeckelt wird,
      der Alpkäse eine gewogene Menge ohne Zeit. Beides in eines zu ziehen ging
      nicht, ohne dem einen die Zeitrechnung aufzuzwingen, die das andere
      gerade loswerden sollte.

      Sichtbar in der Abrechnung (eigene Spalte je Bauer im Käsekonto der
      ganzen Saison, Beisatz unter „Verteilt", eigene Zeile in „Wie gerechnet
      wird") und in der Übersicht (Kachel „Käse verteilbar" zeigt jetzt
      `distributableKg`, Beisatz nennt Abzug und Alpkäse einzeln). Im Kalender
      steht er bewusst nicht — er gehört zu keinem Tag.

      Geprüft: `npm test` 52 Tests grün, darunter drei neue zum Alpkäse
      (100 kg auf eine Saison im Verhältnis 3:1 werden zu 75/25 kg, die
      Junizeile bleibt dabei unberührt bei 900 kg; ohne jeden Anspruch bleibt
      der Betrag liegen; die Saisonzahlen weisen `distributableKg` aus);
      `npm run typecheck`, `npm run build` und `eslint` ohne Fehler, die Seite
      steht im Bau; `cargo test` grün.

- [x] **Eine eigene Auswahlliste für das ganze Programm — die des Betriebssystems
      ist überall verschwunden.** Am 06.08.2026 auf Wunsch des Benutzers. Der
      Anlass war die Kuhwahl beim Eintragen einer Behandlung: dort standen drei
      Kästen untereinander — Bauer wählen, suchen, Kuh wählen —, wo eine Frage
      gestellt wird. Jetzt ist es ein Feld: ohne Eingabe stehen die Bauern
      darin, jeder mit der Zahl seiner Kühe und einem Zeichen, dass es
      weitergeht; tippt man los, wird über alle Kühe der Alp gesucht und die
      Treffer stehen unter dem Namen ihres Bauern; ist man bei einem Bauern
      drin, führt die oberste Zeile wieder heraus. Dieselbe Liste ersetzt alle
      zwanzig übrigen `<select>` im Programm. Der Grund ist derselbe, der beim
      Datumsfeld schon galt: ein `<select>` zeichnet nicht die Seite, sondern
      das Betriebssystem, und unter Windows sieht es anders aus als unter macOS.
      Die Liste hängt am Körper der Seite, folgt ihrem Feld beim Rollen und
      klappt nach oben, wenn unten kein Platz ist. Abgeschickt wird weiterhin
      über ein verborgenes Feld, die Server-Aktionen haben sich nicht geändert;
      die Pflichtprüfung hängt an einem sichtbar leeren, aber anspringbaren Feld
      und meldet „Bitte eine Zeile wählen." Am laufenden Entwicklungsdienst
      durchgespielt: Bauernzeile, Suche über alle Kühe („bel" findet Bella unter
      Oberhofer), Auswahl mit der Eingabetaste, und die Prüfung schlägt bei
      leerer Abholung an. 42 Prüfungen, Typprüfung und `eslint` ohne neue
      Beanstandung.

- [x] **Knöpfe und Felder auf ein Maß gebracht, das Pluszeichen entfernt.**
      Ebenfalls am 06.08.2026, aus derselben Anfrage. Es gibt jetzt genau zwei
      Größen statt drei: die Kennzeichnung `chip` war heimlich eine dritte
      geworden, wo sie als Knopf benutzt wurde. Solche Gruppen — „einmalig /
      mehrere Gemelke / läuft noch", die Monatsleiste, die Bauernfilter — sind
      zu einer Fläche mit einem Rahmen zusammengefasst, in der die gewählte
      Möglichkeit über Fläche und Fettung heraussticht, nie über die Farbe.
      Knöpfe behalten ihre runde Form, nehmen aber dieselbe Höhe und dieselbe
      Polsterung nach oben und unten wie ein Eingabefeld, damit beide
      nebeneinander auf einer Linie stehen. Das Pluszeichen vor „Behandlung
      eintragen" ist weg: neben dem Wort sagte es dasselbe zweimal. Und
      „Löschen" steht in langen Tabellen nicht mehr in jeder Zeile sichtbar da,
      sondern erscheint, sobald der Zeiger auf der Zeile ist oder etwas darin
      den Fokus hat — den Platz behält es, damit die Spalte nicht zuckt.

- [x] **Neu gebaut und eingesetzt — der Bestand hat es überstanden.** Am
      06.08.2026 auf Geheiß des Benutzers. Vorher 42 Prüfungen und die Typprüfung
      durchlaufen lassen, beide ohne Beanstandung, und eine Sicherheitskopie mit
      `VACUUM INTO` gezogen. Das laufende Programm sauber über `quit` beendet,
      das alte Bündel beiseite gelegt statt gelöscht und das neue mit `ditto`
      nach `/Applications` gebracht. Die Kennung im neuen Bündel ist
      unverändert `de.alp.milch` — das ist die Angel, an der der Bestand hängt.
      Der Vergleich der beiden Binärstücke zeigt schwarz auf weiß, woran es lag:
      im alten kommen die Zeichenketten `vor-messung` und `vor-loeschen` nicht
      vor, im neuen beide, dazu `vor-wiederherstellung` und `VACUUM INTO`. Nach
      dem Start des neuen Programms steht in der Datenbank aufs Stück dasselbe
      wie vorher: 5 Bauern, 71 Kühe, 2 Gänge, 70 Messwerte, 1 Behandlung. Kein
      Absturzbericht. Nebenbei bemerkt: das Journal wird beim Beenden nicht
      zusammengelegt — die Hauptdatei ist immer noch 4096 Byte groß und das
      `-wal` immer noch 1,4 MB. Schadet nichts, heißt aber, dass eine Kopie von
      Hand weiterhin nur mit allen drei Dateien zusammen etwas taugt.

- [x] **Nachgemessen, ob der Bestand die Neuinstallation wirklich übersteht — und
      ob ein Backup wirklich alles enthält.** Nicht aus dem Code geschlossen,
      sondern an den Dateien nachgesehen. Die Datenbank liegt in
      `~/Library/Application Support/de.alp.milch/` und damit außerhalb des
      Programmbündels; der Ordner ist vom 04.08.2026 und hat die bisherigen Bauten
      schon überdauert. Die Hauptdatei `milch.db` ist dort 4096 Byte groß, das
      `-wal` daneben 1,4 MB — der ganze Bestand steht also im Journal und noch
      nicht in der Hauptdatei. Wie sehr das zählt, zeigte die Probe: `milch.db`
      allein in einen anderen Ordner kopiert lässt sich nicht einmal öffnen
      („unable to open database file"), und was drinsteht, ist eine einzige Seite
      ohne eine einzige Tabelle. Gelesen mit ihrem Journal zusammen sind es
      5 Bauern, 71 Kühe, 2 Gänge, 70 Messwerte und 1 Behandlung. Genau diese Zahlen
      stehen auch im jüngsten Backup (`milch-2026-08-05-1829.db`) und in der
      Datei, die im Ordner „Downloads" liegt — `VACUUM INTO` schreibt also
      tatsächlich den Stand mitsamt Journal, und zwar in eine einzelne Datei ohne
      `-wal` daneben. Die älteren beiden Backups zeigen die Vorstufen (leer,
      dann Bauern und Kühe ohne Messungen), stimmen also auch untereinander.
      Das Ganze noch einmal am laufenden Programm nachgestellt, auf einer
      Wegwerfdatei über `MILCH_DB` und den Entwicklungsdienst: nach zwei
      geschriebenen Messwerten enthielt eine Handkopie der Hauptdatei den alten
      Stand (70 Messwerte, der neue Wert fehlt), das über die Oberfläche gezogene
      Backup dagegen den neuen (2 Messwerte, Kuh 1 mit 9,5). Die Wegwerfdatei
      und der Dienst sind wieder abgeräumt, die echte Datenbank blieb unangetastet.

- [x] **Die selbsttätigen Backups laufen — im Code.** Am selben Weg geprüft.
      Der erste `saveRoundValues` eines Gangs legt `vor-messung-…` an, ein zweiter
      Aufruf für denselben Gang legt keine zweite an (dafür sorgt `Store::secured`),
      ein Aufruf für einen anderen Gang wieder eine, und `deleteRound` legt
      `vor-loeschen-…` an. Die Namen kollidieren nicht: die zweite in derselben
      Minute heißt `…-1121-2.db`. Der Inhalt ist auch der richtige — im ersten
      Backup fehlt der Wert, der gleich danach geschrieben wurde. Was noch
      fehlt, ist der neue Bau, damit das auch im wirklichen Programm greift; das
      steht oben unter „In Arbeit".

- [x] **Tag am Telefon als Blatt von unten.** Nach der Skizze des Benutzers: unten guckt ein
      dunkles Blatt mit abgerundeter Kante und Griffleiste hervor („Mi, 05.08.2026 · heute“),
      das sich mit einem Wisch nach oben ganz aufziehen lässt. Unter 560 Pixeln liegt die
      Ablage nicht mehr rechts, sondern unten: gerundete Kante, Schlagschatten nach oben, je
      Fläche eine Griffleiste. „Weggeklappt“ heißt dort nicht mehr „als Reiter am Rand“,
      sondern „hingelegt“ — das Blatt bleibt als Spalt stehen, der Reiterstreifen und die
      Knöpfe zum Lösen und Hinklappen fallen weg, denn dafür ist jetzt der Wisch da.
      Das Blatt hängt dabei wirklich am Finger und springt nicht auf eine Schwelle hin um:
      gezogen wird die Höhe der Reihe selbst, und weil die Reihe am unteren Rand klebt,
      wandert ihre Oberkante genau so weit wie der Daumen. Während des Zuges steht der
      Körper der hingelegten Fläche schon da, sonst zöge man einen leeren Kasten auf.
      Losgelassen entscheidet die Hälfte der Strecke, wohin es fällt; ein kurzes Tippen auf
      den Spalt zieht auf. Zwei Dinge waren daran zu richten, nachdem der Benutzer sie
      gesehen hat: das Zucken am Ende des Zuges kam daher, dass React den neuen Stand erst
      nach dem Anstrich verbuchte, in dem die Höhe der Hand schon abgeräumt war — für einen
      Anstrich stand dann das Stylesheet des alten Zustands ohne Höhe da und das Blatt sprang
      auf seine volle Höhe und gleich wieder zurück. Jetzt geht der Stand mit `flushSync`
      voraus und die Hand danach, beides in einem Anstrich. Dazu steigt `transitionend`
      auf — auch eine Schaltfläche im Kopf, die ihre Farbe wechselt, meldete sich dort und
      setzte das Blatt mitten im Fallen ab; gehört wird jetzt nur das Ende der eigenen Höhe.
      Zweitens ist das Blatt eine Sache und kein Stapel einzeln zu bedienender Flächen: steht
      neben „Tag“ noch „Mehrere Tage gleich“, zieht der Wisch beide auf und legt beide hin
      (`setCollapsedAll`), und der Spalt ist so hoch wie die Köpfe, die wirklich darin
      stehen — gemessen und nicht festgeschrieben, von einem `ResizeObserver` als
      `--blatt-spalt` ans Dokument geschrieben, damit der Inhalt darüber genau so viel Platz
      freihält, wie unten weg ist. Am Rechner ändert sich nichts: die Griffleiste steht dort
      nicht, die Reiter und die Knöpfe bleiben, und jede Fläche klappt für sich.
      Bei 390×844 nachgefahren: mit einer Fläche Spalt 78 Pixel und Fußraum 93; aufgezogen
      folgt die Höhe dem Finger auf den Pixel (30 Pixel Wisch, 30 Pixel Blatt) und setzt sich
      ohne Überschwingen auf 523 Pixel, also genau 62vh; hingelegt ebenso zurück auf 78. Mit
      zwei Flächen Spalt 155 Pixel und Fußraum 170, beide Köpfe lesbar untereinander, beide
      Körper wachsen beim Zug gleichmäßig mit (32 auf 174 Pixel), und beide sind nach dem
      Loslassen im selben Zustand. Kein Anstrich mehr, in dem das Blatt an der falschen
      Stelle steht. Auch an einer Erfassungsmaske nachgefahren, nicht nur an der Tagesspalte:
      „Behandlung eintragen“ kommt als Blatt auf 523 Pixel, der Wisch nach unten legt es auf
      78 hin und ein Tippen auf den Spalt zieht es wieder auf. Das Kreuz im Kopf bleibt dabei
      ein Knopf und wird nicht zum Griff — beim Andrücken hängt nichts am Finger, und
      geschlossen verschwindet die Ablage ganz; `--blatt-spalt` wird dann wieder vom Dokument
      genommen, so dass der Fußraum auf die 84 Pixel für die schwebende Handlung zurückfällt.
      Bei 1280 Pixeln unverändert: Reiter für jede Fläche einzeln, Griffleiste unsichtbar.
      `npm test` 42 von 42, `npm run typecheck` sauber, `npm run check` bei 0,000000 kg,
      eslint unverändert bei zwei bekannten Anmerkungen.
- [x] **`npm test` lief nur noch von Hand.** Im Skript stand `test/**/*.test.ts`, und die
      Muschel, in der npm seine Skripte ausführt (`sh`), löst `**` nicht auf — der Stern kam
      wörtlich bei `tsx` an und der Lauf endete mit „Could not find“. Die Prüfungen liegen
      alle flach in `test/`, ein Stern genügt: `test/*.test.ts`. `npm test` findet wieder
      alle 42.
- [x] **Kopf und Inhalt sagen nicht mehr dasselbe.** In der Tagesspalte stand das Datum
      zweimal: einmal in der Kopfzeile der Fläche und gleich darunter noch einmal als
      Überschrift im Inhalt. Am Telefon fiel das auf, weil der Spalt des hingelegten Blattes
      nur die Kopfzeile zeigt und beim Aufziehen dieselbe Zeile ein zweites Mal erschien.
      Geblieben ist die Kopfzeile — sie bleibt stehen, wenn der Inhalt rollt. Was früher als
      zweite Zeile im Inhalt stand, hängt jetzt am Beisatz mit dran: „Mi, 05.08.2026 · heute“
      bei einem Tag, „27.07. – 02.08. · 2 Lücken“ bei mehreren; die Zahl der Tage steht schon
      im Titel. `.day-title` ist damit aus dem Stylesheet heraus.
- [x] **Summen je Bauer im Blatt.** Über jeder Gruppe stand schon der Name des Hofes, die
      Zeile war aber sonst leer. Jetzt trägt sie neben dem Namen die Summen des Hofes,
      Spalte für Spalte über denselben Zahlen: das erste Gemelk, das zweite, der Tag und was
      zuletzt gemessen wurde. Die Summen laufen beim Tippen mit und nicht erst nach dem
      Speichern — sie sind ja dazu da, eine danebengegriffene Zahl auffallen zu lassen, und
      zwar während man sie eintippt. Das Blatt schreibt von selbst und erst nach 900 ms Ruhe
      (`useAutoSave`), der gespeicherte Stand hinkt also hinterher; darum merkt sich eine
      kleine Ablage jeden Anschlag beim Namen des Feldes, und `cellL` nimmt das eben
      Getippte, sonst das Gespeicherte. Eine leere Zelle zählt in keine Summe hinein — leer
      heißt „nicht gemessen“ und nicht „null Liter“. In der Spalte „zuletzt“ steht bei der
      ersten Messung ein Strich statt einer Null: eine Summe aus lauter Strichen ist kein
      Nullergebnis, sondern gar keines. Nachgerechnet an der Seed-Herde: Gruber
      `13,0 + 12,1 + 12,9 + 12,7 = 50,7` morgens, 42,6 abends, 93,3 am Tag. Beim Tippen
      mitgelaufen: 14,2 auf 99,9 geändert ließ die Summe von 51,2 auf 136,9 springen, das
      Feld geleert auf 37,0, den alten Wert zurückgeschrieben wieder auf 51,2 — und in der
      Datenbank stehen danach wieder 14,2. In „zuletzt“ steht bei der zweiten Messung 93,3,
      also genau die Tagessumme der ersten. `npm test` 42 von 42, `npm run check` bei
      0,000000 kg, `npm run typecheck` sauber, eslint unverändert bei zwei bekannten
      Anmerkungen.
- [x] **Anlegen und Ändern auseinanderhalten.** Zwei gleich aussehende Schaltflächen
      nebeneinander, und die eine legt einen Eintrag an, während die andere einen Bestand
      umschreibt: an der Bauernseite standen „Abholung“ und „Stammdaten“ genau so da. Neu
      ist deshalb erstens ein Pluszeichen am Auslöser jeder Anlegemaske (`neu` an
      `components/Panel.tsx`) — es steht an „Behandlung“, „Abholung“, „Bauer hinzufügen“,
      „Kuh hinzufügen“, „Messung anlegen“, „Behandlung eintragen“, „Voreinstellung anlegen“,
      „Saison anlegen“ und „Kühe übernehmen“, und es ist leiser gesetzt als die
      Beschriftung, denn es soll unterscheiden und nicht anführen. Zweitens liegt jede
      Änderungsmaske jetzt zu, bis ein Schalter sie aufsperrt: `components/Aendern.tsx` legt
      die Maske in ein abgeschaltetes `fieldset`, und ein abgeschaltetes `fieldset` schaltet
      alles ab, was darin steht — Felder, Datumswähler und die Schaltfläche zum Speichern
      gleich mit. Zugesperrt lässt sich nichts eintippen und nichts absenden, auch nicht mit
      der Tastatur; sie ist dann auch ruhiger gezeichnet, ohne Feldränder, so dass man ihr
      den Zustand ansieht, ohne hineinzufassen. Der Schalter sitzt darüber und nicht darin,
      sonst wäre er mit abgesperrt. Je Maske einer, nicht einer für die ganze Seite — so
      gibt man nur frei, was man wirklich anfasst. Nach dem Speichern ist wieder zu: der
      Schalter hängt am selben Schlüssel wie die Maske (`lib/formular.ts`), und ändert sich
      der gespeicherte Stand, wird beides neu gebaut. Dahinter liegen jetzt die Stammdaten
      des Bauern und der Kuh, „Auftrieb und Saisonende“ und die Messung samt „Messung
      löschen“ — auch das ist eine Änderung, und zwar die gröbste. Nachgeprüft bei 1440
      Pixel: zugesperrt sind alle sechs Bedienelemente der Stammdatenmaske abgeschaltet und
      der Schalter als einziger nicht, der Feldrand steht auf durchsichtig; aufgesperrt sind
      alle sechs frei und die Ränder wieder da; eine Notiz eingetragen und gespeichert,
      danach steht sie im Feld und der Schalter ist von selbst wieder zu. In der
      Messungsmaske hängen Datumswähler, Speichern und Löschen gleichermaßen am Schalter.
      Die Probenotiz ist wieder entfernt; `npm test` 42 von 42, `npm run check` bei 0,000000
      kg, `npm run typecheck` sauber, eslint unverändert bei zwei bekannten Anmerkungen.
- [x] **Rechte Ablage: der Platz bleibt stehen, der Inhalt bleibt alt.** Zwei Fehler an
      einer Stelle, beide auf den Kuh- und Bauernseiten. Der leere Streifen aus dem Bild des
      Benutzers kam nicht vom Schließen, sondern vom Weggehen: `DockSurface` in
      `components/Dock.tsx` meldete sich beim Einbau nur an, wenn die Fläche eine dauerhafte
      war; die Kuh- und Bauernablage ist es nicht, sie meldete sich also nie ab. Verließ man
      die Seite bei offener Ablage, blieb der Eintrag in `order` liegen, `data-dock` stand
      weiter auf `"open"`, und das Raster hielt die 360 Pixel für eine Fläche frei, die es
      gar nicht mehr gab — ein breiter leerer Streifen ohne Kopf, ohne ✕ und ohne Reiter,
      den man wieder hätte zumachen können. Gemessen bei 1440 Pixel Fensterbreite, `/kuehe/`
      mit offener Ablage und dann weiter auf `/bauern/`: Spalten `62px 1018px 360px` bei
      null eingebauten Flächen. Die Anmeldung hängt jetzt nicht mehr an `persistent`, und
      An- und Abmeldung stehen im selben Effekt — im Entwicklungslauf baut React zweimal
      ein, und wer nur abmeldet, meldet einmal zuviel ab. Danach an derselben Stelle
      `62px 1378px 0px`. Der Nachlauf des Rasters täuscht dabei: misst man früher als eine
      halbe Sekunde nach dem Wechsel, liest man die Spalte mitten in der Bewegung (78,75
      statt 30 Pixel am Reiter). Der alte Inhalt war React selbst. Ein Feld ohne eigenen
      Zustand nimmt seine Vorgabe beim Einbau, und nach einer geglückten Aktion setzt React
      das Formular von selbst zurück — auf eben diese Vorgabe, also auf den Stand von
      vorher. In der Ablage bleibt die Maske nach dem Speichern stehen, dort fiel es auf:
      „nach dem Gemelk" auf morgens gestellt und gespeichert, in der Datenbank stand `AM`,
      in der Maske daneben wieder abends. Dieselbe Sache an zwei Stellen eines Bildschirms
      verschieden — und wer dann noch einmal speichert, schreibt den alten Wert zurück, ohne
      etwas geändert zu haben. `lib/formular.ts` bildet aus dem gespeicherten Stand einen
      Schlüssel; ändert er sich, baut React die Felder mit den neuen Vorgaben auf, und
      solange er gleich bleibt, fährt kein Neuaufbau dem Tippen dazwischen. Er hängt jetzt
      an fünf Masken: Auftrieb und Stammdaten der Kuh (`app/kuehe/detail.tsx`), Bauer
      (`app/bauern/detail.tsx`), Messung (`app/messung/detail.tsx`) und die Tagesmenge Käse
      im Kalender (`app/kalender/page.tsx`). Nachgeprüft: 10.09.2026 abends gespeichert, die
      Maske zeigt danach genau das und die Datenbank sagt dasselbe; das Feld wieder geleert,
      und beide sind wieder leer. Auch das Auf- und Zufahren blieb heil — offen, auf den
      Reiter, zurück, zu, dazu die dauerhafte Fläche im Kalender und das freie Fenster.
      `npm test` bei 42 von 42, `npm run check` bei 0,000000 kg Abweichung,
      `npm run typecheck` sauber, eslint unverändert bei zwei bekannten Anmerkungen.
- [x] **Backups: im Finder zeigen und von selbst sichern.** Zwei Sachen an
      einem Ort. Zum Zeigen führt ein eigener Befehl `revealPath`
      (`backup::reveal`): auf dem Mac `open -R`, unter Windows
      `explorer /select,`, sonst `xdg-open` auf den Ordner. Was gezeigt werden
      darf, ist eng gefasst — die Datenbank selbst, der Backup-Ordner und was
      darin liegt; alles andere weist `reveal_path` in `lib.rs` ab („… gehört
      nicht zur Datenbank"), denn ein Befehl, der jeden Pfad öffnet, ist ein
      Loch. In den Einstellungen hängen daran drei Knöpfe: „Im Ordner zeigen"
      beim Pfad, „Ordner öffnen" über der Liste und „Zeigen" an jedem einzelnen
      Backup. Von selbst gesichert wird vor der ersten Änderung an einer
      Messung und vor jedem Löschen (`secure` in `lib.rs`, Vorsätze
      `vor-messung` und `vor-loeschen` in `backup.rs`). Einmal je Messung, nicht
      einmal je Anschlag: welche Messung in diesem Programmlauf schon gesichert
      ist, merkt sich ein `HashSet` neben dem Bestand — beim Speichern von
      selbst alle 900 ms entstünden sonst hundert Kopien eines Nachmittags.
      Liegen bleiben die zehn jüngsten selbsttätigen (`AUTO_KEEP`, `sweep`);
      von Hand angelegte rührt das Aufräumen nicht an, es sieht nur auf die
      beiden Vorsätze. Abschalten lässt sich das Ganze mit „Von selbst sichern"
      (`meta`-Schlüssel `auto_backup`, Befehl `setAutoBackup`). Durchgemessen:
      eine Kopie beim ersten Schreiben in eine Messung und keine bei den drei
      folgenden, eine eigene für eine zweite Messung, von sechzehn blieben
      genau zehn liegen und die von Hand angelegte `milch-…` unangetastet,
      `/etc/hosts` wurde abgewiesen, ausgeschaltet entstand nichts und
      eingeschaltet wieder etwas, vor einem Löschen stand `vor-loeschen-…` da,
      und der Finder kam mit dem Ordner nach vorn. `npm run check` danach bei
      0,000000 kg Abweichung; die Proben sind wieder gelöscht.
- [x] **Anderes Zeichen für „Einstellungen": ein Zahnrad.**
      `components/NavIcon.tsx`, Name `einstellungen`. Vorher standen dort zwei
      Regler, die neben den übrigen Zeichen aber wie zwei Zeilen einer Liste
      aussahen. Sechs Zähne, nicht acht: bei sechzehn Bildpunkten und einem
      Strich von 1,4 laufen mehr Zähne ineinander. Gerechnet um die Mitte 8/8
      mit Körper 4,0 und Spitze 5,65, die Flanken gerade, die Bögen dazwischen
      echte Kreisbögen. Bei 16, 32, 64 und 128 Bildpunkten nachgesehen — bei 16
      bleiben die Lücken offen, bei 128 sitzen die Zähne gleichmäßig.
- [x] **Messungen nach Bauern eintragen, mit der Tastatur allein.**
      `components/QuickEntry.tsx`, in `app/messung/detail.tsx` hinter den
      Marken „Blatt" und „Eintippen". Erst den Bauern, dann das Gemelk, dann
      immer dasselbe: Glocke — Eingabetaste — Menge — Eingabetaste, und der
      Schreibstrich steht wieder in der Glocke. Die Kuh wird schon beim Tippen
      gesucht (genau getroffen vor Anfang eines längeren, sonst käme man bei
      einer Herde mit 7 und 70 nie an die 7), ihr Name steht unter dem Feld.
      Gespeichert wird je Kuh mit derselben Anweisung wie das Blatt; das andere
      Gemelk fährt in einem verborgenen Feld mit, denn was nicht mitkommt, gilt
      als nicht gemessen und wäre fort. Unter der Maske führt eine Liste die
      Kühe des Hofs mit beiden Gemelken — wer sich vertippt, sieht es dort.
      Zwei Fallen: Reacts Zurücksetzen nach der Aktion (wie bei der Kuh-Maske
      mit `onReset` abgelehnt, sonst verlöre man Bauer und Gemelk), und das
      Markieren des vorhandenen Werts beim Sprung ins Mengenfeld — React
      schreibt den Wert erst nach dem Aufruf ins Feld, markiert wäre also ein
      leeres, und die neue Zahl hinge hinter der alten („8,99,4"). Der Wert
      wird darum mit `flushSync` sofort durchgeschrieben. Im Browser
      durchgespielt (Messung 22.06. abends, Hof Gruber): 110 + Eingabetaste
      springt in die Menge, dort steht „8,9" vollständig markiert, „9,4"
      darübergetippt und Eingabetaste schreibt — daneben steht „Rosl 110: 9,4
      l", die Liste zeigt 9,4, das andere Gemelk unverändert 11,4, beide Felder
      sind leer und der Schreibstrich steht in der Glocke. Nach dem Neuladen
      steht der Wert auch im Blatt (`first_10=9.4`, `second_10=11.4`, Tag 20,8).
      Umgekehrt geprüft: mit der Marke „morgens 23.06." schreibt dieselbe Kuh
      ins zweite Gemelk und trägt das erste mit. Der Beispielbestand ist danach
      neu aufgesetzt.
- [x] **Kuh hinzufügen: getrennte Felder, stehenbleibende Vorgaben.**
      `components/CowForm.tsx` löst die Maske aus `app/kuehe/page.tsx` heraus.
      In die Glocke gehen nur Ziffern, in den Namen nur Buchstaben, und was ins
      falsche Feld gerät, wandert ins richtige — samt Schreibstrich —, solange
      das andere noch leer ist (`lib/eingabe.ts`, fünf Tests). Bauer, Auftrieb
      und Gemelk bleiben stehen, über das Schließen der Fläche und über den
      Feierabend hinaus (`localStorage`, Schlüssel `kuh-neu:…`); ungültig
      gewordene Vorgaben — ein Bauer, den es nicht mehr gibt, ein Tag außerhalb
      der Saison — fallen auf die Voreinstellung zurück. Dafür musste Reacts
      selbsttätiges Zurücksetzen nach der Formularaktion abgelehnt werden
      (`onReset`): es stellte das Auswahlfeld auf seinen ersten Eintrag zurück,
      während der Zustand daneben weiter „abends" hielt — abgeschickt worden
      wäre dann etwas anderes, als dastand. Im Browser durchgespielt:
      zeichenweise „Berta" in die Glocke getippt landet vollständig im Namen,
      „125" in den Namen getippt in der Glocke, „12a" auf einen Schlag ergibt
      12 und a; nach dem Hinzufügen sind nur Glocke und Name leer, der
      Schreibstrich steht wieder in der Glocke, und Gruber/15.06./abends stehen
      auch nach dem Neuladen der Seite noch da. In der Kuhliste steht neben dem
      Auftriebstag jetzt das Gemelk („11.06. morgens"). Der Beispielbestand ist
      danach neu aufgesetzt, die Probekühe sind wieder heraus.
- [x] **Behandlung: erst der Bauer, dann die Kuh.** Die Auswahl ist gestaffelt
      (`CowPicker` in `components/TreatmentForm.tsx`); ab acht Kühen eines Hofs
      steht ein Suchfeld dabei, das Name und Glocke zugleich durchsucht, und
      bleibt genau eine Kuh übrig, ist sie gewählt. Bei einem einzigen Hof
      entfällt der Schritt. Im Browser mit sechs Höfen durchgespielt.
- [x] **Messung: speichert von selbst.** `useAutoSave` in
      `app/messung/detail.tsx` schreibt 900 ms nach dem letzten Anschlag und
      noch einmal beim Verlassen der Seite (`pagehide` und Abbau); daneben
      steht, wann zuletzt geschrieben wurde. Zwischenspeichern heißt dabei
      wirklich speichern — kein zweiter Entwurfsbestand. Geprüft, dass der Wert
      wirklich in der Datenbank steht: geändert, Seite neu geladen, Wert war da,
      Kopfzeile hatte mitgerechnet.
- [x] **Die Herde steht überall in derselben Ordnung: nach Hof, darin nach
      Glocke als Zahl.** Die Datenschicht sortiert die Glocke als Text, dort
      stünde die 110 zwischen der 10 und der 12; `bellOrder`/`byFarmerAndBell`
      in `lib/view.ts` richten das für jede Liste zugleich (fünf Tests in
      `test/herde.test.ts`). Der Melkstand liest die Glocken in ihrer
      Zahlenfolge ab, das Messblatt tut es jetzt auch.
- [x] **Neues Programmzeichen: die Glocke des Benutzers.** Die gezeichnete
      Glocke mit Umriss, Rippen und Edelweiß ist heraus; an ihrer Stelle steht
      die Vorlage des Benutzers — eine kupferne Glocke aus drei Teilen (Öse mit
      Lederverlauf, Körper als eingebettetes Bild in der Glockenform, Klöppel
      mit Kugelverlauf), ohne Umriss und ohne Grund. `src-tauri/icon.svg` hält
      sie unverändert und passt sie nur ein: die Zeichnung misst 144 × 168, ein
      Programmzeichen muss quadratisch sein, also sitzt sie mittig in 1024 × 1024
      und füllt 824 in der Höhe — derselbe Anteil wie zuvor. Mit
      `npx tauri icon` erzeugt (`icons/android` und `icons/ios` wieder
      gelöscht) und nachgesehen: bei 1024, 128 und 32 Pixeln steht die Glocke,
      der Körper ist nicht leer geblieben (das eingebettete Bild übersteht das
      Rastern), das `.icns` im installierten Programm zeigt sie, und die Bytes
      von `icon.ico` liegen nachweislich in `milch.exe`.
- [x] **Freigabe im Heimnetz, mit QR-Code.** `src-tauri/src/net.rs`: ein
      `tiny_http`-Dienst auf Port 8788, eingeschaltet über den eigenen
      Tauri-Befehl `host` (`status`/`start`/`stop`). Er liefert die eingebackene
      Oberfläche über Tauris `AssetResolver` aus und `POST /call` in dasselbe
      `Store::run` — kein zweiter Datenbestand. Die Adresse kommt aus der
      Wegewahl des Betriebssystems, nicht aus einer Liste der Netzwerkkarten;
      der QR-Code geht als Feld aus Wahrheitswerten in die Oberfläche und wird
      dort gezeichnet. Aus bei jedem Start, ohne Kennwort, und das steht so auch
      auf der Maske. Geprüft, was ohne Klick im Fenster zu prüfen ist: vier
      Rust-Tests (`cargo test`, 4 + 5 grün) über die Umsetzung der Adresse in
      einen Dateinamen (`/messung/?id=8` → `messung/`, nackte Wurzel →
      `index.html`) und über den QR-Code — quadratisch, gültige Kantenlänge, in
      drei Ecken das vollständige 7×7-Suchmuster, womit auch die Ausrichtung des
      Feldes steht. Der Rest im Punkt oben.
- [x] **Telefontauglich bis 375 Pixel.** Reine CSS-Arbeit, ohne Eingriff in den
      Zustand: die Navigation liegt unter 880 Pixeln nicht mehr am Rand,
      sondern kommt auf Knopfdruck davor — der Streifen über der Seite ist
      inzwischen dem Klappknopf mit den drei Strichen und einer Fläche mit
      Verdunkelung gewichen (`.nav-hamburger`, `.nav-scrim`, `nav[data-open]`);
      eingeklappt heißt am Telefon fort, nicht schmal. Die Werkzeugleiste am Rand wird unter 560
      Pixeln zum Blatt von unten samt Reiterzeile am Fuß, und der Hauptknopf
      einer Seite schwebt rechts unten über der Tabelle — über der Reiterzeile,
      wenn eine da ist. In den Eingabetabellen bleibt die erste Spalte stehen,
      wenn man seitwärts schiebt; der Name in der Gruppenzeile ebenso, wozu er
      in ein `<span>` musste (eine Zelle über die volle Breite kann selbst nicht
      stehenbleiben). Im Browser bei 375×812 durchgesehen: Kalender mit Blatt
      und mit eingeklappter Reiterzeile, der schwebende Knopf auf fünf Seiten,
      zwei Kennzahlen nebeneinander, die stehende Spalte bei 200 Pixeln
      Seitwärtsversatz — und nirgends schiebt sich die Seite selbst zur Seite
      (`scrollWidth === clientWidth === 375`). Bei 800 Pixeln gegengeprüft, dass
      die stehende Spalte am Schreibtisch nichts verändert.
- [x] **Werte am Diagramm ablesbar.** Zeigt man auf eine Stelle im Verlauf,
      steht dort, was sie bedeutet.
- [x] **„Wiegung" heißt jetzt „Messung".** Gemessen wird ein Rauminhalt und kein
      Gewicht; Adressen, Masken und Text durchgezogen.

- [x] **Windows-Bau vollständig, mit einem Befehl: `npm run app:build:win`.**
      Es entstehen `milch.exe` (10,8 MB, `PE32+ executable (GUI) x86-64`) und
      `Milch_0.1.0_x64-setup.exe` (2,9 MB, von `7z` als `Nsis`,
      `NSIS-3 Unicode` gelesen) unter
      `src-tauri/target/x86_64-pc-windows-msvc/release/`. Drei Fallen lagen
      davor, alle mit irreführender Meldung, alle jetzt von
      `scripts/build-windows.ts` ausgeräumt: (1) im Pfad stand das `rustc` von
      Homebrew vor dem von `rustup` — daher `can't find crate for std` mitten
      im Bau, obwohl das Ziel längst installiert war; (2) Tauri ruft den
      NSIS-Übersetzer unter dem Windows-Namen `makensis.exe`, auf dem Mac
      heißt er `makensis`; (3) ohne gesetzte Spracheinstellung stürzt
      `makensis` mit `std::bad_alloc` ab — ein alter NSIS-Fehler (Nr. 1165),
      nachgestellt mit einem fünfzeiligen Skript, das mit `LANG=en_GB.UTF-8`
      anstandslos durchläuft. Von Grund auf durchgespielt: Baugut gelöscht,
      Sprachumgebung geleert, `npm run app:build:win` — beide Dateien wieder
      da.
- [x] **Der Entwicklungsdienst kommt nicht mehr mit ins
      Installationsprogramm.** Tauri packt jede ausführbare Datei des Pakets
      ein, also lag `serve.exe` mit im Installationsprogramm — ein Dienst, der
      auf 127.0.0.1:8787 horcht und auf dem Rechner eines Benutzers nichts
      verloren hat. Er hängt jetzt an der Eigenschaft `dev-serve`, die
      `npm run data` mitgibt. Nachgesehen: das Installationsprogramm enthält
      nur noch `milch.exe` und die NSIS-Erweiterungen, und `npm run data`
      übersetzt und startet weiterhin.
- [x] **Platz geschaffen: 1,1 GB → 38 GB frei.** Den größten Teil gab ein
      fremdes Rust-Verzeichnis her (Latch, 27,8 GB), dazu der eigene
      `release`-Baum (0,9 GB), Android- und Flutter-Bauverzeichnisse aus
      anderen Projekten, Gradles lokaler Bau-Zwischenspeicher, die
      Update-Zwischenspeicher mehrerer Anwendungen, `brew cleanup`
      und `uv cache clean`. Die großen Dateien aus `~/Downloads` (ein
      Sprachmodell und sechs abgebrochene Bruchstücke, zusammen 6,4 GB) liegen
      jetzt auf der T7 unter `Mac-Auslagerung/Downloads-2026-08-04` —
      verschoben, nicht gelöscht.

- [x] **Kalender: Klick daneben wählte nicht mehr ab.** Der festgehaltene Zug
      verglich den Stand von `d` beim Loslassen mit dem aktuellen — kehrte die
      Adresse zu einem früheren Wert zurück, und genau das tut sie beim
      Abwählen (`d=` war schon einmal da), hielt er den überholten Stand für
      den aktuellen und malte die alte Auswahl zurück. Der erste Klick daneben
      wirkte, jeder weitere nicht mehr. An die Stelle des Vergleichs tritt
      `useOptimistic`: der Zwischenstand gilt genau so lange, wie die
      Transition läuft, und fällt dann von selbst weg. Im Browser dreimal
      hintereinander durchgespielt — gewählt, danebengeklickt, gewählt … jedes
      Mal `d=` und kein Tag mehr angestrichen. Das Zucken beim Loslassen ist
      dabei nicht zurückgekommen: ein `MutationObserver` über `.cal` sah beim
      Ziehen über vier Tage nur die vier wachsenden Zustände und beim
      Loslassen keinen weiteren.
- [x] **Kalender: Tage der Nachbarmonate kenntlich.** Eigener, in beiden
      Anstrichen zurücktretender Grund (`--cal-away`), blassere Tageszahl,
      die Käsemenge eine Stufe leiser — und dort, wo der Monat wechselt, sein
      Name neben der Zahl (`27 JUL`, `1 SEP`). Angeklickt werden können sie
      weiter; die Auswahl sticht den Grund. Hell und dunkel angesehen.
- [x] **Kalender: heutiger Tag kenntlich.** Statt der zu leisen
      Unterstreichung ein gefülltes Feld um die Zahl, in der Textfarbe auf dem
      Grund der Fläche — ohne eigene Farbe und nicht mit der Auswahl zu
      verwechseln, die nur die Fläche des Tages anhebt.
- [x] **Kalender: Auswahl ruckelt beim Loslassen.** Zwei Ursachen, beide
      behoben. Die Tagesspalte klappte mitten im Zug auf, das Raster rückte
      unter dem stillstehenden Zeiger weg und die Nachbartage kamen dazu — die
      Spalte hält jetzt während des Zuges an der bereits festgeschriebenen
      Auswahl fest. Und `drag` wurde beim Loslassen sofort geleert, während die
      Adresse erst mit der nächsten Transition nachzog; der Zug wird jetzt
      gehalten, bis `d` seinen neuen Wert trägt. Im Browser nachgemessen: die
      Spalte bleibt den ganzen Zug über eingeklappt, die Zelle bewegt sich um
      keinen Pixel, und ein `MutationObserver` über `.cal` sah nur einen
      einzigen Zustand — kein Zucken, keine zusätzlichen Tage.
      (Dass das Raster überhaupt mitwandert, ist nachgewiesen: bei 1600 px
      Fensterbreite verschiebt der Wechsel `dock=open`/`rail` eine Tageszelle
      um 45 px.)
- [x] **Kalender: Tagesspalte vergisst die Wahl des Benutzers.** `setCollapsed`
      merkt die Fläche jetzt als von Hand gestellt (`pinned`, auch über
      Sitzungen hinweg), und die Vermutung aus `quiet` tritt dahinter zurück.
      Geprüft: aufgeklappt, Tag gewählt, wieder abgewählt — die Spalte bleibt
      offen und zeigt „Kein Tag gewählt".
- [x] **Kuh-Symbol in der Navigation.** `components/NavIcon.tsx` zeichnet für
      `kuehe` jetzt einen Kuhkopf statt der Glocke — die Mittellinie der
      Vorlage `docs/assets/kuh-vorlage.svg`, auf 0,89 verkleinert, damit es im
      selben Feld steht wie die übrigen Zeichen. Neben der Vorlage gestellt und
      bis auf 16 Pixel heruntergeprüft: Hörner, Ohren, Kopf und Maul mit beiden
      Nüstern bleiben einzeln erkennbar.
- [x] Wortlaut der laufenden Behandlung richtiggestellt. Die Maske versprach
      eine Sperre „bis zum heutigen Gemelk"; tatsächlich sperrt die Rechnung
      bis zum letzten gemolkenen Gemelk der Kuh, also bis zum Trockenstellen
      oder Alpabtrieb. Die Rechnung bleibt, die drei Sätze sind nachgezogen.
- [x] Laufende Behandlung ohne bekanntes Ende („läuft noch", Beenden über die
      Liste). Im Browser durchgespielt: Sperre lief bis zum letzten gemolkenen
      Gemelk, nach dem Beenden auf 04.08.–09.08. zusammengezogen.
- [x] `Es ist noch keine Saison angelegt.` führt jetzt zum Anlegen (`NoSeason`).
- [x] Saisonverwaltung mit Übernahme aus einer früheren Saison. Geprüft: 22 von
      24 Kühen übernommen, schon Eingetragene fallen aus der Auswahl.
- [x] Eigener Datumswähler auf allen Masken; kein `type="date"` mehr im Baum.
- [x] `serve`-Binärdatei war veraltet und lieferte `seasonCows` nicht mit —
      neu gebaut, Einstellungen laden wieder.
