"use client";

import { useState } from "react";

import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import { useActions } from "@/lib/data/commands";
import { useData } from "@/lib/data/store";
import { SLOT_OPTIONS } from "@/lib/gemelk";

/*
  Kühe aus einer früheren Saison übernehmen
  =========================================

  Zwischen zwei Sommern ändert sich die Herde selten stark: ein paar Kühe gehen
  ab, ein paar kommen dazu, der Rest ist derselbe. Alles noch einmal einzutragen
  wäre Abschreiben — hier steht deshalb die vorige Herde zur Auswahl, nach
  Bauern geordnet, und übernommen wird, was angehakt bleibt.

  Übernommen wird nur die Teilnahme: derselbe Auftrieb für alle, und sonst
  nichts. Messungen, Behandlungen und Abholungen bleiben beim alten Sommer.
*/

export default function CarryOverForm() {
  const { carryOverCows } = useActions();
  const { snapshot } = useData();

  const season = snapshot.season;

  const earlier = [...snapshot.seasons]
    .filter((entry) => entry.id !== season?.id)
    .sort((a, b) => b.startDate.localeCompare(a.startDate));

  const [fromId, setFromId] = useState(String(earlier[0]?.id ?? ""));
  // Wer schon dabei ist, ist nicht abgehakt, sondern gar nicht erst wählbar —
  // eine zweite Zeile für dieselbe Kuh gäbe es ohnehin nicht.
  const [dropped, setDropped] = useState<ReadonlySet<number>>(new Set());

  if (!season || earlier.length === 0) {
    return <p className="small faint">Es gibt keine frühere Saison zum Übernehmen.</p>;
  }

  const already = new Set(
    snapshot.seasonCows
      .filter((entry) => entry.seasonId === season.id)
      .map((entry) => entry.cowId),
  );
  const inSource = snapshot.seasonCows
    .filter((entry) => entry.seasonId === Number(fromId))
    .map((entry) => entry.cowId);

  const cowById = new Map(snapshot.cows.map((cow) => [cow.id, cow]));
  const farmerById = new Map(snapshot.farmers.map((farmer) => [farmer.id, farmer]));

  const candidates = inSource
    .map((id) => cowById.get(id))
    .filter((cow) => cow !== undefined)
    .sort((a, b) => {
      const farmer = (farmerById.get(a.farmerId)?.name ?? "").localeCompare(
        farmerById.get(b.farmerId)?.name ?? "",
      );
      return farmer !== 0 ? farmer : a.name.localeCompare(b.name);
    });

  const open = candidates.filter((cow) => !already.has(cow.id));
  const chosen = open.filter((cow) => !dropped.has(cow.id));

  const toggle = (id: number) => {
    setDropped((was) => {
      const next = new Set(was);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const groups: { farmerId: number; name: string; cows: typeof open }[] = [];
  for (const cow of open) {
    const last = groups.at(-1);
    if (last && last.farmerId === cow.farmerId) last.cows.push(cow);
    else
      groups.push({
        farmerId: cow.farmerId,
        name: farmerById.get(cow.farmerId)?.name ?? "ohne Bauer",
        cows: [cow],
      });
  }

  return (
    <form action={carryOverCows} className="stack-sm">
      <input type="hidden" name="seasonId" value={season.id} />
      <input type="hidden" name="fromSeasonId" value={fromId} />

      <div className="form-grid">
        <div className="field">
          <label htmlFor="fromSeasonId">Aus Saison</label>
          <Dropdown
            id="fromSeasonId"
            onChange={(next) => {
              setFromId(next);
              setDropped(new Set());
            }}
            options={earlier.map((entry) => ({
              label: entry.name,
              value: String(entry.id),
            }))}
            value={fromId}
          />
        </div>
        <DateField
          defaultValue={season.startDate}
          hint="Gilt für alle übernommenen Kühe; einzeln nachbessern geht auf der Kuhseite."
          id="carryArrival"
          label="Auftrieb"
          min={season.startDate}
          max={season.endDate}
          name="arrivalDate"
          required
        />
        <div className="field">
          <label htmlFor="carryArrivalSlot">ab Gemelk</label>
          <Dropdown
            defaultValue="AM"
            id="carryArrivalSlot"
            name="arrivalSlot"
            options={SLOT_OPTIONS}
          />
        </div>
      </div>

      {open.length === 0 ? (
        <p className="small faint">
          {candidates.length === 0
            ? "In dieser Saison war keine Kuh aufgetrieben."
            : `Alle ${candidates.length} Kühe dieser Saison sind in ${season.name} schon eingetragen.`}
        </p>
      ) : (
        <>
          <div className="row row-between">
            <p className="small faint">
              {chosen.length} von {open.length} ausgewählt
              {already.size > 0 ? ` · ${already.size} schon eingetragen` : ""}
            </p>
            <div className="row no-print">
              <button
                className="btn btn-quiet btn-sm"
                onClick={() => setDropped(new Set())}
                type="button"
              >
                alle
              </button>
              <button
                className="btn btn-quiet btn-sm"
                onClick={() => setDropped(new Set(open.map((cow) => cow.id)))}
                type="button"
              >
                keine
              </button>
            </div>
          </div>

          <div className="pick-list">
            {groups.map((group) => (
              <div key={group.farmerId}>
                <p className="pick-group">{group.name}</p>
                {group.cows.map((cow) => (
                  <label className="pick-row" key={cow.id}>
                    <input
                      checked={!dropped.has(cow.id)}
                      name="cowId"
                      onChange={() => toggle(cow.id)}
                      type="checkbox"
                      value={cow.id}
                    />
                    <span>{cow.name}</span>
                    <span className="bell">{cow.bellNumber}</span>
                  </label>
                ))}
              </div>
            ))}
          </div>
        </>
      )}

      <div className="panel-foot">
        <button className="btn-primary" disabled={chosen.length === 0} type="submit">
          {chosen.length === 1 ? "Eine Kuh übernehmen" : `${chosen.length} Kühe übernehmen`}
        </button>
      </div>
    </form>
  );
}
