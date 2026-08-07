import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { de } from "../lib/i18n/de";
import { translate, translateCount, translator } from "../lib/i18n/text";

/*
  Geprüft wird das Nachschlagen und das Einsetzen, nicht der Wortlaut. Was in
  `de.ts` steht, darf sich ändern, ohne dass hier etwas rot wird — sonst stünde
  jeder Satz zweimal im Repository und der Test hielte nur fest, dass er
  abgeschrieben wurde.
*/

describe("Wörterbuch", () => {
  it("findet einen Text über den Punktpfad", () => {
    assert.equal(translate(de, "common.close"), de.common.close);
  });

  it("setzt ein, was in geschweiften Klammern steht", () => {
    const text = translate(de, "update.ready", { version: "0.1.1" });
    assert.ok(text.includes("0.1.1"));
    assert.ok(!text.includes("{version}"));
  });

  it("lässt eine Lücke stehen, für die kein Wert kommt", () => {
    // Besser eine sichtbare Lücke als ein „undefined“ mitten im Satz.
    assert.ok(translate(de, "update.ready").includes("{version}"));
  });

  it("gibt bei unbekanntem Schlüssel den Schlüssel zurück", () => {
    assert.equal(translate(de, "gibt.es.nicht"), "gibt.es.nicht");
  });

  it("hält einen Zweig nicht für einen Text", () => {
    // `update` ist ein Feld voller Schlüssel und selbst keiner.
    assert.equal(translate(de, "update"), "update");
  });

  it("wählt bei einer Anzahl zwischen Einzahl und Mehrzahl", () => {
    const woerterbuch = {
      cows: { one: "{count} Kuh", other: "{count} Kühe" },
    } as unknown as typeof de;

    assert.equal(translateCount(woerterbuch, "cows", 1), "1 Kuh");
    assert.equal(translateCount(woerterbuch, "cows", 3), "3 Kühe");
    assert.equal(translateCount(woerterbuch, "cows", 0), "0 Kühe");
  });

  it("bindet im Übersetzer beide Aufrufe an dasselbe Wörterbuch", () => {
    const t = translator(de);
    assert.equal(t("common.close"), de.common.close);
    assert.equal(typeof t.n, "function");
  });
});
