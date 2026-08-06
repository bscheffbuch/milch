"use client";

import { useRef, useSyncExternalStore } from "react";

import { inTauri } from "@/lib/data/client";

/*
  Ein Feld für einen Dateipfad
  ============================

  Im Browser gibt es nichts zu wählen: die Seite darf dort keinen Pfad
  erfahren, also bleibt das Tippen. Im fertigen Programm ist das Gegenteil
  richtig — niemand tippt `/Volumes/Stick/alp-2026.db` ab, wenn der Rechner
  einen Auswahldialog hat, den man ohnehin kennt.

  Deshalb steht beides übereinander: dasselbe Feld, im Programm zusätzlich ein
  Knopf daneben. Was der Dialog zurückgibt, landet im Feld — sichtbar, prüfbar
  und weiter änderbar. Abgeschickt wird in beiden Fällen der Feldinhalt, und
  auf der anderen Seite steht dieselbe Anweisung.
*/

/** Bleibt über die Lebensdauer des Fensters gleich — es gibt nichts zu abonnieren. */
const noSubscribe = () => () => {};

export default function PathField({
  defaultFileName,
  hint,
  id,
  label,
  mode,
  name,
  placeholder,
}: {
  /** Vorschlag im Speichern-Dialog. */
  defaultFileName?: string;
  hint?: string;
  id: string;
  label: string;
  /** `save` fragt nach einem neuen Ort, `open` nach einer vorhandenen Datei. */
  mode: "open" | "save";
  name: string;
  placeholder?: string;
}) {
  const field = useRef<HTMLInputElement>(null);
  // Beim ersten Aufbau steht `false` — auf dem Server gibt es kein `window`,
  // und eine Vermutung darüber würde die Seite beim Übernehmen zerreißen.
  const native = useSyncExternalStore(noSubscribe, inTauri, () => false);

  const choose = async () => {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const filters = [{ name: "Alpabrechnung", extensions: ["db"] }];
    const picked =
      mode === "save"
        ? await dialog.save({ defaultPath: defaultFileName, filters, title: label })
        : await dialog.open({ directory: false, filters, multiple: false, title: label });

    // Abgebrochen: das Feld behält, was darin stand.
    if (typeof picked !== "string" || !field.current) return;
    field.current.value = picked;
  };

  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={native ? "field-path" : undefined}>
        <input id={id} name={name} placeholder={placeholder} ref={field} required />
        {native ? (
          <button className="btn-quiet" onClick={choose} type="button">
            Wählen …
          </button>
        ) : null}
      </div>
      {hint ? <p className="small faint">{hint}</p> : null}
    </div>
  );
}
