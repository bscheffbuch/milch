import type { CowInput, EngineInput } from "@/lib/calc/types";
import type { Slot } from "@/lib/gemelk";

import type { MeasurementValue, Season, Snapshot, Treatment } from "./types";

/**
 * Stellt alle Daten einer Saison in der Form zusammen, die der Rechenkern
 * erwartet. Nur Kühe mit Saisoneintrag zählen mit — eine Kuh ohne Auftrieb war
 * schlicht nicht auf der Alp.
 */
export function engineInput(
  snapshot: Snapshot,
  season: Season,
  /** Heute, höchstens das Saisonende — begrenzt laufende Behandlungen. */
  asOf?: string,
): EngineInput {
  const herd = snapshot.herd.filter(
    (cow) => cow.archived === 0 && cow.cowSeasonId !== null,
  );

  const valuesByCow = new Map<number, MeasurementValue[]>();
  for (const value of snapshot.values) {
    const bucket = valuesByCow.get(value.cowId);
    if (bucket) bucket.push(value);
    else valuesByCow.set(value.cowId, [value]);
  }

  const treatmentsByCow = new Map<number, Treatment[]>();
  for (const treatment of snapshot.treatments) {
    const bucket = treatmentsByCow.get(treatment.cowId);
    if (bucket) bucket.push(treatment);
    else treatmentsByCow.set(treatment.cowId, [treatment]);
  }

  const cows: CowInput[] = herd.map((cow) => ({
    cowId: cow.id,
    farmerId: cow.farmerId,
    arrival: {
      date: cow.arrivalDate ?? season.startDate,
      slot: (cow.arrivalSlot ?? "AM") as Slot,
    },
    departure:
      cow.departureDate && cow.departureSlot
        ? { date: cow.departureDate, slot: cow.departureSlot }
        : null,
    dryOff:
      cow.dryOffDate && cow.dryOffSlot
        ? { date: cow.dryOffDate, slot: cow.dryOffSlot }
        : null,
    rounds: (valuesByCow.get(cow.id) ?? []).map((value) => ({
      roundId: value.roundId,
      first: { date: value.firstDate, slot: value.firstSlot },
      firstL: value.firstL,
      secondL: value.secondL,
    })),
    treatments: (treatmentsByCow.get(cow.id) ?? []).map((treatment) => ({
      treatmentId: treatment.id,
      start: { date: treatment.startDate, slot: treatment.startSlot },
      end:
        treatment.endDate === null || treatment.endSlot === null
          ? null
          : { date: treatment.endDate, slot: treatment.endSlot },
      withholdGemelke: treatment.withholdGemelke,
      label: treatment.label,
    })),
  }));

  const production: Record<string, number> = {};
  for (const entry of snapshot.production) production[entry.date] = entry.kg;

  return {
    seasonStart: season.startDate,
    seasonEnd: season.endDate,
    asOf,
    cows,
    production,
    deduction: {
      percent: season.deductionPercent,
      fixedPerDay: season.deductionFixedPerDay,
    },
  };
}
