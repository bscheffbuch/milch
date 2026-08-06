/*
  Masken, die einen gespeicherten Stand zeigen
  ============================================

  Ein Formularfeld ohne eigenen Zustand nimmt seine Vorgabe genau einmal: beim
  Einbau. Ändert sich der gespeicherte Stand danach, steht im Feld weiter, was
  beim Einbau dort stand — und dieselbe Sache steht an zwei Stellen desselben
  Bildschirms verschieden da.

  Nirgends fällt das so auf wie in der rechten Ablage, denn die Maske bleibt
  dort nach dem Speichern stehen. React setzt ein Formular nach einer geglückten
  Aktion außerdem von selbst zurück — auf die Vorgaben von vorher. Wer „nach dem
  Gemelk“ von abends auf morgens stellt und speichert, liest daneben in der
  Tabelle richtig „morgens“ und in der Maske wieder „abends“. Gespeichert ist
  das eine, zu sehen das andere; wer dann noch einmal auf Speichern drückt,
  schreibt den alten Wert zurück, ohne etwas geändert zu haben.

  Der Schlüssel hier ist die Antwort darauf. Er wird aus dem gespeicherten Stand
  gebildet und an das Formular gehängt: solange sich nichts ändert, bleibt er
  gleich und die Maske unangetastet — man kann in Ruhe tippen, ohne dass einem
  ein Neuaufbau dazwischenfährt. Sobald sich der Stand ändert, ist es ein
  anderer Schlüssel, und React baut die Felder mit den neuen Vorgaben auf.

  Das gilt für jede Änderung, nicht nur für die eigene: wird derselbe Eintrag
  von woanders her umgeschrieben, zieht die Maske ebenso nach.
*/

/**
 * Aus den gespeicherten Werten einen Schlüssel — gleiche Werte, gleicher
 * Schlüssel. Zusammengesetzt wird als Liste und nicht mit einem Trennzeichen:
 * ein Zeichen, das in keinem Namen und in keiner Notiz vorkommen kann, gibt es
 * nicht, und mit einem, das vorkommen kann, ergäben „ab“ + „c“ und „a“ + „bc“
 * denselben Schlüssel.
 */
export function savedKey(
  ...values: (string | number | boolean | null | undefined)[]
): string {
  return JSON.stringify(values.map((value) => value ?? null));
}
