"use client";

import { useState } from "react";

import DateField from "@/components/DateField";
import { useActions } from "@/lib/data/commands";
import { useData } from "@/lib/data/store";
import { dayIndex, isoFromDayIndex } from "@/lib/gemelk";

/*
  Eine neue Saison anlegen
  ========================

  Der Sommer wiederholt sich: wer schon einmal aufgetrieben hat, tut es im
  nächsten Jahr um dieselbe Zeit wieder. Deshalb steht die letzte Saison um ein
  Jahr weitergeschoben schon im Formular — ändern lässt sich alles, aber im
  Regelfall bleibt nur noch das Bestätigen übrig.
*/

/** Dasselbe Datum ein Jahr später. Der 29. Februar rückt auf den 28. */
function nextYear(iso: string): string {
  const bumped = `${Number(iso.slice(0, 4)) + 1}${iso.slice(4)}`;
  return isoFromDayIndex(dayIndex(bumped)) === bumped
    ? bumped
    : isoFromDayIndex(dayIndex(bumped) - 1);
}

export default function SeasonForm() {
  const { createSeason } = useActions();
  const { snapshot } = useData();

  // Die zuletzt angelegte Saison ist die Vorlage — nicht die gerade aktive:
  // wer eine alte Saison zum Nachschlagen aktiviert hat, will trotzdem an die
  // jüngste anschließen.
  const latest = [...snapshot.seasons]
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .at(-1);

  const suggestedStart = latest ? nextYear(latest.startDate) : "";
  const suggestedEnd = latest ? nextYear(latest.endDate) : "";
  const year = Number((suggestedStart || new Date().toISOString()).slice(0, 4));

  const [startDate, setStartDate] = useState(suggestedStart);

  return (
    <form action={createSeason} className="stack-sm">
      <div className="form-grid">
        <div className="field">
          <label htmlFor="seasonName">Name</label>
          <input
            defaultValue={latest ? `Alp ${year}` : ""}
            id="seasonName"
            name="name"
            placeholder={`Alp ${year}`}
            required
          />
        </div>
        <DateField
          defaultValue={suggestedStart}
          id="seasonStart"
          label="Alpauftrieb"
          name="startDate"
          onChange={setStartDate}
          required
        />
        <DateField
          defaultValue={suggestedEnd}
          id="seasonEnd"
          label="Alpabtrieb"
          min={startDate || undefined}
          name="endDate"
          required
        />
      </div>
      <p className="small faint">
        {latest
          ? `Vorbelegt mit ${latest.name} um ein Jahr weitergeschoben. Die neue Saison wird sofort aktiv; die Kühe lassen sich danach aus der letzten Saison übernehmen.`
          : "Die neue Saison wird sofort aktiv. Kühe bleiben über alle Saisons hinweg dieselben — zugeordnet werden sie über den Auftrieb."}
      </p>
      <div className="panel-foot">
        <button className="btn-primary" type="submit">
          Anlegen und aktivieren
        </button>
      </div>
    </form>
  );
}
