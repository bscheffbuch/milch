import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { bellOrder, byFarmerAndBell } from "../lib/view";

/** Nur das, wonach sortiert wird — der Rest der Kuh spielt hier keine Rolle. */
function kuh(farmerName: string, bellNumber: string, name = "Kuh") {
  return { farmerName, bellNumber, name };
}

describe("Ordnung der Herde", () => {
  it("liest die Glocke als Zahl, nicht als Text", () => {
    const herde = [kuh("Gruber", "110"), kuh("Gruber", "2"), kuh("Gruber", "12")];
    assert.deepEqual(
      [...herde].sort(byFarmerAndBell).map((cow) => cow.bellNumber),
      ["2", "12", "110"],
    );
  });

  it("stellt den Hof vor die Glocke", () => {
    const herde = [kuh("Steinlechner", "3"), kuh("Gruber", "40"), kuh("Gruber", "7")];
    assert.deepEqual(
      [...herde].sort(byFarmerAndBell).map((cow) => `${cow.farmerName} ${cow.bellNumber}`),
      ["Gruber 7", "Gruber 40", "Steinlechner 3"],
    );
  });

  it("hängt Glocken ohne Zahl hinten an und ordnet sie unter sich", () => {
    const herde = [kuh("Gruber", "Schelle"), kuh("Gruber", "9"), kuh("Gruber", "Alt")];
    assert.deepEqual(
      [...herde].sort(byFarmerAndBell).map((cow) => cow.bellNumber),
      ["9", "Alt", "Schelle"],
    );
  });

  it("hält bei gleicher Zahl die Beschriftung und dann den Namen auseinander", () => {
    const herde = [
      kuh("Gruber", "12b"),
      kuh("Gruber", "12", "Zenzi"),
      kuh("Gruber", "12a"),
    ];
    assert.deepEqual(
      [...herde].sort(byFarmerAndBell).map((cow) => cow.bellNumber),
      ["12", "12a", "12b"],
    );

    const gleich = [kuh("Gruber", "12", "Zenzi"), kuh("Gruber", "12", "Berta")];
    assert.deepEqual(
      [...gleich].sort(byFarmerAndBell).map((cow) => cow.name),
      ["Berta", "Zenzi"],
    );
  });

  it("zählt eine Glocke mit Zusatz nach ihrer Zahl", () => {
    assert.equal(bellOrder({ bellNumber: "12a" }), 12);
    assert.equal(bellOrder({ bellNumber: "" }), Number.MAX_SAFE_INTEGER);
  });
});
