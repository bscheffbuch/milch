import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildDistribution } from "../lib/distribution";
import type { DayAllocation } from "../lib/calc/types";
import { dayIndex } from "../lib/gemelk";

const NAMES = new Map([
  [1, "Gruber"],
  [2, "Moser"],
  [3, "Huber"],
]);

/** Ein Tag der Zuteilung, auf das reduziert, was die Reihe daraus liest. */
function alloc(date: string, perFarmer: Array<[number, number]>): DayAllocation {
  const totalUsableL = perFarmer.reduce((sum, [, kg]) => sum + kg, 0);
  return {
    day: dayIndex(date),
    date,
    producedKg: 0,
    deductionKg: 0,
    netCheeseKg: 0,
    totalUsableL,
    totalRawL: totalUsableL,
    totalBlockedL: 0,
    cowsMilked: perFarmer.length,
    perFarmer: perFarmer.map(([farmerId, usableL]) => ({
      farmerId,
      usableL,
      blockedL: 0,
      share: totalUsableL > 0 ? usableL / totalUsableL : 0,
      cheeseKg: 0,
    })),
    unallocatedKg: 0,
  };
}

describe("Verteilung im Verlauf", () => {
  it("ordnet die Bänder nach Gesamtmenge, das größte zuerst", () => {
    const series = buildDistribution(
      [
        alloc("2026-06-01", [
          [1, 10],
          [2, 30],
          [3, 20],
        ]),
        alloc("2026-06-02", [
          [1, 10],
          [2, 30],
          [3, 20],
        ]),
      ],
      NAMES,
      "2026-06-01",
      "2026-06-30",
    );

    assert.ok(series);
    assert.deepEqual(series.farmerIds, [2, 3, 1]);
    assert.deepEqual(series.names, ["Moser", "Huber", "Gruber"]);
    assert.deepEqual(series.totalsL, [60, 40, 20]);
    assert.equal(series.maxDayL, 60);
  });

  it("schneidet Tage ohne verwertbare Milch am Rand weg", () => {
    const series = buildDistribution(
      [
        alloc("2026-06-01", []),
        alloc("2026-06-02", [
          [1, 10],
          [2, 10],
        ]),
        alloc("2026-06-03", [
          [1, 12],
          [2, 8],
        ]),
        alloc("2026-06-04", []),
      ],
      NAMES,
      "2026-06-01",
      "2026-06-30",
    );

    assert.ok(series);
    assert.deepEqual(series.dates, ["2026-06-02", "2026-06-03"]);
    assert.deepEqual(series.dayTotalsL, [20, 20]);
  });

  it("hält an einem leeren Tag mittendrin die Verteilung des Vortags", () => {
    const series = buildDistribution(
      [
        alloc("2026-06-01", [
          [1, 12],
          [2, 8],
        ]),
        alloc("2026-06-02", []),
        alloc("2026-06-03", [
          [1, 6],
          [2, 6],
        ]),
      ],
      NAMES,
      "2026-06-01",
      "2026-06-30",
    );

    assert.ok(series);
    // Band 0 ist Gruber (20 kg gesamt), Band 1 Moser (14 kg).
    assert.deepEqual(series.valuesL[0], [12, 12, 6]);
    assert.deepEqual(series.valuesL[1], [8, 8, 6]);
    assert.deepEqual(series.dayTotalsL, [20, 20, 12]);
  });

  it("beachtet die Zeitraumgrenzen", () => {
    const days = [
      alloc("2026-06-01", [
        [1, 10],
        [2, 10],
      ]),
      alloc("2026-07-01", [
        [1, 10],
        [2, 10],
      ]),
      alloc("2026-07-02", [
        [1, 10],
        [2, 10],
      ]),
    ];
    const series = buildDistribution(days, NAMES, "2026-07-01", "2026-07-31");

    assert.ok(series);
    assert.deepEqual(series.dates, ["2026-07-01", "2026-07-02"]);
  });

  it("liefert nichts, wo es keinen Verlauf zu zeigen gibt", () => {
    const oneFarmer = buildDistribution(
      [alloc("2026-06-01", [[1, 10]]), alloc("2026-06-02", [[1, 10]])],
      NAMES,
      "2026-06-01",
      "2026-06-30",
    );
    assert.equal(oneFarmer, null);

    const oneDay = buildDistribution(
      [
        alloc("2026-06-01", [
          [1, 10],
          [2, 10],
        ]),
      ],
      NAMES,
      "2026-06-01",
      "2026-06-30",
    );
    assert.equal(oneDay, null);
  });
});
