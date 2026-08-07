"use client";

import { useState } from "react";

/*
  Nachsehen und Ändern sind zweierlei
  ===================================

  Die meisten Masken werden aufgemacht, um etwas nachzusehen: wann die Kuh
  aufgetrieben wurde, wie der Bauer heißt, welcher Tag zur Messung gehört. Steht
  dabei alles offen, genügt ein Anschlag daneben, um einen Wert umzuschreiben,
  ohne dass es einem auffällt — und gespeichert wird beim nächsten Klick auf
  „Speichern“ mit.

  Deshalb liegt jede Änderungsmaske zu, bis man sie ausdrücklich aufsperrt. Das
  besorgt ein `fieldset`, denn ein abgeschaltetes `fieldset` schaltet alles ab,
  was darin steht — Felder, Datumswähler und die Schaltfläche zum Speichern
  gleich mit. Zugesperrt lässt sich nichts eintippen und nichts absenden, auch
  nicht mit der Tastatur.

  Der Schalter steht über der Maske und nicht darin: er soll aufsperren und
  nicht selbst mit abgesperrt sein. Zugesperrt ist die Maske ruhiger gezeichnet
  als offen — man sieht ihr an, in welchem der beiden Zustände sie ist, ohne
  erst hineinzufassen.

  Nach dem Speichern soll wieder zu sein. Dafür sorgt der Aufrufer: er hängt
  denselben Schlüssel an, mit dem er auch die Maske am gespeicherten Stand hält
  (`lib/formular.ts`). Ändert sich der Stand, wird beides neu gebaut — die
  Felder mit den frischen Vorgaben und der Schalter in Ruhestellung.
*/

export function Aenderbar({
  /**
   * Woran, im Wenfall: „die Stammdaten“, „den Auftrieb“. Steht nur in der
   * Vorlesefassung des Schalters, damit „Ändern“ auch ohne die Maske daneben
   * etwas heißt.
   */
  was,
  children,
}: {
  was: string;
  children: React.ReactNode;
}) {
  const [frei, setFrei] = useState(false);

  return (
    <div className={frei ? "gate is-frei" : "gate"}>
      <label className="inline gate-schalter">
        <input
          aria-label={`${was} ändern`}
          checked={frei}
          onChange={(event) => setFrei(event.target.checked)}
          type="checkbox"
        />
        <span>Ändern</span>
        <span className="faint small gate-stand">
          {frei ? "freigegeben" : "nur zum Nachsehen"}
        </span>
      </label>
      <fieldset className="gate-feld" disabled={!frei}>
        {children}
      </fieldset>
    </div>
  );
}
