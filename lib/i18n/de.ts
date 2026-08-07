/*
  Deutsch — das vollständige Wörterbuch
  =====================================

  Jeder sichtbare Satz des Programms steht hier und nirgends sonst. Die Ordnung
  folgt der Oberfläche: `common` ist, was überall vorkommt, dann je ein Zweig
  für einen Bereich. Eine weitere Sprache ist eine weitere Datei mit genau
  diesen Schlüsseln; welche das sind, hält der Typ `Dictionary` in
  `lib/i18n/index.tsx` fest.

  In den Texten steht `{name}` für einen Wert, der erst beim Anzeigen bekannt
  ist. Wo eine Anzahl den Satz verändert, stehen zwei Schlüssel `one` und
  `other` nebeneinander und `t.n(…)` wählt aus.

  Ein Text gehört ganz in einen Schlüssel. Sätze aus Stücken zusammenzusetzen
  spart hier ein paar Zeilen und kostet in jeder anderen Sprache die Wortstellung.
*/

export const de = {
  common: {
    close: "Schließen",
    cancel: "Abbrechen",
    save: "Speichern",
    delete: "Löschen",
    moment: "Einen Augenblick …",
  },

  update: {
    failed: "Das Update ist fehlgeschlagen",
    installed: "Das Update ist eingespielt",
    restartHint:
      "Bitte das Programm einmal schließen und wieder öffnen — dann läuft die neue Version.",
    preparingRestart: "Der Neustart wird vorbereitet",
    downloading: "Version {version} wird geladen",
    progressLabel: "Fortschritt des Updates",
    /** `{loaded}` und `{total}` sind fertig gerundete Zahlen. */
    loadedOf: "{loaded} von {total} MB",
    loaded: "{loaded} MB",
    ready: "Version {version} steht bereit",
    install: "Jetzt einspielen",
    later: "Später",
    skip: "Überspringen",
    checkFailed: "Das Update ließ sich nicht prüfen:",
    restartFailed: "Der Neustart nach dem Update ging nicht:",
  },
} satisfies Texts;

/**
 * Die Form, die ein Wörterbuch haben darf: verschachtelte Felder, unten
 * ausschließlich Text. `satisfies` prüft das, ohne die Schlüssel zu verlieren —
 * `typeof de` bleibt die genaue Form und nicht bloß „irgendein Wörterbuch“.
 *
 * Ohne `as const`, und das ist wichtig: die Werte sollen `string` sein und nicht
 * der eine Satz, der gerade dasteht. Sonst müsste jede weitere Sprache genau
 * dieselben deutschen Sätze enthalten, um zu ihrem Typ zu passen.
 */
type Texts = { [key: string]: string | Texts };
