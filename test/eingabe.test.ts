import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { splitEntry } from "../lib/eingabe";

describe("Ziffern und Buchstaben trennen", () => {
  it("teilt eine gemischte Eingabe in beide Hälften", () => {
    assert.deepEqual(splitEntry("12a"), { digits: "12", rest: "a" });
  });

  it("lässt eine reine Zahl und einen reinen Namen ganz", () => {
    assert.deepEqual(splitEntry("110"), { digits: "110", rest: "" });
    assert.deepEqual(splitEntry("Berta"), { digits: "", rest: "Berta" });
  });

  it("behält Leerzeichen im Rest — ein Name hat manchmal zwei Wörter", () => {
    assert.deepEqual(splitEntry("Anna Maria"), { digits: "", rest: "Anna Maria" });
  });

  it("liest die Ziffern in ihrer Reihenfolge, auch verstreut", () => {
    assert.equal(splitEntry("1a2b3").digits, "123");
  });

  it("macht aus nichts nichts", () => {
    assert.deepEqual(splitEntry(""), { digits: "", rest: "" });
  });
});
