/*
  Adressen der Detailansichten
  ============================

  Jede Kuh, jeder Bauer und jede Messung hat weiterhin eine eigene Adresse, die
  sich merken und wieder aufrufen lässt. Die Kennung steht dabei in der Abfrage
  und nicht im Pfad: das fertige Programm liefert seine Seiten als Dateien aus,
  und dafür müsste jede mögliche Kennung schon beim Bauen bekannt sein.

  Der Schrägstrich am Ende gehört dazu — so findet der Dateiausleser des
  Programms die Seite auch nach einem harten Neuladen.
*/
import { serializeSelection } from "@/lib/selection";

export function farmerHref(id: number): string {
  return `/bauern/?id=${id}`;
}

export function cowHref(id: number): string {
  return `/kuehe/?id=${id}`;
}

export function roundHref(id: number): string {
  return `/messung/?id=${id}`;
}

/**
 * Kalender mit Monat und ausgewählten Tagen. Ohne Angabe bleibt `d` weg und
 * der Kalender wählt den Stichtag; eine leere Liste schreibt `d=` und meint
 * damit ausdrücklich: nichts ausgewählt.
 */
export function calendarHref(month: string, dates?: string[]): string {
  if (dates === undefined) return `/kalender/?m=${month}`;
  return `/kalender/?m=${month}&d=${serializeSelection(dates)}`;
}

export function billingHref(month: string): string {
  return `/abrechnung/?m=${month}`;
}

/** Kennung aus der Adresse, oder null wenn die Liste gemeint ist. */
export function idFrom(params: { get: (key: string) => string | null }): number | null {
  const raw = params.get("id");
  if (raw === null) return null;
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}
