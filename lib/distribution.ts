import type { DayAllocation } from "@/lib/calc/types";

/*
  Der Verlauf der Verteilung
  ==========================

  Wie viel Käse einem Bauern zusteht, ergibt sich Tag für Tag aus seinem Anteil
  an der an diesem Tag verwertbaren Milch. Die Abrechnung zeigt davon nur die
  Summe — und darin verschwindet gerade das, was die Bauern beschäftigt: dass
  ein Anteil über die Saison wandert, weil eine Kuh trockengestellt wird, eine
  Behandlung Milch sperrt oder eine Herde später aufgetrieben wurde.

  Diese Reihe hält deshalb beides fest: die Menge je Tag und den Anteil je Tag.
  Es ist dieselbe Zahl, einmal absolut und einmal auf die Tagessumme bezogen —
  die Grafik rechnet nichts nach, sie zeigt nur um.
*/

export interface DistributionSeries {
  /** Bauern, geordnet nach Gesamtmenge — der größte liegt im Diagramm unten. */
  farmerIds: number[];
  names: string[];
  /** Gesamtmenge je Bauer über den Zeitraum, in derselben Reihenfolge. */
  totalsL: number[];
  dates: string[];
  /** `valuesL[Bauer][Tag]` — verwertbare Milch in Litern. */
  valuesL: number[][];
  dayTotalsL: number[];
  /** Höchste Tagessumme; die Mengenachse spannt sich bis hierher. */
  maxDayL: number;
}

/**
 * Baut die Reihe aus der Tageszuteilung des Rechenkerns.
 *
 * Tage ohne verwertbare Milch am Anfang und am Ende fallen weg — vor dem
 * Auftrieb gibt es nichts zu verteilen, und ein leerer Streifen am Rand sähe
 * aus wie ein Einbruch. Fällt mittendrin ein Tag aus, behält die Fläche den
 * Anteil des Vortags: die Verteilung hat sich an diesem Tag nicht geändert,
 * sie war nur nicht messbar.
 *
 * Ohne zwei Bauern und zwei Tage gibt es keinen Verlauf zu zeigen.
 */
export function buildDistribution(
  days: Iterable<DayAllocation>,
  names: Map<number, string>,
  fromDate: string,
  toDate: string,
): DistributionSeries | null {
  const inScope = [...days]
    .filter((day) => day.date >= fromDate && day.date <= toDate)
    .sort((a, b) => a.date.localeCompare(b.date));

  const totals = new Map<number, number>();
  for (const day of inScope) {
    for (const row of day.perFarmer) {
      totals.set(row.farmerId, (totals.get(row.farmerId) ?? 0) + row.usableL);
    }
  }

  const farmerIds = [...totals.entries()]
    .filter(([, sum]) => sum > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([farmerId]) => farmerId);

  const first = inScope.findIndex((day) => day.totalUsableL > 0);
  let last = -1;
  for (let i = inScope.length - 1; i >= 0; i--) {
    if (inScope[i].totalUsableL > 0) {
      last = i;
      break;
    }
  }

  if (farmerIds.length < 2 || first < 0 || last - first < 1) return null;

  const window = inScope.slice(first, last + 1);
  const dates = window.map((day) => day.date);
  const valuesL = farmerIds.map(() => [] as number[]);
  const dayTotalsL: number[] = [];

  window.forEach((day, index) => {
    const byFarmer = new Map(day.perFarmer.map((row) => [row.farmerId, row.usableL]));
    const blank = day.totalUsableL <= 0 && index > 0;
    farmerIds.forEach((farmerId, band) => {
      valuesL[band].push(blank ? valuesL[band][index - 1] : (byFarmer.get(farmerId) ?? 0));
    });
    dayTotalsL.push(blank ? dayTotalsL[index - 1] : day.totalUsableL);
  });

  return {
    farmerIds,
    names: farmerIds.map((farmerId) => names.get(farmerId) ?? "—"),
    totalsL: farmerIds.map((farmerId) => totals.get(farmerId) ?? 0),
    dates,
    valuesL,
    dayTotalsL,
    maxDayL: Math.max(...dayTotalsL, 1),
  };
}
