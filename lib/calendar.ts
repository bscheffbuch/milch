import { blockedSpanL } from "@/lib/calc/report";
import { maxIso } from "@/lib/format";
import {
  dayIndex,
  dayOfGemelk,
  gemelkIndex,
  isMorning,
  isoFromDayIndex,
} from "@/lib/gemelk";
import type { SeasonView } from "@/lib/view";

export interface DayEvents {
  date: string;
  cheeseKg: number | null;
  milkL: number | null;
  /** Messungen, deren erstes Gemelk auf diesen Tag fällt. */
  roundIds: number[];
  /** Kühe, die an diesem Tag behandelt wurden. */
  treatedCowIds: number[];
  /** Kühe, deren Milch an diesem Tag ganz oder halb gesperrt ist. */
  blockedCowIds: number[];
  arrivals: number[];
  departures: number[];
  dryOffs: number[];
  pickupFarmerIds: number[];
  pickupKg: number;
}

function bucket(map: Map<string, DayEvents>, date: string): DayEvents {
  let entry = map.get(date);
  if (!entry) {
    entry = {
      date,
      cheeseKg: null,
      milkL: null,
      roundIds: [],
      treatedCowIds: [],
      blockedCowIds: [],
      arrivals: [],
      departures: [],
      dryOffs: [],
      pickupFarmerIds: [],
      pickupKg: 0,
    };
    map.set(date, entry);
  }
  return entry;
}

/**
 * Alle Ereignisse der Saison nach Tag sortiert — die Grundlage des Kalenders.
 * Tage jenseits des Stichtags bleiben ohne Milchmenge: die letzte Messung gilt
 * rechnerisch bis zum Saisonende weiter, das wäre aber Hochrechnung, keine
 * Messung.
 */
export function buildDayEvents(view: SeasonView): Map<string, DayEvents> {
  const map = new Map<string, DayEvents>();

  for (const entry of view.production) {
    bucket(map, entry.date).cheeseKg = entry.kg;
  }

  for (const [date, day] of view.result.byDay) {
    if (date > view.asOf) continue;
    bucket(map, date).milkL = day.totalUsableL;
  }

  for (const round of view.rounds) {
    bucket(map, round.firstDate).roundIds.push(round.id);
  }

  /*
    Eine laufende Behandlung hat kein Ende, das man abschreiten könnte. Sie
    reicht deshalb bis zum Stichtag: behandelt wurde, was schon war — was
    morgen ist, steht noch nicht fest, auch wenn die Sperre weiterläuft.
  */
  for (const treatment of view.treatments) {
    const last = treatment.endDate ?? maxIso(treatment.startDate, view.asOf);
    for (let day = dayIndex(treatment.startDate); day <= dayIndex(last); day++) {
      bucket(map, isoFromDayIndex(day)).treatedCowIds.push(treatment.cowId);
    }
  }

  for (const timeline of view.result.timelines) {
    for (const day of timeline.days) {
      if (day.amBlocked || day.pmBlocked) {
        bucket(map, day.date).blockedCowIds.push(timeline.cowId);
      }
    }
  }

  for (const cow of view.activeHerd) {
    if (cow.arrivalDate) bucket(map, cow.arrivalDate).arrivals.push(cow.id);
    if (cow.departureDate) bucket(map, cow.departureDate).departures.push(cow.id);
    if (cow.dryOffDate) bucket(map, cow.dryOffDate).dryOffs.push(cow.id);
  }

  for (const pickup of view.pickups) {
    const entry = bucket(map, pickup.date);
    entry.pickupFarmerIds.push(pickup.farmerId);
    entry.pickupKg += pickup.kg;
  }

  return map;
}

/** Ein Abschnitt, in dem tatsächlich behandelt wurde — auf der Gemelk-Achse. */
export interface TreatedRun {
  fromIdx: number;
  toIdx: number;
  label: string;
}

/**
 * Ein zusammenhängender Sperrzeitraum einer Kuh, aufbereitet zum Zeichnen
 * über mehrere Tage hinweg.
 *
 * `fromIdx`/`toIdx` bleiben auf der Gemelk-Achse: eine Sperre, die erst mit
 * dem Abendgemelk beginnt, fängt auch erst in der Tagesmitte an. `startsPm`
 * und `endsAm` tragen genau diese halben Tage in die Darstellung.
 */
export interface BlockBar {
  key: string;
  cowId: number;
  cowName: string;
  bellNumber: string;
  farmerId: number;
  labels: string[];
  fromIdx: number;
  toIdx: number;
  /** Erster und letzter berührter Tag, einschließlich. */
  fromDay: number;
  toDay: number;
  startsPm: boolean;
  endsAm: boolean;
  /** Das Ende ist offen: die Behandlung läuft noch, der Balken hört nur auf. */
  open: boolean;
  lostL: number;
  /** Die Behandlungen selbst; ein Sperrzeitraum kann mehrere zusammenfassen. */
  treated: TreatedRun[];
}

/**
 * Alle Sperrzeiträume der Saison als Balken. Die Zeiträume kommen fertig
 * zusammengefasst aus dem Rechenkern — grenzen zwei Behandlungen aneinander,
 * ist es dort bereits ein Balken.
 */
export function buildBlockBars(view: SeasonView): BlockBar[] {
  const byTreatment = new Map(view.treatments.map((entry) => [entry.id, entry]));
  const bars: BlockBar[] = [];

  for (const timeline of view.result.timelines) {
    const cow = view.cowNames.get(timeline.cowId);
    for (const span of timeline.blocked) {
      bars.push({
        key: `${timeline.cowId}-${span.fromIdx}`,
        cowId: timeline.cowId,
        cowName: cow?.name ?? `Kuh ${timeline.cowId}`,
        bellNumber: cow?.bellNumber ?? "",
        farmerId: timeline.farmerId,
        labels: span.labels,
        fromIdx: span.fromIdx,
        toIdx: span.toIdx,
        fromDay: dayOfGemelk(span.fromIdx),
        toDay: dayOfGemelk(span.toIdx),
        startsPm: !isMorning(span.fromIdx),
        endsAm: isMorning(span.toIdx),
        open: span.open,
        lostL: blockedSpanL(timeline, span),
        treated: span.treatmentIds.flatMap((id) => {
          const entry = byTreatment.get(id);
          if (!entry) return [];
          const from = gemelkIndex(entry.startDate, entry.startSlot);
          return [
            {
              fromIdx: from,
              // Ohne Ende reicht das Behandelte so weit wie die Sperre selbst.
              toIdx:
                entry.endDate === null || entry.endSlot === null
                  ? Math.max(from, span.toIdx)
                  : gemelkIndex(entry.endDate, entry.endSlot),
              label: entry.label,
            },
          ];
        }),
      });
    }
  }

  return bars.sort(
    (a, b) => a.fromIdx - b.fromIdx || a.cowName.localeCompare(b.cowName, "de"),
  );
}

/**
 * Verteilt Balken auf möglichst wenige Spuren: jeder Balken kommt in die erste
 * Spur, in der er keinen schon liegenden überlappt. So bleibt ein Zeitraum ein
 * durchgehender Balken, statt in Tageshäppchen zu zerfallen.
 */
export function packLanes<T extends { fromDay: number; toDay: number }>(bars: T[]): T[][] {
  const lanes: T[][] = [];
  for (const bar of [...bars].sort((a, b) => a.fromDay - b.fromDay)) {
    const lane = lanes.find((entries) => {
      const last = entries[entries.length - 1];
      return last.toDay < bar.fromDay;
    });
    if (lane) lane.push(bar);
    else lanes.push([bar]);
  }
  return lanes;
}

/** Montag-basierte Gitterwochen für einen Monat 'YYYY-MM'. */
export function monthGrid(month: string): number[][] {
  const [year, monthNo] = month.split("-").map(Number);
  const firstDay = dayIndex(`${month}-01`);
  const daysInMonth = new Date(Date.UTC(year, monthNo, 0)).getUTCDate();

  // getUTCDay: 0 = Sonntag. Die Woche beginnt hier am Montag.
  const weekday = new Date(Date.UTC(year, monthNo - 1, 1)).getUTCDay();
  const lead = (weekday + 6) % 7;

  const cells: number[] = [];
  for (let i = 0; i < lead; i++) cells.push(firstDay - lead + i);
  for (let i = 0; i < daysInMonth; i++) cells.push(firstDay + i);
  while (cells.length % 7 !== 0) cells.push(cells[cells.length - 1] + 1);

  const weeks: number[][] = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}

export function shiftMonth(month: string, delta: number): string {
  const [year, monthNo] = month.split("-").map(Number);
  const total = year * 12 + (monthNo - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, "0")}`;
}
