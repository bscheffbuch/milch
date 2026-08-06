/**
 * Legt eine vollständige Beispielsaison an, damit die Anwendung sofort mit
 * realistischen Zahlen benutzbar ist. Löscht vorher alle vorhandenen Daten.
 *
 *   npm run data     (in einem zweiten Fenster laufen lassen)
 *   npm run seed
 *
 * Geschrieben wird ausschließlich über die Anweisungen der Datenschicht — es
 * gibt hier kein eigenes SQL. Damit prüft der Lauf nebenbei, ob die
 * Anweisungen tatsächlich das tun, was die Oberfläche von ihnen erwartet.
 */
import { call } from "../lib/data/client";
import { dayIndex, isoFromDayIndex, type Slot } from "../lib/gemelk";

const SEASON_START = "2026-06-06";
const SEASON_END = "2026-09-20";
const TODAY = "2026-08-02";

/** Reproduzierbarer Zufall, damit der Seed bei jedem Lauf dieselben Zahlen liefert. */
function makeRandom(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}
const random = makeRandom(20260606);

function jitter(spread: number): number {
  return (random() - 0.5) * 2 * spread;
}

const FARMERS = [
  { name: "Oberhofer", contact: "Hof am Bühel" },
  { name: "Unterberger", contact: "Talweg 4" },
  { name: "Steinlechner", contact: "Steinlechnerhof" },
  { name: "Gruber", contact: "Gruberhof" },
  { name: "Hinterseer", contact: "Seeblick 12" },
  { name: "Moosbrugger", contact: "Moosweg 7" },
];

const COW_NAMES = [
  "Bella",
  "Liesl",
  "Resi",
  "Fanny",
  "Bergli",
  "Zenzi",
  "Moidl",
  "Flora",
  "Nelke",
  "Rosl",
  "Susi",
  "Vroni",
  "Anni",
  "Erna",
  "Gitti",
  "Hedi",
  "Iris",
  "Kathi",
  "Linde",
  "Nora",
  "Olga",
  "Paula",
  "Traudl",
  "Wanda",
];

interface SeedCow {
  id: number;
  farmerId: number;
  /** Tagesleistung zu Saisonbeginn in kg. */
  peak: number;
  /** Rückgang pro Tag. */
  decline: number;
  arrivalDate: string;
  dryOffDate: string | null;
  dryOffSlot: Slot;
}

/** Wie `call`, nur mit der Kennung des neu Angelegten als Ergebnis. */
async function create(name: string, payload: Record<string, unknown>): Promise<number> {
  const result = await call(name, payload);
  if (result.insertedId === null) throw new Error(`${name} hat nichts angelegt`);
  return result.insertedId;
}

async function main() {
  await call("reset");

  const seasonId = await create("createSeason", {
    name: "Alpsommer 2026",
    startDate: SEASON_START,
    endDate: SEASON_END,
  });

  const farmerIds: number[] = [];
  for (const farmer of FARMERS) {
    farmerIds.push(await create("createFarmer", farmer));
  }

  const cows: SeedCow[] = [];
  for (const [index, name] of COW_NAMES.entries()) {
    const farmerId = farmerIds[index % farmerIds.length];

    // Zwei Kühe kommen erst später auf die Alp, vier werden im September
    // trockengestellt — beides kommt auf einer echten Alp ständig vor.
    const arrivalDate =
      index === 7 ? "2026-06-24" : index === 18 ? "2026-07-08" : SEASON_START;
    const driesOff = index % 6 === 3 && index < 20;
    const dryOffDate = driesOff ? isoFromDayIndex(dayIndex("2026-08-28") + index) : null;
    const dryOffSlot: Slot = index % 2 === 0 ? "AM" : "PM";

    const cowId = await create("createCow", {
      farmerId,
      bellNumber: String(101 + index),
      name,
      seasonId,
      arrivalDate,
      arrivalSlot: "AM",
    });

    // Das Trockenstellen gehört nicht ins Anlegen — es fällt erst im Sommer an
    // und geht deshalb denselben Weg wie in der Oberfläche.
    if (dryOffDate) {
      await call("saveCowSeason", {
        seasonId,
        cowId,
        farmerId,
        arrivalDate,
        arrivalSlot: "AM",
        dryOffDate,
        dryOffSlot,
      });
    }

    cows.push({
      id: cowId,
      farmerId,
      peak: 22 + jitter(6),
      decline: 0.075 + jitter(0.02),
      arrivalDate,
      dryOffDate,
      dryOffSlot,
    });
  }

  /** Erwartete Tagesmenge einer Kuh — fallende Laktationskurve mit Rauschen. */
  const dailyYield = (cow: SeedCow, date: string): number => {
    const elapsed = dayIndex(date) - dayIndex(SEASON_START);
    return Math.max(4, cow.peak - cow.decline * elapsed + jitter(1.4));
  };

  /* Wöchentliche Messungen, abwechselnd morgens beginnend und abends. */
  let roundCount = 0;
  for (let day = dayIndex("2026-06-08"); day <= dayIndex(TODAY); day += 7, roundCount++) {
    const firstDate = isoFromDayIndex(day);
    const firstSlot: Slot = roundCount % 3 === 2 ? "PM" : "AM";
    const roundId = await create("createRound", { seasonId, firstDate, firstSlot });

    const values: Array<{ cowId: number; firstL: number; secondL: number | null }> = [];
    for (const cow of cows) {
      if (firstDate < cow.arrivalDate) continue;
      if (cow.dryOffDate && firstDate > cow.dryOffDate) continue;

      const total = dailyYield(cow, firstDate);
      const amShare = 0.55 + jitter(0.03);
      const amL = Math.round(total * amShare * 10) / 10;
      const pmL = Math.round((total - amL) * 10) / 10;

      // Gelegentlich fällt ein halbes Gemelk aus — die Anwendung muss damit
      // umgehen können, also gehört das in die Beispieldaten.
      const skipSecond = random() < 0.02;
      const second = firstSlot === "AM" ? pmL : amL;
      values.push({
        cowId: cow.id,
        firstL: firstSlot === "AM" ? amL : pmL,
        secondL: skipSecond ? null : second,
      });
    }
    await call("saveRoundValues", { roundId, values });
  }

  /* Behandlungen, inkl. einer mehrtägigen. */
  const types = (await call("snapshot")).snapshot.treatmentTypes;

  const treatments: Array<[number, string, Slot, string, Slot, number, string]> = [
    [0, "2026-06-19", "PM", "2026-06-19", "PM", 0, "Viertel hinten links"],
    [4, "2026-07-02", "AM", "2026-07-04", "PM", 1, "Über drei Tage behandelt"],
    [9, "2026-07-14", "PM", "2026-07-14", "PM", 2, ""],
    [13, "2026-07-21", "AM", "2026-07-21", "AM", 0, ""],
    [17, "2026-07-28", "PM", "2026-07-29", "AM", 1, ""],
    [2, "2026-08-01", "AM", "2026-08-01", "AM", 4, "Ohne Wartezeit"],
  ];

  for (const [cow, startDate, startSlot, endDate, endSlot, typeIndex, note] of treatments) {
    const type = types[typeIndex] ?? types[0];
    await call("createTreatment", {
      seasonId,
      cowId: cows[cow].id,
      typeId: type.id,
      label: type.name,
      startDate,
      startSlot,
      endDate,
      endSlot,
      withholdGemelke: type.defaultWithholdGemelke,
      note: note || null,
    });
  }

  /* Tägliche Käseproduktion, grob aus der Milchmenge der Herde abgeleitet. */
  for (let day = dayIndex(SEASON_START); day < dayIndex(TODAY); day++) {
    const date = isoFromDayIndex(day);
    let herdMilk = 0;
    for (const cow of cows) {
      if (date < cow.arrivalDate) continue;
      if (cow.dryOffDate && date > cow.dryOffDate) continue;
      herdMilk += dailyYield(cow, date);
    }
    // Rund 10,5 kg Milch je kg Käse, mit etwas Streuung im Kessel.
    const cheese = Math.round((herdMilk / 10.5 + jitter(1.2)) * 10) / 10;
    await call("saveProduction", { seasonId, date, kg: Math.max(0, cheese) });
  }

  /* Abholungen — jeder Bauer holt mehrmals im Sommer ab. */
  const pickupDates = ["2026-06-28", "2026-07-12", "2026-07-26"];
  for (const farmerId of farmerIds) {
    for (const date of pickupDates) {
      if (random() < 0.25) continue;
      const wheels = 1 + Math.floor(random() * 3);
      await call("createPickup", {
        seasonId,
        farmerId,
        date,
        kg: Math.round(wheels * (6.5 + jitter(0.8)) * 10) / 10,
        wheels,
      });
    }
  }

  const final = (await call("snapshot")).snapshot;
  console.log("Beispielsaison angelegt:", {
    bauern: final.farmers.length,
    kuehe: final.cows.length,
    messungen: final.rounds.length,
    messwerte: final.values.length,
    behandlungen: final.treatments.length,
    produktionstage: final.production.length,
    abholungen: final.pickups.length,
  });
  console.log(`Datenbank ${final.dbPath}`);
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
