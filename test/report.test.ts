import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { runEngine } from "../lib/calc/engine";
import { buildFarmerBalances } from "../lib/calc/report";
import type { CowInput, EngineInput } from "../lib/calc/types";

/*
  Das Käsekonto rechnet monatweise ab. Geprüft wird deshalb vor allem der
  Schnitt zwischen den Monaten: der Übertrag, und der laufende Monat, dessen
  Anspruch als Schatten getrennt bleibt.
*/

const SEASON_START = "2026-06-01";
const SEASON_END = "2026-08-31";

function cow(cowId: number, farmerId: number, firstL: number, secondL: number): CowInput {
  return {
    cowId,
    farmerId,
    arrival: { date: SEASON_START, slot: "AM" },
    rounds: [
      { roundId: cowId, first: { date: SEASON_START, slot: "AM" }, firstL, secondL },
    ],
    treatments: [],
  };
}

/** Zwei Bauern im Verhältnis 3:1, an jedem Tag im Juni und Juli 40 kg Käse. */
function input(): EngineInput {
  const production: Record<string, number> = {};
  for (const month of ["06", "07"]) {
    for (let day = 1; day <= 30; day++) {
      production[`2026-${month}-${String(day).padStart(2, "0")}`] = 40;
    }
  }
  return {
    seasonStart: SEASON_START,
    seasonEnd: SEASON_END,
    cows: [cow(1, 1, 18, 12), cow(2, 2, 6, 4)],
    production,
    deduction: { percent: 0, fixedPerDay: 0 },
  };
}

const cowCount = new Map([
  [1, 1],
  [2, 1],
]);

describe("Käsekonto", () => {
  it("führt den offenen Rest als Übertrag in den nächsten Monat", () => {
    const result = runEngine(input());
    const [first] = buildFarmerBalances(
      result,
      [{ farmerId: 1, date: "2026-06-15", kg: 100 }],
      cowCount,
      "2026-07-31",
    );

    assert.equal(first.farmerId, 1);
    const juni = first.months.find((month) => month.month === "2026-06");
    const juli = first.months.find((month) => month.month === "2026-07");
    assert.ok(juni && juli);

    // 30 Tage à 30 kg, davon 100 kg abgeholt.
    assert.equal(juni.carryInKg, 0);
    assert.equal(juni.entitledKg, 900);
    assert.equal(juni.pickedUpKg, 100);
    assert.equal(juni.carryOutKg, 800);
    assert.equal(juli.carryInKg, 800);
    assert.equal(juli.carryOutKg, 1700);
  });

  it("hält den laufenden Monat als Schatten neben dem abgerechneten Anspruch", () => {
    const result = runEngine(input());
    const [first] = buildFarmerBalances(result, [], cowCount, "2026-07-10");

    assert.equal(first.openMonth, "2026-07");
    // Juni ist abgeschlossen, Juli läuft: 10 Tage à 30 kg stehen daneben.
    assert.equal(first.settledKg, 900);
    assert.equal(first.ghostKg, 300);
    assert.equal(first.entitledKg, 1200);
    assert.equal(first.settledOutstandingKg, 900);
    assert.equal(first.outstandingKg, 1200);
    assert.equal(first.months.find((month) => month.month === "2026-07")?.open, true);
    assert.equal(first.months.find((month) => month.month === "2026-06")?.open, false);
  });

  it("kennt am Saisonende keinen laufenden Monat mehr", () => {
    const result = runEngine(input());
    const [first] = buildFarmerBalances(result, [], cowCount, SEASON_END);

    assert.equal(first.openMonth, null);
    assert.equal(first.ghostKg, 0);
    assert.equal(first.settledKg, first.entitledKg);
    assert.equal(first.settledOutstandingKg, first.outstandingKg);
  });
});
