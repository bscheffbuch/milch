/*
  Ziffern und Buchstaben
  ======================

  Zwei Felder stehen nebeneinander, und in jedes gehört nur eine Sorte Zeichen:
  in die Glockennummer Ziffern, in den Namen alles andere. Wer in der Eile im
  falschen Feld anfängt, soll den Fehler nicht rückgängig machen müssen —
  dafür muss die Maske sagen können, was von einer Eingabe wohin gehört.

  Getrennt wird zeichenweise und ohne Anspruch auf Klugheit: aus „12a“ wird
  „12“ und „a“. Der Rest behält seine Leerzeichen, sonst ließe sich in einem
  Namen kein zweites Wort anfangen.
*/

export interface Split {
  /** Alle Ziffern in ihrer Reihenfolge. */
  digits: string;
  /** Alles andere, unverändert. */
  rest: string;
}

export function splitEntry(text: string): Split {
  return { digits: text.replace(/\D/g, ""), rest: text.replace(/\d/g, "") };
}
