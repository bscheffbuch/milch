import { monthOf } from "@/lib/gemelk";

import type {
  BlockedSpan,
  CowTimeline,
  DayAllocation,
  EngineResult,
  FarmerMonthRow,
} from "./types";

export interface FarmerMonthBalance {
  month: string;
  /** Käse, der in diesem Monat angefallen ist. */
  entitledKg: number;
  /** In diesem Monat abgeholt. */
  pickedUpKg: number;
  /** Offener Stand aus den Vormonaten. */
  carryInKg: number;
  /** Was nach diesem Monat offen bleibt. */
  carryOutKg: number;
  /** Der Monat ist noch nicht zu Ende — die Zahlen sind ein Zwischenstand. */
  open: boolean;
}

export interface FarmerBalance {
  farmerId: number;
  /** Käse, der dem Bauern bis zum Stichtag zusteht — abgeschlossen und laufend. */
  entitledKg: number;
  /**
   * Was dieser Bauer vom Alpkäse trägt, im Verhältnis seines Anspruchs. Der
   * Alpkäse hat kein Datum und steht deshalb in keinem Monat — er mindert den
   * offenen Stand als Ganzes, nicht einen einzelnen Monat.
   */
  alpKg: number;
  /** Nur die abgeschlossenen Monate: der abgerechnete Anspruch. */
  settledKg: number;
  /** Was im laufenden Monat bis heute dazugekommen ist — der Schatten. */
  ghostKg: number;
  pickedUpKg: number;
  /** Positiv = steht noch aus, negativ = zu viel abgeholt. Alpkäse ist schon ab. */
  outstandingKg: number;
  /** Dasselbe, aber ohne den laufenden Monat: der abgerechnete Stand. */
  settledOutstandingKg: number;
  usableL: number;
  blockedL: number;
  cowCount: number;
  lastPickupDate: string | null;
  /** Ein Eintrag je Monat, ältester zuerst. */
  months: FarmerMonthBalance[];
  /** Der noch laufende Monat, sonst `null`. */
  openMonth: string | null;
}

export interface SeasonTotals {
  producedKg: number;
  deductionKg: number;
  /** Käse, den die Alp selbst hergegeben hat — ohne Datum, für die ganze Saison. */
  alpKg: number;
  /** Käse nach dem eingestellten Abzug, aber noch vor dem Alpkäse. */
  netCheeseKg: number;
  /** Was nach Abzug und Alpkäse zu verteilen bleibt. */
  distributableKg: number;
  unallocatedKg: number;
  usableMilkL: number;
  blockedMilkL: number;
  /** Tage mit Käseproduktion. */
  productionDays: number;
  pickedUpKg: number;
}

interface PickupLike {
  farmerId: number;
  date: string;
  kg: number;
}

/**
 * Käsekonto je Bauer, monatlich abgerechnet.
 *
 * Jeder Monat ist eine eigene Abrechnung: was in ihm angefallen ist, was in ihm
 * abgeholt wurde, und was danach offen bleibt. Der offene Rest wird als
 * Übertrag in den nächsten Monat mitgenommen — das Konto läuft also weiter,
 * aber es lässt sich Monat für Monat nachlesen.
 *
 * Der Monat, in dem der Stichtag liegt, ist noch nicht fertig. Sein Anspruch
 * steht deshalb getrennt als `ghostKg` daneben: der Zwischenstand, der bis
 * heute dazugekommen ist. `settledKg` ist, was bereits abgerechnet ist.
 *
 * Der Alpkäse fällt aus dieser Ordnung heraus: er trägt kein Datum und gehört
 * darum in keinen Monat. Er wird deshalb nicht im Kontolauf mitgeführt, sondern
 * am Ende vom offenen Stand abgezogen — jeder Bauer im Verhältnis seines
 * Anspruchs. Die Monatszeilen bleiben dadurch das, was sie sind: die Herleitung
 * des Anspruchs, unberührt davon, wann jemand einen Laib mitgenommen hat.
 */
export function buildFarmerBalances(
  result: EngineResult,
  pickups: PickupLike[],
  cowCountByFarmer: Map<number, number>,
  upToDate: string,
  alpCheeseKg = 0,
): FarmerBalance[] {
  const usable = new Map<number, number>();
  const blocked = new Map<number, number>();
  /** Anspruch und Abholungen je Bauer und Monat. */
  const entitledByMonth = new Map<string, Map<number, number>>();
  const pickedUpByMonth = new Map<string, Map<number, number>>();
  const monthKeys = new Set<string>();
  /** Monate, in denen nach dem Stichtag noch Tage liegen — die laufen noch. */
  const unfinished = new Set<string>();

  const add = (
    outer: Map<string, Map<number, number>>,
    month: string,
    farmerId: number,
    value: number,
  ) => {
    let inner = outer.get(month);
    if (!inner) outer.set(month, (inner = new Map()));
    inner.set(farmerId, (inner.get(farmerId) ?? 0) + value);
  };

  for (const day of result.byDay.values()) {
    const month = monthOf(day.date);
    if (day.date > upToDate) {
      unfinished.add(month);
      continue;
    }
    monthKeys.add(month);
    for (const row of day.perFarmer) {
      add(entitledByMonth, month, row.farmerId, row.cheeseKg);
      usable.set(row.farmerId, (usable.get(row.farmerId) ?? 0) + row.usableL);
      blocked.set(row.farmerId, (blocked.get(row.farmerId) ?? 0) + row.blockedL);
    }
  }

  const lastPickup = new Map<number, string>();
  for (const pickup of pickups) {
    if (pickup.date > upToDate) continue;
    const month = monthOf(pickup.date);
    monthKeys.add(month);
    add(pickedUpByMonth, month, pickup.farmerId, pickup.kg);
    const previous = lastPickup.get(pickup.farmerId);
    if (!previous || pickup.date > previous) lastPickup.set(pickup.farmerId, pickup.date);
  }

  const months = [...monthKeys].sort();
  // Offen ist immer nur der Monat des Stichtags, und nur solange in ihm noch
  // Tage vor der Saisonende liegen.
  const openMonth = months.at(-1) ?? null;
  const isOpen = (month: string) => month === openMonth && unfinished.has(month);

  const farmerIds = new Set<number>([
    ...[...entitledByMonth.values()].flatMap((inner) => [...inner.keys()]),
    ...[...pickedUpByMonth.values()].flatMap((inner) => [...inner.keys()]),
    ...cowCountByFarmer.keys(),
  ]);

  const balances: FarmerBalance[] = [];
  for (const farmerId of farmerIds) {
    const ledger: FarmerMonthBalance[] = [];
    let carry = 0;
    let settledKg = 0;
    let ghostKg = 0;
    let pickedUpKg = 0;
    let settledOutstandingKg = 0;

    for (const month of months) {
      const entitledKg = entitledByMonth.get(month)?.get(farmerId) ?? 0;
      const monthPickedUpKg = pickedUpByMonth.get(month)?.get(farmerId) ?? 0;
      const open = isOpen(month);
      const carryInKg = carry;
      carry = carryInKg + entitledKg - monthPickedUpKg;

      ledger.push({
        month,
        entitledKg,
        pickedUpKg: monthPickedUpKg,
        carryInKg,
        carryOutKg: carry,
        open,
      });

      pickedUpKg += monthPickedUpKg;
      if (open) {
        ghostKg += entitledKg;
        settledOutstandingKg = carryInKg;
      } else {
        settledKg += entitledKg;
        settledOutstandingKg = carry;
      }
    }

    balances.push({
      farmerId,
      entitledKg: settledKg + ghostKg,
      alpKg: 0,
      settledKg,
      ghostKg,
      pickedUpKg,
      outstandingKg: carry,
      settledOutstandingKg,
      usableL: usable.get(farmerId) ?? 0,
      blockedL: blocked.get(farmerId) ?? 0,
      cowCount: cowCountByFarmer.get(farmerId) ?? 0,
      lastPickupDate: lastPickup.get(farmerId) ?? null,
      months: ledger,
      openMonth: openMonth !== null && isOpen(openMonth) ? openMonth : null,
    });
  }

  /*
    Erst jetzt, wo alle Ansprüche stehen, lässt sich der Alpkäse aufteilen: er
    fällt auf die Bauern im Verhältnis ihres Anspruchs — wer mehr Käse zugute
    hat, trägt mehr davon. Steht noch kein Anspruch da, bleibt er liegen; es
    gäbe sonst niemanden, dem er anzurechnen wäre.
  */
  const totalEntitledKg = balances.reduce((sum, row) => sum + row.entitledKg, 0);
  if (alpCheeseKg > 0 && totalEntitledKg > 0) {
    for (const balance of balances) {
      balance.alpKg = (alpCheeseKg * balance.entitledKg) / totalEntitledKg;
      balance.outstandingKg -= balance.alpKg;
      balance.settledOutstandingKg -= balance.alpKg;
    }
  }

  balances.sort((a, b) => b.entitledKg - a.entitledKg);
  return balances;
}

export function buildSeasonTotals(
  result: EngineResult,
  pickups: PickupLike[],
  upToDate: string,
  alpCheeseKg = 0,
): SeasonTotals {
  let producedKg = 0;
  let deductionKg = 0;
  let netCheeseKg = 0;
  let unallocatedKg = 0;
  let usableMilkL = 0;
  let blockedMilkL = 0;
  let productionDays = 0;

  for (const day of result.byDay.values()) {
    if (day.date > upToDate) continue;
    producedKg += day.producedKg;
    deductionKg += day.deductionKg;
    netCheeseKg += day.netCheeseKg;
    unallocatedKg += day.unallocatedKg;
    usableMilkL += day.totalUsableL;
    blockedMilkL += day.totalBlockedL;
    if (day.producedKg > 0) productionDays++;
  }

  let pickedUpKg = 0;
  for (const pickup of pickups) {
    if (pickup.date <= upToDate) pickedUpKg += pickup.kg;
  }

  const alpKg = Math.max(0, alpCheeseKg);

  return {
    producedKg,
    deductionKg,
    alpKg,
    netCheeseKg,
    distributableKg: netCheeseKg - alpKg,
    unallocatedKg,
    usableMilkL,
    blockedMilkL,
    productionDays,
    pickedUpKg,
  };
}

export interface MonthSummary {
  month: string;
  fromDate: string;
  toDate: string;
  dayCount: number;
  producedKg: number;
  deductionKg: number;
  netCheeseKg: number;
  totalUsableL: number;
  totalBlockedL: number;
  unallocatedKg: number;
  perFarmer: FarmerMonthRow[];
}

/**
 * Monatsauswertung bis zum Stichtag. Die letzte Messung gilt rechnerisch bis
 * zum Saisonende weiter — deshalb wird hier hart abgeschnitten, damit ein
 * laufender Monat keine hochgerechnete Milch als gemessen ausweist.
 *
 * Verbindlich ist `cheeseDailyKg`, die Summe der tagesgenauen Zuteilungen.
 * `cheeseMonthlyKg` ist der Vergleichswert aus Monatskäse × Monatsanteil.
 */
export function buildMonthSummaries(
  result: EngineResult,
  upToDate: string,
): MonthSummary[] {
  const byMonth = new Map<string, DayAllocation[]>();
  for (const day of result.byDay.values()) {
    if (day.date > upToDate) continue;
    const month = monthOf(day.date);
    const bucket = byMonth.get(month);
    if (bucket) bucket.push(day);
    else byMonth.set(month, [day]);
  }

  const summaries: MonthSummary[] = [];
  for (const [month, days] of [...byMonth.entries()].sort((a, b) =>
    a[0].localeCompare(b[0]),
  )) {
    days.sort((a, b) => a.date.localeCompare(b.date));

    const usable = new Map<number, number>();
    const blocked = new Map<number, number>();
    const daily = new Map<number, number>();
    let producedKg = 0;
    let deductionKg = 0;
    let netCheeseKg = 0;
    let totalUsableL = 0;
    let totalBlockedL = 0;
    let unallocatedKg = 0;

    for (const day of days) {
      producedKg += day.producedKg;
      deductionKg += day.deductionKg;
      netCheeseKg += day.netCheeseKg;
      totalUsableL += day.totalUsableL;
      totalBlockedL += day.totalBlockedL;
      unallocatedKg += day.unallocatedKg;
      for (const row of day.perFarmer) {
        usable.set(row.farmerId, (usable.get(row.farmerId) ?? 0) + row.usableL);
        blocked.set(row.farmerId, (blocked.get(row.farmerId) ?? 0) + row.blockedL);
        daily.set(row.farmerId, (daily.get(row.farmerId) ?? 0) + row.cheeseKg);
      }
    }

    const distributable = netCheeseKg - unallocatedKg;
    const perFarmer: FarmerMonthRow[] = [...usable.keys()].map((farmerId) => {
      const usableL = usable.get(farmerId) ?? 0;
      const sharePct = totalUsableL > 0 ? usableL / totalUsableL : 0;
      return {
        farmerId,
        usableL,
        blockedL: blocked.get(farmerId) ?? 0,
        sharePct,
        cheeseDailyKg: daily.get(farmerId) ?? 0,
        cheeseMonthlyKg: distributable * sharePct,
      };
    });
    perFarmer.sort((a, b) => b.cheeseDailyKg - a.cheeseDailyKg);

    summaries.push({
      month,
      fromDate: days[0].date,
      toDate: days[days.length - 1].date,
      dayCount: days.length,
      producedKg,
      deductionKg,
      netCheeseKg,
      totalUsableL,
      totalBlockedL,
      unallocatedKg,
      perFarmer,
    });
  }

  return summaries;
}

/**
 * Kühe, deren Milch an einem Stichtag wegen Behandlung gesperrt ist.
 * Kein Eintrag heißt: nichts gesperrt — das ist der Normalfall und braucht
 * keine eigene Anzeige.
 */
export function blockedCowsOn(
  result: EngineResult,
  date: string,
): Array<{ cowId: number; farmerId: number; amBlocked: boolean; pmBlocked: boolean }> {
  const out: Array<{
    cowId: number;
    farmerId: number;
    amBlocked: boolean;
    pmBlocked: boolean;
  }> = [];
  for (const timeline of result.timelines) {
    const day = timeline.days.find((d) => d.date === date);
    if (!day) continue;
    if (!day.amBlocked && !day.pmBlocked) continue;
    out.push({
      cowId: timeline.cowId,
      farmerId: timeline.farmerId,
      amBlocked: day.amBlocked,
      pmBlocked: day.pmBlocked,
    });
  }
  return out;
}

/**
 * Milch, die in einem Sperrzeitraum verlorenging. Wird gemelkweise summiert,
 * damit auch ein Zeitraum stimmt, der mitten am Tag beginnt oder endet.
 */
export function blockedSpanL(timeline: CowTimeline, span: BlockedSpan): number {
  let sum = 0;
  for (const day of timeline.days) {
    const amIdx = day.day * 2;
    if (day.amBlocked && amIdx >= span.fromIdx && amIdx <= span.toIdx) sum += day.amL;
    if (day.pmBlocked && amIdx + 1 >= span.fromIdx && amIdx + 1 <= span.toIdx)
      sum += day.pmL;
  }
  return sum;
}

/** Tage seit der letzten Messung — für den Hinweis, dass eine fällig ist. */
export function daysSince(dateIso: string | null, todayIso: string): number | null {
  if (!dateIso) return null;
  const a = Date.parse(`${dateIso}T00:00:00Z`);
  const b = Date.parse(`${todayIso}T00:00:00Z`);
  return Math.round((b - a) / 86_400_000);
}
