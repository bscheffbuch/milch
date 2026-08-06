import type { SeasonView } from "@/lib/view";
import { gemelkIndex, halfwayBoundary } from "@/lib/gemelk";

/*
  Dieselbe Sache, zwei Darstellungen: die Vorschau beim Überfahren und die
  eigene Seite beim Klicken. Damit beide dasselbe sagen, werden die Zahlen
  einmal hier abgeleitet — und nicht in jeder Darstellung neu zusammengesucht.

  Die Vorschau beantwortet nur die Frage „lohnt sich der Klick?“. Alles
  Weitere steht auf der Seite.
*/

export interface CowPreviewData {
  cowId: number;
  name: string;
  bellNumber: string;
  farmerId: number;
  farmerName: string;
  /** Kuh ist in dieser Saison gar nicht aufgetrieben. */
  offSeason: boolean;
  usableL: number;
  blockedL: number;
  perDayL: number;
  roundCount: number;
  /** Läuft am Stichtag gerade eine Sperre? */
  blockedNow: boolean;
  fromIdx: number | null;
  toIdx: number | null;
}

export interface FarmerPreviewData {
  farmerId: number;
  name: string;
  contact: string | null;
  cowCount: number;
  usableL: number;
  blockedL: number;
  /** Anteil an der verwertbaren Milch der Saison, als Bruchteil. */
  share: number;
  /** Käse aus abgeschlossenen Monaten. */
  entitledKg: number;
  outstandingKg: number;
  /** Zwischenstand des laufenden Monats — noch nicht abgerechnet. */
  ghostKg: number;
  lastPickupDate: string | null;
}

export interface RoundPreviewData {
  roundId: number;
  firstDate: string;
  firstSlot: "AM" | "PM";
  note: string | null;
  firstIdx: number;
  /** Gültigkeitsbereich auf der Gemelk-Achse, halbwegs zu den Nachbarn. */
  validFrom: number;
  validTo: number;
  cowsMeasured: number;
  cowsExpected: number;
  totalL: number;
}

export function cowPreview(view: SeasonView, cowId: number): CowPreviewData | null {
  const cow = view.cowNames.get(cowId);
  if (!cow) return null;

  const timeline = view.result.timelines.find((entry) => entry.cowId === cowId);
  const asOfIdx = gemelkIndex(view.asOf, "PM");

  return {
    cowId,
    name: cow.name,
    bellNumber: cow.bellNumber,
    farmerId: cow.farmerId,
    farmerName: view.farmerNames.get(cow.farmerId) ?? "—",
    offSeason: cow.cowSeasonId === null,
    usableL: timeline?.totalUsableL ?? 0,
    blockedL: timeline?.totalBlockedL ?? 0,
    perDayL:
      timeline && timeline.days.length > 0
        ? timeline.totalUsableL / timeline.days.length
        : 0,
    roundCount: timeline?.spans.length ?? 0,
    blockedNow:
      timeline?.blocked.some(
        (span) => span.fromIdx <= asOfIdx && span.toIdx >= asOfIdx - 1,
      ) ?? false,
    fromIdx: timeline?.fromIdx ?? null,
    toIdx: timeline?.toIdx ?? null,
  };
}

export function farmerPreview(
  view: SeasonView,
  farmerId: number,
): FarmerPreviewData | null {
  const farmer = view.farmers.find((entry) => entry.id === farmerId);
  if (!farmer) return null;

  const balance = view.balances.find((entry) => entry.farmerId === farmerId);
  const total = view.totals.usableMilkL;

  return {
    farmerId,
    name: farmer.name,
    contact: farmer.contact,
    cowCount: view.cowCountByFarmer.get(farmerId) ?? 0,
    usableL: balance?.usableL ?? 0,
    blockedL: balance?.blockedL ?? 0,
    share: total > 0 ? (balance?.usableL ?? 0) / total : 0,
    entitledKg: balance?.settledKg ?? 0,
    outstandingKg: balance?.settledOutstandingKg ?? 0,
    ghostKg: balance?.ghostKg ?? 0,
    lastPickupDate: balance?.lastPickupDate ?? null,
  };
}

export function roundPreview(view: SeasonView, roundId: number): RoundPreviewData | null {
  const index = view.rounds.findIndex((entry) => entry.id === roundId);
  if (index < 0) return null;
  const round = view.rounds[index];

  const firstIdx = gemelkIndex(round.firstDate, round.firstSlot);
  const anchor = firstIdx + 1;
  const previous = index > 0 ? view.rounds[index - 1] : null;
  const next = index < view.rounds.length - 1 ? view.rounds[index + 1] : null;

  /*
    Die erste Messung reicht bis zum Alpauftrieb zurück, die letzte bis zum
    Saisonende vor — dazwischen liegt die Grenze auf halbem Weg.
  */
  const validFrom = previous
    ? halfwayBoundary(gemelkIndex(previous.firstDate, previous.firstSlot) + 1, anchor)
    : gemelkIndex(view.season.startDate, "AM");
  const validTo = next
    ? halfwayBoundary(anchor, gemelkIndex(next.firstDate, next.firstSlot) + 1) - 1
    : gemelkIndex(view.season.endDate, "PM");

  // Nur Kühe, die zu diesem Zeitpunkt überhaupt im Melkstand standen.
  let cowsExpected = 0;
  let cowsMeasured = 0;
  let totalL = 0;
  for (const timeline of view.result.timelines) {
    if (timeline.fromIdx > firstIdx + 1 || timeline.toIdx < firstIdx) continue;
    cowsExpected += 1;
    const span = timeline.spans.find((entry) => entry.roundId === roundId);
    if (!span) continue;
    // Geschätzte Hälften zählen nicht als eigene Messung, die Menge aber schon.
    if (!span.amEstimated || !span.pmEstimated) cowsMeasured += 1;
    totalL += span.amL + span.pmL;
  }

  return {
    roundId,
    firstDate: round.firstDate,
    firstSlot: round.firstSlot,
    note: round.note,
    firstIdx,
    validFrom,
    validTo,
    cowsMeasured,
    cowsExpected,
    totalL,
  };
}
