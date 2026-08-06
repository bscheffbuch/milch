/**
 * Plausibilitätsprüfung: rechnet die aktive Saison durch und gibt die
 * Kennzahlen im Terminal aus. Nützlich, um eine Abrechnung gegenzuprüfen,
 * ohne die Oberfläche zu öffnen.
 *
 *   npm run data     (in einem zweiten Fenster laufen lassen)
 *   npm run check [stichtag]
 *
 * Gerechnet wird mit derselben Funktion, die auch im Fenster läuft — was hier
 * herauskommt, steht dort genauso auf dem Bildschirm.
 */
import {
  buildFarmerBalances,
  buildMonthSummaries,
  buildSeasonTotals,
} from "../lib/calc/report";
import { call } from "../lib/data/client";
import { buildSeasonView } from "../lib/view";

async function main() {
  const { snapshot } = await call("snapshot");
  const view = buildSeasonView(snapshot);
  if (!view) {
    console.error("Keine Saison vorhanden. Zuerst 'npm run seed' ausführen.");
    process.exit(1);
  }

  // Ohne Argument gilt der Stichtag der Oberfläche: heute, spätestens das
  // Saisonende. Sonst zählte die letzte Messung als Hochrechnung bis zum Ende.
  // Mit Argument wird neu gerechnet, statt die fertigen Zahlen der Ansicht zu
  // nehmen — die gelten nur für deren eigenen Stichtag.
  const asOf = process.argv[2] ?? view.asOf;
  const { season, result, farmerNames, pickups, cowCountByFarmer } = view;
  const totals = buildSeasonTotals(result, pickups, asOf);
  const balances = buildFarmerBalances(result, pickups, cowCountByFarmer, asOf);

  console.log(`Saison   ${season.name} (${season.startDate} bis ${season.endDate})`);
  console.log(`Stichtag ${asOf}`);
  console.log(`Morgenanteil am Tagesgemelk: ${(result.amShare * 100).toFixed(1)} %`);
  console.log(
    `Käse ${totals.producedKg.toFixed(1)} kg an ${totals.productionDays} Tagen` +
      (totals.deductionKg > 0 ? `, davon ${totals.deductionKg.toFixed(1)} kg Abzug` : ""),
  );
  console.log(
    `Milch verwertbar ${totals.usableMilkL.toFixed(0)} l, ` +
      `wegen Behandlung verworfen ${totals.blockedMilkL.toFixed(1)} l`,
  );
  if (totals.unallocatedKg > 0) {
    console.log(`Nicht zuordenbar: ${totals.unallocatedKg.toFixed(1)} kg`);
  }

  console.log(
    `\n${"Bauer".padEnd(15)}${"Kühe".padStart(5)}${"Milch".padStart(10)}` +
      `${"gesperrt".padStart(10)}${"Anspruch".padStart(11)}${"abgeholt".padStart(11)}${"offen".padStart(11)}`,
  );
  let sumEntitled = 0;
  for (const balance of balances) {
    sumEntitled += balance.entitledKg;
    console.log(
      (farmerNames.get(balance.farmerId) ?? "?").padEnd(15) +
        String(balance.cowCount).padStart(5) +
        balance.usableL.toFixed(0).padStart(10) +
        balance.blockedL.toFixed(1).padStart(10) +
        balance.entitledKg.toFixed(1).padStart(11) +
        balance.pickedUpKg.toFixed(1).padStart(11) +
        balance.outstandingKg.toFixed(1).padStart(11),
    );
  }

  // Die Summe aller Ansprüche muss dem verteilbaren Käse entsprechen.
  const expected = totals.netCheeseKg - totals.unallocatedKg;
  const drift = Math.abs(sumEntitled - expected);
  console.log(
    `\nSumme Ansprüche ${sumEntitled.toFixed(2)} kg gegen verteilbaren Käse ` +
      `${expected.toFixed(2)} kg — Abweichung ${drift.toFixed(6)} kg`,
  );
  if (drift > 0.001) {
    console.error("FEHLER: Die Verteilung geht nicht auf.");
    process.exit(1);
  }

  // Ebenfalls am Stichtag abgeschnitten — result.months deckt die ganze Saison ab.
  for (const month of buildMonthSummaries(result, asOf)) {
    const maxDrift = Math.max(
      0,
      ...month.perFarmer.map((r) => Math.abs(r.cheeseDailyKg - r.cheeseMonthlyKg)),
    );
    console.log(
      `${month.month}  Käse ${month.netCheeseKg.toFixed(1).padStart(7)} kg  ` +
        `Milch ${month.totalUsableL.toFixed(0).padStart(6)} l  ` +
        `größte Abweichung tagesgenau/monatsgenau ${maxDrift.toFixed(2)} kg`,
    );
  }

  console.log(`\nDatenbank ${snapshot.dbPath}`);
}

main().catch((cause: unknown) => {
  console.error(cause instanceof Error ? cause.message : cause);
  process.exit(1);
});
