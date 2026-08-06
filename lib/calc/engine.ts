import {
  dayIndex,
  dayOfGemelk,
  gemelkIndex,
  halfwayBoundary,
  isoFromDayIndex,
  monthOf,
  monthsBetween,
} from "@/lib/gemelk";
import type {
  BlockedSpan,
  CowDay,
  CowInput,
  CowRound,
  CowTimeline,
  DayAllocation,
  EngineInput,
  EngineResult,
  FarmerDayShare,
  FarmerMonthRow,
  MonthReport,
  RoundSpan,
} from "./types";

const DEFAULT_AM_SHARE = 0.55;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

/**
 * Morgen- und Abendwert einer Messung — unabhängig davon, ob sie morgens oder
 * abends begonnen hat. Beginnt sie abends, gehört der erste Wert zum Abend des
 * einen Tages und der zweite zum Morgen des Folgetages.
 */
export function splitRound(round: CowRound): {
  amL: number | null;
  pmL: number | null;
} {
  return round.first.slot === "AM"
    ? { amL: round.firstL, pmL: round.secondL }
    : { amL: round.secondL, pmL: round.firstL };
}

/**
 * Anteil des Morgengemelks an der Tagesmenge, gemittelt über alle
 * vollständigen Messungen der Herde. Wird nur gebraucht, um bei einer halb
 * ausgefallenen Messung den fehlenden Wert zu schätzen.
 */
export function computeAmShare(cows: CowInput[], fallback = DEFAULT_AM_SHARE): number {
  let am = 0;
  let total = 0;
  for (const cow of cows) {
    for (const round of cow.rounds) {
      const { amL, pmL } = splitRound(round);
      if (amL == null || pmL == null) continue;
      if (amL + pmL <= 0) continue;
      am += amL;
      total += amL + pmL;
    }
  }
  return total > 0 ? clamp(am / total, 0.05, 0.95) : clamp(fallback, 0.05, 0.95);
}

function findSpan(spans: RoundSpan[], idx: number): RoundSpan | null {
  for (const span of spans) {
    if (idx >= span.fromIdx && idx <= span.toIdx) return span;
  }
  return null;
}

function isBlocked(blocked: BlockedSpan[], idx: number): boolean {
  for (const span of blocked) {
    if (idx >= span.fromIdx && idx <= span.toIdx) return true;
  }
  return false;
}

/**
 * Sperrzeiträume einer Kuh, zusammengefasst.
 *
 * Eine Behandlung sperrt ab ihrem ersten Gemelk bis `withholdGemelke` Gemelke
 * nach dem *letzten* Behandlungsgemelk — dieses zählt mit. Überlappende oder
 * direkt aneinandergrenzende Zeiträume werden zu einem Balken verschmolzen.
 */
export function buildBlockedSpans(
  cow: CowInput,
  /**
   * Bis wohin eine Behandlung ohne festes Ende sperrt: das heutige Gemelk,
   * höchstens das letzte, das die Kuh überhaupt gibt. Weiter zu sperren hieße,
   * über eine Behandlung zu urteilen, die noch gar nicht stattgefunden hat —
   * eine abgeschlossene Wartezeit darf dagegen sehr wohl in die Zukunft reichen.
   * Ohne Angabe hört die Sperre nie auf; das braucht nur, wer die Sperren ohne
   * Zeitachse betrachtet.
   */
  openEndIdx = Number.POSITIVE_INFINITY,
): BlockedSpan[] {
  const raw = cow.treatments
    .map((t) => {
      const a = gemelkIndex(t.start.date, t.start.slot);
      const open = t.end === null;
      const b = t.end === null ? openEndIdx : gemelkIndex(t.end.date, t.end.slot);
      const start = Math.min(a, b);
      const end = Math.max(a, b);
      const withhold = Math.max(0, t.withholdGemelke);
      return {
        fromIdx: start,
        /*
          Bei einer laufenden Behandlung hat die Wartezeit noch gar nicht
          begonnen — sie zählt ab dem letzten Behandlungsgemelk, und das ist
          noch nicht gegeben. Gesperrt ist deshalb schlicht alles, was kommt.
          Ohne Wartezeit sperrt auch das Laufende nichts: eine Klauenpflege
          macht die Milch nicht schlechter, so lange sie auch dauert.
        */
        toIdx: withhold === 0 && open ? start - 1 : open ? end : end + withhold - 1,
        open,
        labels: [t.label],
        treatmentIds: [t.treatmentId],
      };
    })
    .filter((s) => s.toIdx >= s.fromIdx)
    .sort((a, b) => a.fromIdx - b.fromIdx);

  const merged: BlockedSpan[] = [];
  for (const span of raw) {
    const last = merged[merged.length - 1];
    if (last && span.fromIdx <= last.toIdx + 1) {
      // Offen ist der verschmolzene Zeitraum, wenn sein Ende von einer noch
      // laufenden Behandlung stammt — nicht schon, wenn irgendeine läuft.
      if (span.toIdx > last.toIdx) {
        last.toIdx = span.toIdx;
        last.open = span.open;
      } else if (span.toIdx === last.toIdx) {
        last.open = last.open || span.open;
      }
      last.labels.push(...span.labels);
      last.treatmentIds.push(...span.treatmentIds);
    } else {
      merged.push({
        ...span,
        labels: [...span.labels],
        treatmentIds: [...span.treatmentIds],
      });
    }
  }
  return merged;
}

/**
 * Gültigkeitsbereiche der Messungen einer Kuh nach der Halbzeit-Regel.
 *
 * Jede Messung gilt von der Mitte zur vorherigen bis zur Mitte zur nächsten
 * Messung. Die erste Messung wird rückwirkend bis zum Auftrieb ausgedehnt, die
 * letzte bis zum Trockenstellen bzw. Abtrieb — es entstehen also keine Lücken.
 */
export function buildRoundSpans(
  cow: CowInput,
  fromIdx: number,
  toIdx: number,
  amShare: number,
): RoundSpan[] {
  const anchored = cow.rounds
    .map((round) => {
      const { amL, pmL } = splitRound(round);
      if (amL == null && pmL == null) return null;
      let am = amL;
      let pm = pmL;
      let amEstimated = false;
      let pmEstimated = false;
      if (am == null) {
        am = (pm as number) * (amShare / (1 - amShare));
        amEstimated = true;
      } else if (pm == null) {
        pm = am * ((1 - amShare) / amShare);
        pmEstimated = true;
      }
      return {
        roundId: round.roundId,
        anchor: gemelkIndex(round.first.date, round.first.slot) + 1,
        amL: am,
        pmL: pm as number,
        amEstimated,
        pmEstimated,
      };
    })
    .filter((r): r is NonNullable<typeof r> => r !== null)
    .sort((a, b) => a.anchor - b.anchor);

  const spans: RoundSpan[] = [];
  for (let i = 0; i < anchored.length; i++) {
    const current = anchored[i];
    const spanFrom =
      i === 0 ? fromIdx : halfwayBoundary(anchored[i - 1].anchor, current.anchor);
    const spanTo =
      i === anchored.length - 1
        ? toIdx
        : halfwayBoundary(current.anchor, anchored[i + 1].anchor) - 1;

    const clampedFrom = Math.max(spanFrom, fromIdx);
    const clampedTo = Math.min(spanTo, toIdx);
    if (clampedFrom > clampedTo) continue;
    spans.push({ ...current, fromIdx: clampedFrom, toIdx: clampedTo });
  }
  return spans;
}

export function buildCowTimeline(
  cow: CowInput,
  seasonStartIdx: number,
  seasonEndIdx: number,
  amShare: number,
  /**
   * Das letzte Gemelk, über das sich überhaupt schon etwas sagen lässt —
   * normalerweise das heutige. Eine noch laufende Behandlung sperrt nur bis
   * dorthin; was danach kommt, ist offen, nicht gesperrt.
   */
  openEndIdx = seasonEndIdx,
): CowTimeline {
  const fromIdx = Math.max(seasonStartIdx, gemelkIndex(cow.arrival.date, cow.arrival.slot));

  // Trockenstellen und Abtrieb begrenzen das letzte gemolkene Gemelk. Das
  // Gemelk, nach dem trockengestellt wurde, zählt selbst noch mit.
  let toIdx = seasonEndIdx;
  if (cow.dryOff) {
    toIdx = Math.min(toIdx, gemelkIndex(cow.dryOff.date, cow.dryOff.slot));
  }
  if (cow.departure) {
    toIdx = Math.min(toIdx, gemelkIndex(cow.departure.date, cow.departure.slot));
  }

  const spans = fromIdx <= toIdx ? buildRoundSpans(cow, fromIdx, toIdx, amShare) : [];
  // Eine abgeschlossene Behandlung sperrt ihre Wartezeit auch in die Zukunft —
  // die steht ja fest. Eine laufende sperrt nur bis heute.
  const blocked = buildBlockedSpans(cow, Math.min(toIdx, openEndIdx));

  const days: CowDay[] = [];
  let totalUsableL = 0;
  let totalBlockedL = 0;

  if (fromIdx <= toIdx) {
    for (let day = dayOfGemelk(fromIdx); day <= dayOfGemelk(toIdx); day++) {
      const amIdx = day * 2;
      const pmIdx = day * 2 + 1;
      const amMilked = amIdx >= fromIdx && amIdx <= toIdx;
      const pmMilked = pmIdx >= fromIdx && pmIdx <= toIdx;

      const amSpan = amMilked ? findSpan(spans, amIdx) : null;
      const pmSpan = pmMilked ? findSpan(spans, pmIdx) : null;

      const amL = amSpan ? amSpan.amL : 0;
      const pmL = pmSpan ? pmSpan.pmL : 0;
      const amBlocked = amMilked && isBlocked(blocked, amIdx);
      const pmBlocked = pmMilked && isBlocked(blocked, pmIdx);

      const rawL = amL + pmL;
      const usableL = (amBlocked ? 0 : amL) + (pmBlocked ? 0 : pmL);
      const blockedL = rawL - usableL;

      totalUsableL += usableL;
      totalBlockedL += blockedL;

      days.push({
        day,
        date: isoFromDayIndex(day),
        cowId: cow.cowId,
        farmerId: cow.farmerId,
        amMilked,
        pmMilked,
        amL,
        pmL,
        amBlocked,
        pmBlocked,
        rawL,
        usableL,
        blockedL,
        estimated: (!!amSpan && amSpan.amEstimated) || (!!pmSpan && pmSpan.pmEstimated),
      });
    }
  }

  return {
    cowId: cow.cowId,
    farmerId: cow.farmerId,
    fromIdx,
    toIdx,
    spans,
    blocked,
    days,
    hasMeasurements: spans.length > 0,
    totalUsableL,
    totalBlockedL,
  };
}

export function runEngine(input: EngineInput): EngineResult {
  const amShare = computeAmShare(input.cows, input.amShareFallback);
  const seasonStartIdx = dayIndex(input.seasonStart) * 2;
  const seasonEndIdx = dayIndex(input.seasonEnd) * 2 + 1;
  const openEndIdx = input.asOf ? dayIndex(input.asOf) * 2 + 1 : seasonEndIdx;

  const timelines = input.cows.map((cow) =>
    buildCowTimeline(cow, seasonStartIdx, seasonEndIdx, amShare, openEndIdx),
  );

  // Kuh-Tage nach Datum indizieren, damit die Tagesverteilung in einem Durchlauf geht.
  const cowDaysByDate = new Map<string, CowDay[]>();
  for (const timeline of timelines) {
    for (const cowDay of timeline.days) {
      const bucket = cowDaysByDate.get(cowDay.date);
      if (bucket) bucket.push(cowDay);
      else cowDaysByDate.set(cowDay.date, [cowDay]);
    }
  }

  const pct = clamp(input.deduction.percent, 0, 1);
  const fixed = Math.max(0, input.deduction.fixedPerDay);

  const byDay = new Map<string, DayAllocation>();
  const startDay = dayIndex(input.seasonStart);
  const endDay = dayIndex(input.seasonEnd);

  for (let day = startDay; day <= endDay; day++) {
    const date = isoFromDayIndex(day);
    const cowDays = cowDaysByDate.get(date) ?? [];

    const producedKg = Math.max(0, input.production[date] ?? 0);
    let deductionKg = 0;
    if (producedKg > 0) {
      deductionKg = Math.min(producedKg, producedKg * pct + fixed);
    }
    const netCheeseKg = producedKg - deductionKg;

    let totalUsableL = 0;
    let totalRawL = 0;
    let totalBlockedL = 0;
    let cowsMilked = 0;
    const perFarmerUsable = new Map<number, number>();
    const perFarmerBlocked = new Map<number, number>();

    for (const cowDay of cowDays) {
      if (!cowDay.amMilked && !cowDay.pmMilked) continue;
      cowsMilked++;
      totalUsableL += cowDay.usableL;
      totalRawL += cowDay.rawL;
      totalBlockedL += cowDay.blockedL;
      perFarmerUsable.set(
        cowDay.farmerId,
        (perFarmerUsable.get(cowDay.farmerId) ?? 0) + cowDay.usableL,
      );
      perFarmerBlocked.set(
        cowDay.farmerId,
        (perFarmerBlocked.get(cowDay.farmerId) ?? 0) + cowDay.blockedL,
      );
    }

    const perFarmer: FarmerDayShare[] = [];
    for (const [farmerId, usableL] of perFarmerUsable) {
      const share = totalUsableL > 0 ? usableL / totalUsableL : 0;
      perFarmer.push({
        farmerId,
        usableL,
        blockedL: perFarmerBlocked.get(farmerId) ?? 0,
        share,
        cheeseKg: netCheeseKg * share,
      });
    }
    perFarmer.sort((a, b) => b.usableL - a.usableL);

    byDay.set(date, {
      day,
      date,
      producedKg,
      deductionKg,
      netCheeseKg,
      totalUsableL,
      totalRawL,
      totalBlockedL,
      cowsMilked,
      perFarmer,
      // Käse an einem Tag ganz ohne verwertbare Milch lässt sich niemandem
      // zuordnen. Das wird ausgewiesen statt still verteilt.
      unallocatedKg: totalUsableL > 0 ? 0 : netCheeseKg,
    });
  }

  const months = buildMonthReports(input, byDay);

  return { amShare, timelines, byDay, months };
}

function buildMonthReports(
  input: EngineInput,
  byDay: Map<string, DayAllocation>,
): MonthReport[] {
  const reports: MonthReport[] = [];

  for (const month of monthsBetween(input.seasonStart, input.seasonEnd)) {
    const days = [...byDay.values()].filter((d) => monthOf(d.date) === month);
    if (days.length === 0) continue;
    days.sort((a, b) => a.day - b.day);

    let producedKg = 0;
    let deductionKg = 0;
    let netCheeseKg = 0;
    let totalUsableL = 0;
    let totalBlockedL = 0;
    let unallocatedKg = 0;

    const usableByFarmer = new Map<number, number>();
    const blockedByFarmer = new Map<number, number>();
    const dailyCheeseByFarmer = new Map<number, number>();

    for (const day of days) {
      producedKg += day.producedKg;
      deductionKg += day.deductionKg;
      netCheeseKg += day.netCheeseKg;
      totalUsableL += day.totalUsableL;
      totalBlockedL += day.totalBlockedL;
      unallocatedKg += day.unallocatedKg;
      for (const row of day.perFarmer) {
        usableByFarmer.set(
          row.farmerId,
          (usableByFarmer.get(row.farmerId) ?? 0) + row.usableL,
        );
        blockedByFarmer.set(
          row.farmerId,
          (blockedByFarmer.get(row.farmerId) ?? 0) + row.blockedL,
        );
        dailyCheeseByFarmer.set(
          row.farmerId,
          (dailyCheeseByFarmer.get(row.farmerId) ?? 0) + row.cheeseKg,
        );
      }
    }

    const perFarmer: FarmerMonthRow[] = [];
    for (const [farmerId, usableL] of usableByFarmer) {
      const sharePct = totalUsableL > 0 ? usableL / totalUsableL : 0;
      perFarmer.push({
        farmerId,
        usableL,
        blockedL: blockedByFarmer.get(farmerId) ?? 0,
        sharePct,
        cheeseDailyKg: dailyCheeseByFarmer.get(farmerId) ?? 0,
        // Vergleichsrechnung: der ganze Monatskäse in einem Schritt verteilt.
        cheeseMonthlyKg: netCheeseKg * sharePct,
      });
    }
    perFarmer.sort((a, b) => b.usableL - a.usableL);

    reports.push({
      month,
      fromDate: days[0].date,
      toDate: days[days.length - 1].date,
      days,
      producedKg,
      deductionKg,
      netCheeseKg,
      totalUsableL,
      totalBlockedL,
      unallocatedKg,
      perFarmer,
    });
  }

  return reports;
}
