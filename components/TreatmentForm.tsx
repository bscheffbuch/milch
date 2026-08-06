"use client";

import { useState } from "react";

import CowPicker, { type CowOption } from "@/components/CowPicker";
import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import { useActions } from "@/lib/data/commands";
import { formatGemelk, gemelkIndex, SLOT_OPTIONS, type Slot } from "@/lib/gemelk";

export interface TreatmentTypeOption {
  id: number;
  name: string;
  defaultWithholdGemelke: number;
}

export type { CowOption };

/**
 * Drei Arten, eine Behandlung zu datieren: ein Gemelk, eine Reihe von Gemelken
 * mit bekanntem Ende — oder eine, die noch läuft und deren Ende erst später
 * feststeht. Der offene Fall sperrt vorsichtshalber bis zum letzten gemolkenen
 * Gemelk der Kuh; erst das Beenden setzt die Wartezeit in Gang.
 */
type TreatmentMode = "once" | "range" | "open";

const MODES: { value: TreatmentMode; label: string; hint: string }[] = [
  { value: "once", label: "einmalig", hint: "ein Gemelk" },
  { value: "range", label: "mehrere Gemelke", hint: "Ende bekannt" },
  { value: "open", label: "läuft noch", hint: "Ende offen" },
];

/**
 * Eine laufende Behandlung abschließen. Erst mit dem Ende steht fest, ab wann
 * die Wartezeit zählt — bis dahin sperrt die Behandlung bis zum aktuellen Rand.
 */
export function EndTreatmentForm({
  defaultDate,
  minDate,
  treatmentId,
}: {
  defaultDate: string;
  minDate: string;
  treatmentId: number;
}) {
  const { endTreatment } = useActions();

  return (
    <form action={endTreatment} className="stack-sm">
      <input type="hidden" name="id" value={treatmentId} />
      <div className="form-grid">
        <DateField
          defaultValue={defaultDate < minDate ? minDate : defaultDate}
          id={`endDate-${treatmentId}`}
          label="letzte Behandlung am"
          min={minDate}
          name="endDate"
          required
        />
        <div className="field">
          <label htmlFor={`endSlot-${treatmentId}`}>Gemelk</label>
          <Dropdown
            defaultValue="PM"
            id={`endSlot-${treatmentId}`}
            name="endSlot"
            options={SLOT_OPTIONS}
          />
        </div>
      </div>
      <p className="small faint">
        Die Wartezeit zählt ab diesem Gemelk und schließt es ein.
      </p>
      <div className="panel-foot">
        <button className="btn-primary" type="submit">
          Behandlung beenden
        </button>
      </div>
    </form>
  );
}

/**
 * Behandlung eintragen. Die Sperrfrist zählt ab dem letzten Behandlungsgemelk
 * und schließt dieses ein — die Vorschau zeigt beim Tippen, welche Gemelke
 * tatsächlich ausfallen, damit die Eingabe nicht blind erfolgt.
 */
export default function TreatmentForm({
  seasonId,
  cows,
  cowId,
  types,
  defaultDate,
}: {
  seasonId: number;
  cows?: CowOption[];
  cowId?: number;
  types: TreatmentTypeOption[];
  defaultDate: string;
}) {
  const { createTreatment } = useActions();
  const [typeId, setTypeId] = useState<string>(types[0] ? String(types[0].id) : "");
  const [unit, setUnit] = useState<"gemelke" | "days">("gemelke");
  const [withhold, setWithhold] = useState<string>(
    types[0] ? String(types[0].defaultWithholdGemelke) : "0",
  );
  const [startDate, setStartDate] = useState(defaultDate);
  const [startSlot, setStartSlot] = useState<Slot>("AM");
  const [mode, setMode] = useState<TreatmentMode>("once");
  const [endDate, setEndDate] = useState(defaultDate);
  const [endSlot, setEndSlot] = useState<Slot>("PM");

  const onType = (value: string) => {
    setTypeId(value);
    const type = types.find((entry) => String(entry.id) === value);
    if (type) {
      setUnit("gemelke");
      setWithhold(String(type.defaultWithholdGemelke));
    }
  };

  const parsed = Number(withhold.replace(",", "."));
  const gemelke = Number.isFinite(parsed)
    ? Math.max(0, Math.round(unit === "days" ? parsed * 2 : parsed))
    : 0;

  const lastIdx =
    mode === "range" ? gemelkIndex(endDate, endSlot) : gemelkIndex(startDate, startSlot);
  const firstIdx = gemelkIndex(startDate, startSlot);
  const valid = Number.isFinite(firstIdx) && lastIdx >= firstIdx;

  // Gesperrt ist alles vom ersten Behandlungsgemelk bis zum Ablauf der
  // Wartezeit, die ab dem letzten Behandlungsgemelk zählt und es einschließt.
  const blockedTo = lastIdx + gemelke - 1;
  const preview =
    !valid || !startDate
      ? null
      : mode === "open"
        ? `Gesperrt ab ${formatGemelk(firstIdx)} — und bis auf Weiteres jedes ` +
          "weitere Gemelk. " +
          (gemelke === 0
            ? "Ohne Wartezeit endet die Sperre mit dem Ende der Behandlung."
            : `Nach dem Beenden kommen ${gemelke} Gemelke Wartezeit dazu.`)
        : gemelke === 0
          ? "Keine Wartezeit — die Milch bleibt verwertbar."
          : `Gesperrt von ${formatGemelk(firstIdx)} bis ${formatGemelk(blockedTo)} — ` +
            `${blockedTo - firstIdx + 1} Gemelke, ab ${formatGemelk(blockedTo + 1)} wieder verwertbar.`;

  return (
    <form action={createTreatment} className="stack-sm">
      <input type="hidden" name="seasonId" value={seasonId} />
      {cowId ? <input type="hidden" name="cowId" value={cowId} /> : null}

      <div className="form-grid">
        {cows ? <CowPicker cows={cows} /> : null}

        <div className="field">
          <label htmlFor="typeId">Behandlung</label>
          <Dropdown
            id="typeId"
            name="typeId"
            onChange={onType}
            options={[
              { label: "eigene Angabe", value: "" },
              ...types.map((type) => ({ label: type.name, value: String(type.id) })),
            ]}
            value={typeId}
          />
        </div>

        {typeId === "" ? (
          <div className="field">
            <label htmlFor="label">Bezeichnung</label>
            <input id="label" name="label" placeholder="z. B. Eutertube" />
          </div>
        ) : null}

        <DateField
          defaultValue={startDate}
          id="startDate"
          label="Behandlung am"
          name="startDate"
          onChange={setStartDate}
          required
        />

        <div className="field">
          <label htmlFor="startSlot">Gemelk</label>
          <Dropdown
            id="startSlot"
            name="startSlot"
            onChange={(next) => setStartSlot(next as Slot)}
            options={SLOT_OPTIONS}
            value={startSlot}
          />
        </div>

        <div className="field">
          <label htmlFor="withhold">Wartezeit</label>
          <input
            id="withhold"
            name="withhold"
            type="number"
            step={unit === "days" ? "0.5" : "1"}
            min="0"
            value={withhold}
            onChange={(event) => setWithhold(event.target.value)}
          />
        </div>

        <div className="field">
          <label htmlFor="unit">Einheit</label>
          <Dropdown
            id="unit"
            name="unit"
            onChange={(next) => setUnit(next as "gemelke" | "days")}
            options={[
              { label: "Gemelke", value: "gemelke" },
              { label: "Tage", value: "days" },
            ]}
            value={unit}
          />
        </div>
      </div>

      <input type="hidden" name="mode" value={mode} />
      <div className="field">
        <label id="treatment-mode">Dauer</label>
        <div aria-labelledby="treatment-mode" className="wahl" role="group">
          {MODES.map((entry) => (
            <button
              aria-pressed={mode === entry.value}
              key={entry.value}
              onClick={() => setMode(entry.value)}
              title={entry.hint}
              type="button"
            >
              {entry.label}
            </button>
          ))}
        </div>
      </div>

      {mode === "range" ? (
        <div className="form-grid">
          <DateField
            defaultValue={endDate}
            id="endDate"
            label="letzte Behandlung am"
            min={startDate}
            name="endDate"
            onChange={setEndDate}
          />
          <div className="field">
            <label htmlFor="endSlot">Gemelk</label>
            <Dropdown
              id="endSlot"
              name="endSlot"
              onChange={(next) => setEndSlot(next as Slot)}
              options={SLOT_OPTIONS}
              value={endSlot}
            />
          </div>
        </div>
      ) : null}

      {mode === "open" ? (
        <p className="small faint">
          Die Behandlung bleibt ohne Ende eingetragen und sperrt vorsichtshalber jedes
          weitere Gemelk — bis zum Trockenstellen, sonst bis zum Alpabtrieb. Sobald sie
          abgeschlossen ist, lässt sie sich in der Liste beenden; erst dann steht fest, ab
          wann die Wartezeit läuft und wann die Milch wieder zählt.
        </p>
      ) : null}

      <div className="field">
        <label htmlFor="note">Notiz</label>
        <input id="note" name="note" placeholder="optional" />
      </div>

      {preview ? (
        <p className={gemelke > 0 ? "notice notice-blocked" : "notice"}>{preview}</p>
      ) : null}

      <div className="panel-foot">
        <button className="btn-primary" type="submit">
          Behandlung eintragen
        </button>
      </div>
    </form>
  );
}
