/**
 * Gemelk-Zeitachse
 * =================
 *
 * Die atomare Einheit der ganzen Anwendung ist das *Gemelk* — ein einzelner
 * Melkvorgang. Gemolken wird immer morgens und abends, also gibt es pro Tag
 * genau zwei Gemelke. Alles andere (Messungen, Sperrfristen, Trockenstellen,
 * die Halbzeit-Regel) rechnet auf dieser Achse, damit nirgends halbe Tage
 * gerundet werden müssen.
 *
 *   Gemelk-Index = Tagesnummer * 2 + (abends ? 1 : 0)
 *
 * Daraus folgt: gerader Index = morgens, ungerader Index = abends.
 *
 * Zusätzlich gibt es *Grenzen* (boundaries) auf derselben Achse. Die Grenze g
 * liegt unmittelbar vor Gemelk g. Der Anker einer Messung ist eine solche
 * Grenze — nämlich die zwischen ihren beiden Gemelken.
 */

export type Slot = "AM" | "PM";

const MS_PER_DAY = 86_400_000;

/** Tage seit 1970-01-01, aus einem ISO-Datum 'YYYY-MM-DD'. */
export function dayIndex(iso: string): number {
  const [y, m, d] = iso.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / MS_PER_DAY);
}

/** Umkehrung von dayIndex. */
export function isoFromDayIndex(day: number): string {
  return new Date(day * MS_PER_DAY).toISOString().slice(0, 10);
}

/** Index des Gemelks am gegebenen Datum zur gegebenen Tageszeit. */
export function gemelkIndex(iso: string, slot: Slot): number {
  return dayIndex(iso) * 2 + (slot === "PM" ? 1 : 0);
}

/** Umkehrung von gemelkIndex. */
export function gemelkAt(idx: number): { date: string; slot: Slot } {
  return {
    date: isoFromDayIndex(Math.floor(idx / 2)),
    slot: idx % 2 === 0 ? "AM" : "PM",
  };
}

/** Tagesnummer, zu der ein Gemelk gehört. */
export function dayOfGemelk(idx: number): number {
  return Math.floor(idx / 2);
}

export function isMorning(idx: number): boolean {
  return idx % 2 === 0;
}

/**
 * Halbzeit zwischen zwei Ankern.
 *
 * Anker sind Grenzen (ganzzahlig). Liegt die exakte Mitte auf einer Grenze,
 * ist das Ergebnis eindeutig. Liegt sie mitten in einem Gemelk (ungerader
 * Abstand), fällt dieses Gemelk der *früheren* Messung zu — die spätere
 * beginnt also erst mit dem nächsten Gemelk. Deshalb wird aufgerundet.
 *
 * Rückgabewert ist das erste Gemelk, das zur späteren Messung gehört.
 */
export function halfwayBoundary(anchorA: number, anchorB: number): number {
  return Math.ceil((anchorA + anchorB) / 2);
}

/** Anzahl Gemelke für eine in Tagen angegebene Sperrfrist. */
export function daysToGemelke(days: number): number {
  return Math.round(days * 2);
}

/** Sperrfrist in Gemelken als Tage, für die Anzeige. */
export function gemelkeToDays(gemelke: number): number {
  return gemelke / 2;
}

const SLOT_LABEL: Record<Slot, string> = { AM: "morgens", PM: "abends" };

export function slotLabel(slot: Slot): string {
  return SLOT_LABEL[slot];
}

/**
 * Die beiden Gemelke des Tages als Auswahl. Sie stehen in fast jeder Maske, und
 * überall in derselben Reihenfolge — der Morgen kommt vor dem Abend.
 */
export const SLOT_OPTIONS: { value: Slot; label: string }[] = [
  { label: SLOT_LABEL.AM, value: "AM" },
  { label: SLOT_LABEL.PM, value: "PM" },
];

/** z. B. "10.06. abends" */
export function formatGemelk(idx: number): string {
  const { date, slot } = gemelkAt(idx);
  const [, m, d] = date.split("-");
  return `${d}.${m}. ${SLOT_LABEL[slot]}`;
}

export function formatDateDe(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}.${m}.${y}`;
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/** Alle Tagesnummern von `from` bis `to` einschließlich. */
export function dayRange(fromIso: string, toIso: string): number[] {
  const out: number[] = [];
  for (let d = dayIndex(fromIso); d <= dayIndex(toIso); d++) out.push(d);
  return out;
}

/** 'YYYY-MM' eines ISO-Datums. */
export function monthOf(iso: string): string {
  return iso.slice(0, 7);
}

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

export function formatMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

/**
 * Der Monat auf drei Buchstaben — für die Tage der Nachbarmonate im Kalender,
 * wo neben der Zahl kein ganzer Name Platz hat. Auf Deutsch geht das ohne
 * Ausnahme auf: Jan, Feb, Mär … Dez.
 */
export function monthAbbr(month: string): string {
  return MONTH_NAMES[Number(month.slice(5, 7)) - 1].slice(0, 3);
}

/** Alle Monate 'YYYY-MM' zwischen zwei Daten einschließlich. */
export function monthsBetween(fromIso: string, toIso: string): string[] {
  const out: string[] = [];
  let [y, m] = fromIso.split("-").map(Number);
  const [ey, em] = toIso.split("-").map(Number);
  while (y < ey || (y === ey && m <= em)) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}
