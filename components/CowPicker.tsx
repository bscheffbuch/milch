"use client";

import { useMemo, useState } from "react";

import Dropdown, { type DropdownOption } from "@/components/Dropdown";
import { bellOrder } from "@/lib/view";

export interface CowOption {
  id: number;
  name: string;
  bellNumber: string;
  farmerId: number;
  farmerName: string;
}

/*
  Erst der Hof, dann das Tier — aber in einer Liste
  ================================================

  Auf der Alp stehen die Kühe mehrerer Höfe nebeneinander, und wer eine
  Behandlung einträgt, weiß immer zuerst, bei wessen Kuh er steht. Eine einzige
  Liste über alle Höfe zwänge ihn, den einen Namen zwischen hundert fremden zu
  suchen; nach dem Hof bleibt ein Dutzend übrig, und das überblickt man.

  Der Weg über den Hof bleibt deshalb, aber er hat kein eigenes Feld mehr.
  Vorher standen drei Kästen untereinander — Bauer, Suchfeld, Kuh —, und zwei
  davon waren leer oder tot, solange der erste nicht beantwortet war. Jetzt
  steht ein Feld da, und alles Weitere geschieht in der aufgeklappten Liste:
  oben die Höfe, ein Antippen führt hinein, darüber sucht man jederzeit.

  Wer tippt, überspringt den Hof: die Suche greift dann über alle Höfe und
  schreibt den Namen des Hofs als Zwischenüberschrift darüber. Man kennt seine
  Kuh beim Namen, nicht bei der Zugehörigkeit — und wer sie so findet, soll
  nicht erst einen Umweg gehen müssen. Gibt es nur einen Hof, entfällt der
  Schritt ganz; eine Auswahl ohne Wahl ist keine.

  Der Bauer wird nicht mitgeschickt: die Kuh weiß selbst, wem sie gehört.
*/

export default function CowPicker({ cows }: { cows: CowOption[] }) {
  const farmers = useMemo(() => {
    const byId = new Map<number, { id: number; name: string; count: number }>();
    for (const cow of cows) {
      const seen = byId.get(cow.farmerId);
      if (seen) seen.count += 1;
      else byId.set(cow.farmerId, { id: cow.farmerId, name: cow.farmerName, count: 1 });
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [cows]);

  const [farmerId, setFarmerId] = useState(
    farmers.length === 1 ? String(farmers[0].id) : "",
  );
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState("");

  const needle = query.trim().toLowerCase();
  // Gesucht wird im Namen und in der Glocke: welches von beiden einem gerade
  // einfällt, weiß man vorher nicht.
  const matches = (cow: CowOption) =>
    needle === "" ||
    cow.name.toLowerCase().includes(needle) ||
    cow.bellNumber.toLowerCase().includes(needle);

  const cowRow = (cow: CowOption, group?: string): DropdownOption => ({
    group,
    hint: cow.bellNumber,
    label: cow.name,
    value: String(cow.id),
  });

  const options: DropdownOption[] = [];

  if (farmerId === "" && needle === "" && farmers.length > 1) {
    // Erster Schritt: die Höfe. Die Zahl dahinter sagt, was einen erwartet.
    for (const farmer of farmers) {
      options.push({
        hint: `${farmer.count} ${farmer.count === 1 ? "Kuh" : "Kühe"}`,
        label: farmer.name,
        onStep: () => {
          setFarmerId(String(farmer.id));
          setQuery("");
        },
        value: `bauer-${farmer.id}`,
      });
    }
  } else if (farmerId === "") {
    // Getippt wird über alle Höfe; der Hof steht dann als Überschrift darüber.
    for (const farmer of farmers) {
      for (const cow of cows
        .filter((entry) => entry.farmerId === farmer.id && matches(entry))
        .sort((a, b) => bellOrder(a) - bellOrder(b))) {
        options.push(cowRow(cow, farmer.name));
      }
    }
  } else {
    const farmer = farmers.find((entry) => String(entry.id) === farmerId);
    if (farmers.length > 1) {
      options.push({
        label: "anderer Bauer",
        onStep: () => {
          setFarmerId("");
          setQuery("");
        },
        value: "zurueck",
      });
    }
    for (const cow of cows
      .filter((entry) => String(entry.farmerId) === farmerId && matches(entry))
      .sort((a, b) => bellOrder(a) - bellOrder(b))) {
      options.push(cowRow(cow, farmer?.name));
    }
  }

  const chosen = cows.find((cow) => String(cow.id) === picked);

  return (
    <div className="field">
      <label htmlFor="cowId">Kuh</label>
      <Dropdown
        display={chosen ? cowRow(chosen) : undefined}
        empty={
          needle !== ""
            ? `Keine Kuh passt zu „${query.trim()}“.`
            : "Von diesem Bauern ist keine Kuh auf der Alp."
        }
        id="cowId"
        name="cowId"
        onChange={setPicked}
        onSearch={setQuery}
        options={options}
        placeholder={farmers.length > 1 && farmerId === "" ? "Bauer oder Kuh" : "wählen"}
        required
        search={query}
        searchPlaceholder="Name oder Glocke"
        value={picked}
      />
    </div>
  );
}
