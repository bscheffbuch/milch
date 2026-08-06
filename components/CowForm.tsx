"use client";

import Link from "next/link";
import { useRef, useState } from "react";

import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import { useActions } from "@/lib/data/commands";
import { splitEntry } from "@/lib/eingabe";
import { SLOT_OPTIONS, type Slot } from "@/lib/gemelk";

/*
  Kühe eintragen, eine nach der anderen
  =====================================

  Beim Auftrieb steht einer am Gatter und trägt zwanzig Kühe hintereinander
  ein. Fast alles ist dabei zwanzigmal dasselbe: derselbe Hof, derselbe Tag,
  dasselbe Gemelk — es wechseln nur Glocke und Name. Darum bleibt hier stehen,
  was gleich bleibt, und geleert wird nur, was jede Kuh für sich hat.

  Stehen bleibt es auch über das Schließen der Maske hinaus: die Fläche wird
  beim Zuklappen abgeräumt, ihr Zustand verginge also mit ihr. Was gepinnt ist,
  liegt deshalb im Speicher des Browsers und überdauert selbst den Feierabend.
  Verändert wird es wie jedes andere Feld — die Änderung ist dann die neue
  Vorgabe, angehalten wird nichts.

  Die beiden wechselnden Felder halten sich sauber: in die Glocke gehören
  Ziffern, in den Namen Buchstaben. Wer eine Zeile zu früh tippt, soll das
  nicht bemerken müssen — was ins falsche Feld gerät, wandert ins richtige,
  und der Schreibstrich wandert mit.
*/

/** Was zwischen zwei Kühen stehen bleibt, unter diesem Namen abgelegt. */
const PIN = "kuh-neu:";

function readPin(what: string): string {
  try {
    return localStorage.getItem(PIN + what) ?? "";
  } catch {
    return "";
  }
}

function savePin(what: string, value: string): void {
  try {
    localStorage.setItem(PIN + what, value);
  } catch {
    // Ohne Speicher gilt die Vorgabe eben nur für diese Sitzung.
  }
}

export default function CowForm({
  endDate,
  farmers,
  seasonId,
  startDate,
}: {
  endDate: string;
  farmers: { id: number; name: string }[];
  seasonId: number;
  startDate: string;
}) {
  const { createCow } = useActions();

  const [bell, setBell] = useState("");
  const [name, setName] = useState("");

  /*
    Gepinnt ist nur, was auch heute noch gilt: ein Bauer, den es nicht mehr
    gibt, und ein Tag außerhalb der Saison sind keine Vorgabe, sondern ein
    Fehler von vorletzter Woche. In dem Fall steht wieder die Voreinstellung da.
  */
  const [farmerId, setFarmerId] = useState(() => {
    const pinned = readPin("farmerId");
    return farmers.some((farmer) => String(farmer.id) === pinned) ? pinned : "";
  });
  const [slot, setSlot] = useState<Slot>(() =>
    readPin("arrivalSlot") === "PM" ? "PM" : "AM",
  );
  const [date] = useState(() => {
    const pinned = readPin("arrivalDate");
    return pinned >= startDate && pinned <= endDate ? pinned : startDate;
  });

  const bellField = useRef<HTMLInputElement>(null);
  const nameField = useRef<HTMLInputElement>(null);

  const typeBell = (text: string) => {
    const { digits, rest } = splitEntry(text);
    setBell(digits);
    // Buchstaben in der Glocke sind der Name, eine Zeile zu früh getippt —
    // aber nur, solange dort noch nichts steht: einen geschriebenen Namen
    // überschreibt kein Tippfehler.
    const spill = rest.trim();
    if (spill !== "" && name === "") {
      setName(spill);
      nameField.current?.focus();
    }
  };

  const typeName = (text: string) => {
    const { digits, rest } = splitEntry(text);
    setName(rest);
    if (digits !== "" && bell === "") {
      setBell(digits);
      bellField.current?.focus();
    }
  };

  /*
    Nach dem Hinzufügen steht der Schreibstrich wieder in der Glocke der
    nächsten Kuh. Geleert wird von Hand, und zwar nur Glocke und Name — das
    Übrige soll ja stehen bleiben.
  */
  const add = async (data: FormData) => {
    await createCow(data);
    setBell("");
    setName("");
    bellField.current?.focus();
  };

  return (
    <form
      action={add}
      className="stack-sm"
      /*
        React räumt hinter einer erfolgreichen Formularaktion selbst auf und
        stellt jedes Feld auf seine Vorgabe zurück. Hier wäre das genau
        verkehrt: die gepinnten Felder sollen stehen bleiben, und ein
        Auswahlfeld fiele dabei auf seinen ersten Eintrag zurück, während der
        Zustand daneben weiter den gewählten hielte — abgeschickt würde dann
        etwas anderes, als dasteht. Also wird das Aufräumen abgelehnt; was zu
        leeren ist, leert die Aktion oben von Hand.
      */
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="seasonId" value={seasonId} />
      <div className="form-grid">
        <div className="field">
          <label htmlFor="bellNumber">Glockennummer</label>
          <input
            autoComplete="off"
            className="num"
            id="bellNumber"
            inputMode="numeric"
            name="bellNumber"
            onChange={(event) => typeBell(event.target.value)}
            ref={bellField}
            required
            value={bell}
          />
        </div>
        <div className="field">
          <label htmlFor="name">Name</label>
          <input
            autoComplete="off"
            id="name"
            name="name"
            onChange={(event) => typeName(event.target.value)}
            ref={nameField}
            required
            value={name}
          />
        </div>
        <div className="field">
          <label htmlFor="farmerId">Bauer</label>
          <Dropdown
            id="farmerId"
            name="farmerId"
            onChange={(next) => {
              setFarmerId(next);
              savePin("farmerId", next);
            }}
            options={farmers.map((farmer) => ({
              label: farmer.name,
              value: String(farmer.id),
            }))}
            required
            value={farmerId}
          />
        </div>
        <DateField
          defaultValue={date}
          id="arrivalDate"
          label="Auftrieb"
          name="arrivalDate"
          onChange={(iso) => {
            // Ein halb getipptes Datum ist noch keine Vorgabe.
            if (iso !== "") savePin("arrivalDate", iso);
          }}
        />
        <div className="field">
          <label htmlFor="arrivalSlot">ab Gemelk</label>
          <Dropdown
            id="arrivalSlot"
            name="arrivalSlot"
            onChange={(next) => {
              setSlot(next as Slot);
              savePin("arrivalSlot", next);
            }}
            options={SLOT_OPTIONS}
            value={slot}
          />
        </div>
      </div>
      {farmers.length === 0 ? (
        <p className="small faint">
          <Link href="/bauern/">Zuerst einen Bauern anlegen</Link>
        </p>
      ) : null}
      <p className="small faint">
        Bauer, Auftrieb und Gemelk bleiben für die nächste Kuh stehen.
      </p>
      <div className="panel-foot">
        <button className="btn-primary" type="submit">
          Hinzufügen
        </button>
      </div>
    </form>
  );
}
