/*
  Tagesauswahl im Kalender
  ========================

  Welche Tage ausgewählt sind, steht in der Adresse — ein Zeitraum lässt sich
  so weiterreichen und wiederfinden. Aufeinanderfolgende Tage werden dabei zu
  `von..bis` zusammengezogen; sonst stünden bei einem ganzen Monat dreißig
  Datumsangaben in der Zeile.

  Drei Zustände sind zu unterscheiden:

    kein `d` in der Adresse   der Stichtag ist gemeint (Voreinstellung)
    `d=` leer                 ausdrücklich nichts ausgewählt
    `d=…`                     die aufgezählten Tage
*/
import { dayIndex, isoFromDayIndex } from "@/lib/gemelk";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function parseSelection(raw: string): string[] {
  const out = new Set<string>();

  for (const token of raw.split(",")) {
    const [from, to] = token.split("..");
    if (!ISO.test(from)) continue;
    if (to === undefined) {
      out.add(from);
      continue;
    }
    if (!ISO.test(to)) continue;
    for (const date of datesBetween(from, to)) out.add(date);
  }

  return [...out].sort();
}

export function serializeSelection(dates: string[]): string {
  const parts: string[] = [];

  for (const run of selectionRuns(dates)) {
    // Zwei benachbarte Tage bleiben aufgezählt — `a,b` ist nicht länger als
    // `a..b` und liest sich als das, was es ist.
    if (run.to - run.from > 1) {
      parts.push(`${isoFromDayIndex(run.from)}..${isoFromDayIndex(run.to)}`);
    } else {
      for (let day = run.from; day <= run.to; day++) parts.push(isoFromDayIndex(day));
    }
  }

  return parts.join(",");
}

/** Alle Tage von einem Datum zum anderen, in beliebiger Reihenfolge angegeben. */
export function datesBetween(a: string, b: string): string[] {
  const from = Math.min(dayIndex(a), dayIndex(b));
  const to = Math.max(dayIndex(a), dayIndex(b));
  return Array.from({ length: to - from + 1 }, (_, i) => isoFromDayIndex(from + i));
}

/** Einen Tag hinzufügen oder wegnehmen — für das Anklicken mit Befehlstaste. */
export function toggleDate(dates: string[], date: string): string[] {
  return dates.includes(date)
    ? dates.filter((entry) => entry !== date)
    : [...dates, date].sort();
}

/**
 * Zusammenhängende Abschnitte einer Auswahl. Der Kalender zeichnet um jeden
 * einen durchgehenden Rahmen, statt jeden Tag einzeln einzufassen — sonst
 * zerschnitte die Auswahl die Balken, die über sie hinweglaufen.
 */
export function selectionRuns(dates: string[]): Array<{ from: number; to: number }> {
  const sorted = [...new Set(dates)].map(dayIndex).sort((a, b) => a - b);
  const runs: Array<{ from: number; to: number }> = [];

  for (const day of sorted) {
    const last = runs[runs.length - 1];
    if (last && day === last.to + 1) last.to = day;
    else runs.push({ from: day, to: day });
  }

  return runs;
}
