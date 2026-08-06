import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  dayIndex,
  formatGemelk,
  gemelkAt,
  gemelkIndex,
  halfwayBoundary,
  isMorning,
} from "../lib/gemelk";
import { buildBlockedSpans, buildCowTimeline, runEngine } from "../lib/calc/engine";
import type { CowInput, EngineInput } from "../lib/calc/types";

const SEASON_START = "2026-06-01";
const SEASON_END = "2026-06-30";
const D0 = dayIndex(SEASON_START);

const seasonStartIdx = D0 * 2;
const seasonEndIdx = dayIndex(SEASON_END) * 2 + 1;

/** Gemelk-Index relativ zum 1. Juni: Tag 0 = 1.6. */
function g(dayOffset: number, slot: "AM" | "PM"): number {
  return (D0 + dayOffset) * 2 + (slot === "PM" ? 1 : 0);
}

function cow(overrides: Partial<CowInput> = {}): CowInput {
  return {
    cowId: 1,
    farmerId: 1,
    arrival: { date: SEASON_START, slot: "AM" },
    rounds: [],
    treatments: [],
    ...overrides,
  };
}

describe("Gemelk-Zeitachse", () => {
  it("morgens ist gerade, abends ungerade", () => {
    assert.equal(isMorning(gemelkIndex("2026-06-10", "AM")), true);
    assert.equal(isMorning(gemelkIndex("2026-06-10", "PM")), false);
    assert.equal(gemelkIndex("2026-06-10", "PM") - gemelkIndex("2026-06-10", "AM"), 1);
  });

  it("ist umkehrbar", () => {
    const idx = gemelkIndex("2026-08-31", "PM");
    assert.deepEqual(gemelkAt(idx), { date: "2026-08-31", slot: "PM" });
  });

  it("überspringt keine Gemelke über einen Monatswechsel", () => {
    assert.equal(gemelkIndex("2026-07-01", "AM") - gemelkIndex("2026-06-30", "PM"), 1);
  });

  it("gibt bei ungerader Halbzeit das mittlere Gemelk der früheren Messung", () => {
    // Gerader Abstand: die Mitte liegt exakt auf einer Gemelk-Grenze.
    assert.equal(halfwayBoundary(100, 114), 107);
    // Ungerader Abstand: die Mitte liegt mitten in Gemelk 107, das damit noch
    // zur früheren Messung gehört — die spätere beginnt erst bei 108.
    assert.equal(halfwayBoundary(100, 115), 108);
  });
});

describe("Halbzeit-Regel", () => {
  it("teilt zwischen wöchentlichen Messungen genau in der Mitte", () => {
    // Messungen am 1., 8. und 15. Juni, jeweils morgens + abends desselben Tags.
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-01", slot: "AM" },
            firstL: 20,
            secondL: 16,
          },
          {
            roundId: 2,
            first: { date: "2026-06-08", slot: "AM" },
            firstL: 18,
            secondL: 14,
          },
          {
            roundId: 3,
            first: { date: "2026-06-15", slot: "AM" },
            firstL: 22,
            secondL: 18,
          },
        ],
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    assert.equal(timeline.spans.length, 3);

    // Erste Messung reicht rückwirkend bis zum Auftrieb und endet am 4.6. abends.
    assert.equal(timeline.spans[0].fromIdx, g(0, "AM"));
    assert.equal(timeline.spans[0].toIdx, g(3, "PM"));

    // Die mittlere Messung gilt vom 5.6. morgens bis 11.6. abends — 14 Gemelke,
    // symmetrisch um ihren Anker am Mittag des 8.6.
    assert.equal(formatGemelk(timeline.spans[1].fromIdx), "05.06. morgens");
    assert.equal(formatGemelk(timeline.spans[1].toIdx), "11.06. abends");
    assert.equal(timeline.spans[1].toIdx - timeline.spans[1].fromIdx + 1, 14);

    // Letzte Messung läuft bis Saisonende weiter.
    assert.equal(timeline.spans[2].toIdx, seasonEndIdx);
  });

  it("verankert eine Messung abends/Folgetag-morgens um Mitternacht", () => {
    // Messung A: 1.6. morgens + abends. Messung B: 7.6. abends + 8.6. morgens.
    // Ankerabstand ist ungerade (13 Gemelke), die Mitte fällt in ein Gemelk.
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-01", slot: "AM" },
            firstL: 20,
            secondL: 16,
          },
          { roundId: 2, first: { date: "2026-06-07", slot: "PM" }, firstL: 8, secondL: 12 },
        ],
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    // Abendwert stammt vom 7.6. abends, Morgenwert vom 8.6. morgens.
    assert.equal(timeline.spans[1].pmL, 8);
    assert.equal(timeline.spans[1].amL, 12);

    // Das strittige Gemelk 4.6. abends bleibt bei der früheren Messung.
    assert.equal(timeline.spans[0].toIdx, g(3, "PM"));
    assert.equal(timeline.spans[1].fromIdx, g(4, "AM"));
  });

  it("hält Morgen- und Abendwert über den ganzen Zeitraum getrennt", () => {
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-08", slot: "AM" },
            firstL: 18,
            secondL: 12,
          },
        ],
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    const day = timeline.days.find((d) => d.date === "2026-06-20");
    assert.ok(day);
    assert.equal(day.amL, 18);
    assert.equal(day.pmL, 12);
    assert.equal(day.rawL, 30);
  });
});

describe("Behandlung und Sperrfrist", () => {
  it("sperrt ab dem Behandlungsgemelk über die volle Frist", () => {
    // Der vom Nutzer bestätigte Referenzfall: Behandlung am 10.6. abends,
    // Sperrfrist 3 Tage = 6 Gemelke. Gesperrt sind 10.6. abends bis 13.6.
    // morgens; ab 13.6. abends ist die Milch wieder verwertbar.
    const spans = buildBlockedSpans(
      cow({
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: { date: "2026-06-10", slot: "PM" },
            withholdGemelke: 6,
            label: "Mastitis",
          },
        ],
      }),
    );

    assert.equal(spans.length, 1);
    assert.equal(formatGemelk(spans[0].fromIdx), "10.06. abends");
    assert.equal(formatGemelk(spans[0].toIdx), "13.06. morgens");
    assert.equal(spans[0].toIdx - spans[0].fromIdx + 1, 6);
  });

  it("rechnet bei mehrtägiger Behandlung ab dem letzten Behandlungsgemelk", () => {
    const spans = buildBlockedSpans(
      cow({
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: { date: "2026-06-12", slot: "AM" },
            withholdGemelke: 6,
            label: "Mastitis",
          },
        ],
      }),
    );

    assert.equal(formatGemelk(spans[0].fromIdx), "10.06. abends");
    assert.equal(formatGemelk(spans[0].toIdx), "14.06. abends");
  });

  it("sperrt eine laufende Behandlung bis zum aktuellen Rand", () => {
    // Ohne Ende ist die Behandlung nicht abgeschlossen: gesperrt ist alles ab
    // dem ersten Gemelk bis zum übergebenen Rand — die Wartezeit beginnt erst,
    // wenn das Ende nachgetragen wird, und verlängert dann nach hinten.
    const spans = buildBlockedSpans(
      cow({
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: null,
            withholdGemelke: 6,
            label: "Mastitis",
          },
        ],
      }),
      gemelkIndex("2026-06-14", "AM"),
    );

    assert.equal(spans.length, 1);
    assert.equal(spans[0].open, true);
    assert.equal(formatGemelk(spans[0].fromIdx), "10.06. abends");
    assert.equal(formatGemelk(spans[0].toIdx), "14.06. morgens");
  });

  it("sperrt eine laufende Behandlung nur bis heute, nicht bis zum Saisonende", () => {
    // Was nach heute kommt, ist offen und nicht gesperrt: über eine Behandlung,
    // die noch gar nicht stattgefunden hat, lässt sich nichts sagen.
    const running = cow({
      treatments: [
        {
          treatmentId: 1,
          start: { date: "2026-06-10", slot: "PM" },
          end: null,
          withholdGemelke: 6,
          label: "Mastitis",
        },
      ],
    });

    const heute = g(13, "PM"); // 14.06. abends
    const timeline = buildCowTimeline(running, seasonStartIdx, seasonEndIdx, 0.5, heute);

    assert.equal(timeline.blocked.length, 1);
    assert.equal(timeline.blocked[0].open, true);
    assert.equal(formatGemelk(timeline.blocked[0].toIdx), "14.06. abends");

    // Nachgetragenes Ende: jetzt zählt die Wartezeit, und die darf über heute
    // hinausreichen — sie steht ja fest.
    const beendet = cow({
      treatments: [
        {
          treatmentId: 1,
          start: { date: "2026-06-10", slot: "PM" },
          end: { date: "2026-06-14", slot: "PM" },
          withholdGemelke: 6,
          label: "Mastitis",
        },
      ],
    });

    const nachher = buildCowTimeline(beendet, seasonStartIdx, seasonEndIdx, 0.5, heute);
    assert.equal(nachher.blocked[0].open, false);
    assert.equal(formatGemelk(nachher.blocked[0].toIdx), "17.06. morgens");
  });

  it("verschmilzt überlappende Behandlungen zu einem Zeitraum", () => {
    const spans = buildBlockedSpans(
      cow({
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: { date: "2026-06-10", slot: "PM" },
            withholdGemelke: 6,
            label: "Erste",
          },
          {
            treatmentId: 2,
            start: { date: "2026-06-12", slot: "AM" },
            end: { date: "2026-06-12", slot: "AM" },
            withholdGemelke: 6,
            label: "Zweite",
          },
        ],
      }),
    );

    assert.equal(spans.length, 1);
    assert.equal(formatGemelk(spans[0].fromIdx), "10.06. abends");
    assert.equal(formatGemelk(spans[0].toIdx), "14.06. abends");
    assert.deepEqual(spans[0].labels, ["Erste", "Zweite"]);
  });

  it("kostet bei einer Abendbehandlung nur das Abendgemelk, nicht den halben Tag", () => {
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-08", slot: "AM" },
            firstL: 18,
            secondL: 12,
          },
        ],
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: { date: "2026-06-10", slot: "PM" },
            withholdGemelke: 2,
            label: "Kurz",
          },
        ],
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    const behandlungstag = timeline.days.find((d) => d.date === "2026-06-10");
    assert.ok(behandlungstag);
    assert.equal(behandlungstag.amBlocked, false);
    assert.equal(behandlungstag.pmBlocked, true);
    // Nur die 12 kg des Abendgemelks fallen weg, die 18 kg vom Morgen bleiben.
    assert.equal(behandlungstag.usableL, 18);
    assert.equal(behandlungstag.blockedL, 12);

    const folgetag = timeline.days.find((d) => d.date === "2026-06-11");
    assert.ok(folgetag);
    assert.equal(folgetag.amBlocked, true);
    assert.equal(folgetag.pmBlocked, false);
    assert.equal(folgetag.usableL, 12);
  });

  it("sperrt bei Sperrfrist 0 gar nichts", () => {
    const spans = buildBlockedSpans(
      cow({
        treatments: [
          {
            treatmentId: 1,
            start: { date: "2026-06-10", slot: "PM" },
            end: { date: "2026-06-10", slot: "PM" },
            withholdGemelke: 0,
            label: "Klauenpflege",
          },
        ],
      }),
    );
    assert.equal(spans.length, 0);
  });
});

describe("Trockenstellen und Auftrieb", () => {
  it("zählt das Gemelk, nach dem trockengestellt wurde, noch mit", () => {
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-08", slot: "AM" },
            firstL: 18,
            secondL: 12,
          },
        ],
        dryOff: { date: "2026-06-20", slot: "PM" },
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    const letzterTag = timeline.days.find((d) => d.date === "2026-06-20");
    assert.ok(letzterTag);
    assert.equal(letzterTag.amMilked, true);
    assert.equal(letzterTag.pmMilked, true);
    assert.equal(letzterTag.usableL, 30);

    // Danach wird nicht mehr gemolken — für den Rest der Saison keine Einträge.
    assert.equal(
      timeline.days.some((d) => d.date > "2026-06-20"),
      false,
    );
  });

  it("beendet bei Trockenstellen am Morgen den Tag nach dem Morgengemelk", () => {
    const timeline = buildCowTimeline(
      cow({
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-08", slot: "AM" },
            firstL: 18,
            secondL: 12,
          },
        ],
        dryOff: { date: "2026-06-20", slot: "AM" },
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    const letzterTag = timeline.days.at(-1);
    assert.ok(letzterTag);
    assert.equal(letzterTag.date, "2026-06-20");
    assert.equal(letzterTag.amMilked, true);
    assert.equal(letzterTag.pmMilked, false);
    assert.equal(letzterTag.usableL, 18);
  });

  it("dehnt die erste Messung rückwirkend bis zum Auftrieb aus", () => {
    const timeline = buildCowTimeline(
      cow({
        arrival: { date: "2026-06-05", slot: "PM" },
        rounds: [
          {
            roundId: 1,
            first: { date: "2026-06-12", slot: "AM" },
            firstL: 18,
            secondL: 12,
          },
        ],
      }),
      seasonStartIdx,
      seasonEndIdx,
      0.55,
    );

    // Vor dem Auftrieb gibt es keine Einträge.
    assert.equal(timeline.days[0].date, "2026-06-05");
    assert.equal(timeline.days[0].amMilked, false);
    assert.equal(timeline.days[0].pmMilked, true);
    assert.equal(timeline.days[0].usableL, 12);

    // Und der Zeitraum davor zählt trotz fehlender Messung voll mit.
    const tag = timeline.days.find((d) => d.date === "2026-06-07");
    assert.ok(tag);
    assert.equal(tag.usableL, 30);
  });
});

describe("Käseverteilung", () => {
  function twoFarmerInput(overrides: Partial<EngineInput> = {}): EngineInput {
    return {
      seasonStart: SEASON_START,
      seasonEnd: SEASON_END,
      cows: [
        cow({
          cowId: 1,
          farmerId: 1,
          rounds: [
            {
              roundId: 1,
              first: { date: "2026-06-01", slot: "AM" },
              firstL: 18,
              secondL: 12,
            },
          ],
        }),
        cow({
          cowId: 2,
          farmerId: 2,
          rounds: [
            {
              roundId: 2,
              first: { date: "2026-06-01", slot: "AM" },
              firstL: 6,
              secondL: 4,
            },
          ],
        }),
      ],
      production: { "2026-06-10": 40 },
      deduction: { percent: 0, fixedPerDay: 0 },
      ...overrides,
    };
  }

  it("verteilt den Tageskäse nach Milchanteil", () => {
    const result = runEngine(twoFarmerInput());
    const day = result.byDay.get("2026-06-10");
    assert.ok(day);

    assert.equal(day.totalUsableL, 40); // 30 + 10
    const f1 = day.perFarmer.find((f) => f.farmerId === 1);
    const f2 = day.perFarmer.find((f) => f.farmerId === 2);
    assert.ok(f1 && f2);
    assert.equal(f1.share, 0.75);
    assert.equal(f1.cheeseKg, 30);
    assert.equal(f2.cheeseKg, 10);
  });

  it("lässt den Behandlungsverlust den betroffenen Bauern tragen", () => {
    const input = twoFarmerInput();
    input.cows[0].treatments = [
      {
        treatmentId: 1,
        start: { date: "2026-06-10", slot: "AM" },
        end: { date: "2026-06-10", slot: "AM" },
        withholdGemelke: 1,
        label: "Mastitis",
      },
    ];

    const result = runEngine(input);
    const day = result.byDay.get("2026-06-10");
    assert.ok(day);

    // Bauer 1 verliert das Morgengemelk (18 kg), behält den Abend (12 kg).
    const f1 = day.perFarmer.find((f) => f.farmerId === 1);
    const f2 = day.perFarmer.find((f) => f.farmerId === 2);
    assert.ok(f1 && f2);
    assert.equal(f1.usableL, 12);
    assert.equal(f1.blockedL, 18);
    assert.equal(day.totalUsableL, 22);

    // Der Pool schrumpft, Bauer 2 bekommt dadurch anteilig mehr als die 10 kg
    // aus dem ungestörten Fall.
    assert.ok(f2.cheeseKg > 10);
    assert.equal(Math.round((f1.cheeseKg + f2.cheeseKg) * 1e6) / 1e6, 40);
  });

  it("zieht Prozent- und Fixabzug vor der Verteilung ab", () => {
    const result = runEngine(
      twoFarmerInput({ deduction: { percent: 0.1, fixedPerDay: 2 } }),
    );
    const day = result.byDay.get("2026-06-10");
    assert.ok(day);

    assert.equal(day.deductionKg, 6); // 40 * 0,1 + 2
    assert.equal(day.netCheeseKg, 34);
    const total = day.perFarmer.reduce((sum, f) => sum + f.cheeseKg, 0);
    assert.equal(Math.round(total * 1e6) / 1e6, 34);
  });

  it("weist Käse ohne verwertbare Milch als nicht zuordenbar aus", () => {
    const input = twoFarmerInput({ production: { "2026-06-10": 40 } });
    for (const c of input.cows) {
      c.dryOff = { date: "2026-06-05", slot: "PM" };
    }

    const result = runEngine(input);
    const day = result.byDay.get("2026-06-10");
    assert.ok(day);
    assert.equal(day.totalUsableL, 0);
    assert.equal(day.unallocatedKg, 40);
    assert.equal(day.perFarmer.length, 0);
  });

  it("summiert die Monatsabrechnung tagesgenau und monatsgenau", () => {
    const result = runEngine(
      twoFarmerInput({
        production: { "2026-06-10": 40, "2026-06-11": 40 },
      }),
    );

    const juni = result.months.find((m) => m.month === "2026-06");
    assert.ok(juni);
    assert.equal(juni.producedKg, 80);
    assert.equal(juni.netCheeseKg, 80);

    const f1 = juni.perFarmer.find((f) => f.farmerId === 1);
    assert.ok(f1);
    assert.equal(f1.cheeseDailyKg, 60);
    // Ohne Bestandsänderung im Monat müssen beide Verfahren übereinstimmen.
    assert.equal(Math.round(f1.cheeseMonthlyKg * 1e6) / 1e6, 60);
  });

  it("weicht bei Bestandsänderung im Monat zwischen den Verfahren ab", () => {
    // Die zweite Kuh kommt erst am 11.6. dazu. Tagesgenau bekommt Bauer 2 am
    // 10.6. nichts; monatsgenau wird sein Monatsanteil über beide Tage verteilt.
    const input = twoFarmerInput({
      production: { "2026-06-10": 40, "2026-06-11": 40 },
    });
    input.cows[1].arrival = { date: "2026-06-11", slot: "AM" };

    const result = runEngine(input);
    const juni = result.months.find((m) => m.month === "2026-06");
    assert.ok(juni);
    const f2 = juni.perFarmer.find((f) => f.farmerId === 2);
    assert.ok(f2);

    assert.equal(Math.round(f2.cheeseDailyKg * 1e6) / 1e6, 10);
    assert.notEqual(
      Math.round(f2.cheeseDailyKg * 1e6) / 1e6,
      Math.round(f2.cheeseMonthlyKg * 1e6) / 1e6,
    );
  });
});

describe("Halbe Messungen", () => {
  it("schätzt einen fehlenden Wert über das Morgen/Abend-Verhältnis der Herde", () => {
    const input: EngineInput = {
      seasonStart: SEASON_START,
      seasonEnd: SEASON_END,
      cows: [
        // Vollständig gemessen: Verhältnis 60/40.
        cow({
          cowId: 1,
          farmerId: 1,
          rounds: [
            {
              roundId: 1,
              first: { date: "2026-06-01", slot: "AM" },
              firstL: 18,
              secondL: 12,
            },
          ],
        }),
        // Nur das Morgengemelk gemessen — der Abend wird geschätzt.
        cow({
          cowId: 2,
          farmerId: 2,
          rounds: [
            {
              roundId: 2,
              first: { date: "2026-06-01", slot: "AM" },
              firstL: 18,
              secondL: null,
            },
          ],
        }),
      ],
      production: {},
      deduction: { percent: 0, fixedPerDay: 0 },
    };

    const result = runEngine(input);
    assert.equal(result.amShare, 0.6);

    const geschaetzt = result.timelines[1];
    assert.equal(geschaetzt.spans[0].pmEstimated, true);
    assert.equal(geschaetzt.spans[0].amEstimated, false);
    // 18 kg morgens bei 60 % Morgenanteil ergibt 12 kg abends.
    assert.equal(Math.round(geschaetzt.spans[0].pmL * 1e6) / 1e6, 12);
  });
});
