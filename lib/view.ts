import { runEngine } from "@/lib/calc/engine";
import {
  buildFarmerBalances,
  buildMonthSummaries,
  buildSeasonTotals,
} from "@/lib/calc/report";
import type { FarmerBalance, MonthSummary, SeasonTotals } from "@/lib/calc/report";
import type { EngineResult } from "@/lib/calc/types";
import { engineInput } from "@/lib/data/select";
import type {
  CheeseProduction,
  CowSeason,
  Farmer,
  HerdCow,
  MeasurementRound,
  MeasurementValue,
  Pickup,
  Season,
  Snapshot,
  Treatment,
  TreatmentType,
} from "@/lib/data/types";
import { minIso, todayIso } from "@/lib/format";

export interface SeasonView {
  season: Season;
  /** Alle Saisons, neueste zuerst — die Einstellungen wechseln zwischen ihnen. */
  seasons: Season[];
  dbPath: string;
  /**
   * Stichtag aller Auswertungen: heute, spätestens das Saisonende. Die letzte
   * Messung gilt rechnerisch bis zum Saisonende weiter — ohne diese Grenze
   * würde eine laufende Saison hochgerechnete Milch als gemessen ausweisen.
   */
  asOf: string;
  /** Liegt heute innerhalb der Saison? */
  running: boolean;
  farmers: Farmer[];
  /** Auch die archivierten — eine Detailseite soll aufrufbar bleiben. */
  allFarmers: Farmer[];
  farmerNames: Map<number, string>;
  herd: HerdCow[];
  activeHerd: HerdCow[];
  cowNames: Map<number, HerdCow>;
  cowSeasons: CowSeason[];
  rounds: MeasurementRound[];
  values: MeasurementValue[];
  treatments: Treatment[];
  treatmentTypes: TreatmentType[];
  production: CheeseProduction[];
  productionByDate: Map<string, CheeseProduction>;
  pickups: Pickup[];
  result: EngineResult;
  totals: SeasonTotals;
  balances: FarmerBalance[];
  /** Monatsauswertung, hart am Stichtag abgeschnitten. */
  months: MonthSummary[];
  cowCountByFarmer: Map<number, number>;
  lastProductionDate: string | null;
  lastRoundDate: string | null;
}

/**
 * Rechnet den Stand der Datenschicht zur fertigen Auswertung durch.
 *
 * Die Funktion ist rein: derselbe Stand ergibt dieselbe Ansicht. Aufgerufen
 * wird sie genau einmal je Stand — der Rechenkern läuft dabei über die ganze
 * Saison, und keine Seite soll ihn ein zweites Mal anstoßen.
 *
 * Archivierte Bauern und Kühe fallen aus den Listen, bleiben in den Namens-
 * verzeichnissen aber auflösbar: in einer alten Abrechnung stünde sonst ein
 * Strich, wo ein Name hingehört.
 */
export function buildSeasonView(snapshot: Snapshot): SeasonView | null {
  const season = snapshot.season;
  if (!season) return null;

  const today = todayIso();
  const asOf = minIso(today, season.endDate);

  const farmers = snapshot.farmers.filter((farmer) => farmer.archived === 0);
  const herd = snapshot.herd.filter((cow) => cow.archived === 0).sort(byFarmerAndBell);
  const activeHerd = herd.filter((cow) => cow.cowSeasonId !== null);

  const cowCountByFarmer = new Map<number, number>();
  for (const cow of activeHerd) {
    cowCountByFarmer.set(cow.farmerId, (cowCountByFarmer.get(cow.farmerId) ?? 0) + 1);
  }

  const result = runEngine(engineInput(snapshot, season, asOf));
  const producedDays = snapshot.production.filter((entry) => entry.kg > 0);

  return {
    season,
    seasons: snapshot.seasons,
    dbPath: snapshot.dbPath,
    asOf,
    running: today >= season.startDate && today <= season.endDate,
    farmers,
    allFarmers: snapshot.farmers,
    farmerNames: new Map(snapshot.farmers.map((farmer) => [farmer.id, farmer.name])),
    herd,
    activeHerd,
    cowNames: new Map(snapshot.herd.map((cow) => [cow.id, cow])),
    cowSeasons: snapshot.cowSeasons,
    rounds: snapshot.rounds,
    values: snapshot.values,
    treatments: snapshot.treatments,
    treatmentTypes: snapshot.treatmentTypes.filter((type) => type.archived === 0),
    production: snapshot.production,
    productionByDate: new Map(snapshot.production.map((entry) => [entry.date, entry])),
    pickups: snapshot.pickups,
    result,
    totals: buildSeasonTotals(result, snapshot.pickups, asOf),
    months: buildMonthSummaries(result, asOf),
    balances: buildFarmerBalances(result, snapshot.pickups, cowCountByFarmer, asOf),
    cowCountByFarmer,
    lastProductionDate: producedDays.at(-1)?.date ?? null,
    lastRoundDate: snapshot.rounds.at(-1)?.firstDate ?? null,
  };
}

/**
 * Die Glockennummer als Zahl. Sie steht als Text in der Datenbank — es gibt
 * Glocken mit Buchstaben —, und wo keine Zahl beginnt, steht die Kuh hinten.
 */
export function bellOrder(cow: { bellNumber: string }): number {
  const value = Number.parseInt(cow.bellNumber, 10);
  return Number.isNaN(value) ? Number.MAX_SAFE_INTEGER : value;
}

/**
 * Die Ordnung der Herde: nach Hof, darin nach Glocke — und die Glocke ist eine
 * Zahl. Die Datenschicht sortiert sie als Text, weil sie dort Text ist; so
 * stünde die 110 zwischen der 10 und der 12. Wer im Melkstand von Kuh zu Kuh
 * geht, liest die Glocken aber in ihrer Zahlenfolge ab, und jede Liste der
 * Herde soll dieselbe Reihenfolge zeigen wie der Stall.
 *
 * Bei gleicher Zahl entscheidet die Glocke als Text („12a“ vor „12b“), zuletzt
 * der Name — damit zweimal dieselbe Liste auch zweimal gleich aussieht.
 */
export function byFarmerAndBell(
  a: { farmerName: string; bellNumber: string; name: string },
  b: { farmerName: string; bellNumber: string; name: string },
): number {
  return (
    a.farmerName.localeCompare(b.farmerName, "de") ||
    bellOrder(a) - bellOrder(b) ||
    a.bellNumber.localeCompare(b.bellNumber, "de") ||
    a.name.localeCompare(b.name, "de")
  );
}

/** Kurzname einer Kuh für Listen und Chips. */
export function cowLabel(cow: { bellNumber: string; name: string }): string {
  return `${cow.name} (${cow.bellNumber})`;
}
