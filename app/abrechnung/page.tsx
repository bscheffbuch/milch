"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";

import DistributionChart from "@/components/DistributionChart";
import NoSeason from "@/components/NoSeason";
import PrintButton from "@/components/PrintButton";
import { FarmerLink } from "@/components/Preview";
import { Empty, Ghost, MiniBar, Stat } from "@/components/ui";
import type { MonthSummary } from "@/lib/calc/report";
import type { FarmerMonthRow } from "@/lib/calc/types";
import { useSeasonView } from "@/lib/data/store";
import { buildDistribution } from "@/lib/distribution";
import { kg, kg0, liter, liter0, pct, signedKg } from "@/lib/format";
import { formatDateDe, formatMonth, monthOf } from "@/lib/gemelk";
import { billingHref } from "@/lib/routes";
import type { SeasonView } from "@/lib/view";

/** Fasst mehrere Monate zu einer Abrechnungszeile je Bauer zusammen. */
function mergeMonths(months: MonthSummary[]): {
  producedKg: number;
  deductionKg: number;
  netCheeseKg: number;
  unallocatedKg: number;
  totalUsableL: number;
  totalBlockedL: number;
  dayCount: number;
  perFarmer: FarmerMonthRow[];
} {
  const usable = new Map<number, number>();
  const blocked = new Map<number, number>();
  const daily = new Map<number, number>();
  const monthly = new Map<number, number>();
  let producedKg = 0;
  let deductionKg = 0;
  let netCheeseKg = 0;
  let unallocatedKg = 0;
  let totalUsableL = 0;
  let totalBlockedL = 0;
  let dayCount = 0;

  for (const month of months) {
    producedKg += month.producedKg;
    deductionKg += month.deductionKg;
    netCheeseKg += month.netCheeseKg;
    unallocatedKg += month.unallocatedKg;
    totalUsableL += month.totalUsableL;
    totalBlockedL += month.totalBlockedL;
    dayCount += month.dayCount;
    for (const row of month.perFarmer) {
      usable.set(row.farmerId, (usable.get(row.farmerId) ?? 0) + row.usableL);
      blocked.set(row.farmerId, (blocked.get(row.farmerId) ?? 0) + row.blockedL);
      daily.set(row.farmerId, (daily.get(row.farmerId) ?? 0) + row.cheeseDailyKg);
      // Der Monatsschnitt wird je Monat gerechnet und dann aufsummiert — nur so
      // bleibt der Vergleichswert das, was eine monatsweise Abrechnung ergäbe.
      monthly.set(row.farmerId, (monthly.get(row.farmerId) ?? 0) + row.cheeseMonthlyKg);
    }
  }

  const perFarmer: FarmerMonthRow[] = [...usable.keys()]
    .map((farmerId) => ({
      farmerId,
      usableL: usable.get(farmerId) ?? 0,
      blockedL: blocked.get(farmerId) ?? 0,
      sharePct: totalUsableL > 0 ? (usable.get(farmerId) ?? 0) / totalUsableL : 0,
      cheeseDailyKg: daily.get(farmerId) ?? 0,
      cheeseMonthlyKg: monthly.get(farmerId) ?? 0,
    }))
    .sort((a, b) => b.cheeseDailyKg - a.cheeseDailyKg);

  return {
    producedKg,
    deductionKg,
    netCheeseKg,
    unallocatedKg,
    totalUsableL,
    totalBlockedL,
    dayCount,
    perFarmer,
  };
}

/**
 * Der Beisatz unter der verteilten Menge. Zwei Dinge können sie mindern, und
 * sie tun es an verschiedenen Stellen: Käse ohne verwertbare Milch dahinter
 * lässt sich gar nicht zuordnen, der Alpkäse dagegen wird sehr wohl
 * zugeordnet — nur eben erst am Ende, allen zusammen. Deshalb steht er hier
 * als Beisatz und nicht im Wert darüber.
 */
function shareNote(unallocatedKg: number, alpKg: number): string | undefined {
  const parts: string[] = [];
  if (unallocatedKg > 0) parts.push(`${kg(unallocatedKg)} kg nicht zuordenbar`);
  if (alpKg > 0) parts.push(`davon ${kg(alpKg)} kg Alpkäse`);
  return parts.length > 0 ? parts.join(", ") : undefined;
}

/**
 * Das Käsekonto, monatlich abgerechnet. Ist ein Monat gewählt, steht seine
 * eigene Abrechnung da — Übertrag, Anspruch, Abholungen, Rest. Sonst der
 * Gesamtstand, und daneben als Schatten, was der laufende Monat bis heute
 * dazugelegt hat.
 */
function CheeseAccount({ month, view }: { month: string | null; view: SeasonView }) {
  const openMonth = view.balances[0]?.openMonth ?? null;
  const closed = view.months.filter((entry) => entry.month !== openMonth);
  const running = month !== null && month === openMonth;

  if (month !== null) {
    return (
      <div className="card">
        <div className="card-head">
          <h2>Käsekonto {formatMonth(month)}</h2>
          <p>
            {running
              ? "der Monat läuft noch — Zwischenstand von heute"
              : "abgeschlossen: Übertrag, Anspruch, Abholungen, Rest"}
          </p>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Bauer</th>
                <th className="t-num">Übertrag</th>
                <th className="t-num">Anspruch</th>
                <th className="t-num">abgeholt</th>
                <th className="t-num">Rest</th>
              </tr>
            </thead>
            <tbody>
              {view.balances.map((balance) => {
                const row = balance.months.find((entry) => entry.month === month);
                return (
                  <tr key={balance.farmerId}>
                    <td>{view.farmerNames.get(balance.farmerId) ?? "—"}</td>
                    <td className="t-num faint">{kg(row?.carryInKg ?? 0)}</td>
                    <td className="t-num">
                      {running ? (
                        <Ghost value={row?.entitledKg ?? 0} />
                      ) : (
                        kg(row?.entitledKg ?? 0)
                      )}
                    </td>
                    <td className="t-num faint">{kg(row?.pickedUpKg ?? 0)}</td>
                    <td className="t-num">{kg(row?.carryOutKg ?? 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // Der Alpkäse gehört in keinen Monat und steht deshalb nur hier, in der
  // Gesamtansicht. Ohne ihn ginge die Zeile nicht auf: abgerechnet minus
  // abgeholt minus Alpkäse ergibt, was offen ist.
  const alpKg = view.totals.alpKg;

  return (
    <div className="card">
      <div className="card-head">
        <h2>Käsekonto</h2>
        <p>
          {closed.length === 0
            ? "noch kein Monat abgeschlossen — alles ist Zwischenstand"
            : `abgerechnet bis Ende ${formatMonth(closed.at(-1)!.month)}`}
        </p>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Bauer</th>
              <th className="t-num">abgerechnet</th>
              <th className="t-num">abgeholt</th>
              {alpKg > 0 ? <th className="t-num">Alpkäse</th> : null}
              <th className="t-num">offen</th>
              {openMonth ? (
                <th className="t-num">
                  {formatMonth(openMonth).replace(/ \d{4}$/, "")} bis heute
                </th>
              ) : null}
              <th>letzte Abholung</th>
            </tr>
          </thead>
          <tbody>
            {view.balances.map((balance) => (
              <tr key={balance.farmerId}>
                <td>{view.farmerNames.get(balance.farmerId) ?? "—"}</td>
                <td className="t-num">{kg(balance.settledKg)}</td>
                <td className="t-num faint">{kg(balance.pickedUpKg)}</td>
                {alpKg > 0 ? (
                  <td className="t-num faint">{kg(balance.alpKg)}</td>
                ) : null}
                <td className="t-num">{kg(balance.settledOutstandingKg)}</td>
                {openMonth ? (
                  <td className="t-num">
                    <Ghost
                      value={balance.ghostKg}
                      title={`noch nicht abgerechnet — Stand ${formatDateDe(view.asOf)}`}
                    />
                  </td>
                ) : null}
                <td className="num small faint">
                  {balance.lastPickupDate ? formatDateDe(balance.lastPickupDate) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {alpKg > 0 ? (
        <p className="small faint" style={{ marginTop: 10 }}>
          Die Spalte Alpkäse ist der Anteil, den jeder an den {kg(alpKg)} kg trägt, die
          die Alp selbst hergegeben hat — im Verhältnis seines Anspruchs. Sie hat kein
          Datum und steht deshalb in keinem einzelnen Monat, sondern mindert den offenen
          Stand als Ganzes.
        </p>
      ) : null}
      {openMonth ? (
        <p className="small faint" style={{ marginTop: 10 }}>
          Die letzte Spalte ist noch nicht abgerechnet: sie zeigt, was im{" "}
          {formatMonth(openMonth)} bis {formatDateDe(view.asOf)} dazugekommen ist. Am
          Monatsende wandert sie in den Anspruch.
        </p>
      ) : null}
    </div>
  );
}

export default function Page() {
  const params = useSearchParams();
  const view = useSeasonView();
  if (!view) return <NoSeason what="Die Abrechnung" />;

  const m = params.get("m");
  const selected = m && view.months.some((month) => month.month === m) ? m : null;
  const months = selected
    ? view.months.filter((month) => month.month === selected)
    : view.months;
  const merged = mergeMonths(months);
  const title = selected ? formatMonth(selected) : view.season.name;

  const pickupsInScope = view.pickups.filter(
    (pickup) =>
      pickup.date <= view.asOf && (!selected || monthOf(pickup.date) === selected),
  );
  const pickedUpByFarmer = new Map<number, number>();
  for (const pickup of pickupsInScope) {
    pickedUpByFarmer.set(
      pickup.farmerId,
      (pickedUpByFarmer.get(pickup.farmerId) ?? 0) + pickup.kg,
    );
  }

  const maxCheese = Math.max(...merged.perFarmer.map((row) => row.cheeseDailyKg), 1);

  // Der Alpkäse hat kein Datum und lässt sich deshalb keinem Monat zuschlagen.
  // Wer einen einzelnen Monat ansieht, bekommt ihn gar nicht zu sehen.
  const alpKg = selected ? 0 : view.totals.alpKg;

  // Der Verlauf folgt demselben Zeitraum wie die Tabelle darüber.
  const distribution = buildDistribution(
    view.result.byDay.values(),
    view.farmerNames,
    months[0]?.fromDate ?? view.season.startDate,
    months.at(-1)?.toDate ?? view.asOf,
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Abrechnung {title}</h1>
          <p>
            Stand {formatDateDe(view.asOf)} — {merged.dayCount}{" "}
            {merged.dayCount === 1 ? "Tag" : "Tage"}
          </p>
        </div>
        <PrintButton />
      </div>

      <div className="stack">
        <div className="wahl wahl-breit no-print">
          <Link aria-current={selected ? undefined : "page"} href="/abrechnung/">
            ganze Saison
          </Link>
          {view.months.map((month) => (
            <Link
              aria-current={selected === month.month ? "page" : undefined}
              href={billingHref(month.month)}
              key={month.month}
            >
              {formatMonth(month.month).replace(/ \d{4}$/, "")}
            </Link>
          ))}
        </div>

        {merged.dayCount === 0 ? (
          <Empty>Für diesen Zeitraum gibt es noch nichts abzurechnen.</Empty>
        ) : (
          <>
            <div className="grid grid-4">
              <Stat label="Käse produziert" value={kg0(merged.producedKg)} unit="kg" />
              <Stat
                label="Abzug"
                value={kg(merged.deductionKg)}
                unit="kg"
                note={merged.deductionKg === 0 ? "kein Abzug eingestellt" : undefined}
              />
              <Stat
                label="Verteilt"
                value={kg0(merged.netCheeseKg - merged.unallocatedKg)}
                unit="kg"
                note={shareNote(merged.unallocatedKg, alpKg)}
              />
              <Stat
                label="Milch verwertbar"
                value={liter0(merged.totalUsableL)}
                unit="l"
                note={
                  merged.totalBlockedL > 0
                    ? `${liter(merged.totalBlockedL)} l wegen Behandlung verworfen`
                    : undefined
                }
              />
            </div>

            <div className="card">
              <div className="card-head">
                <h2>Anteile der Bauern</h2>
                <p>tagesgenau abgerechnet — Monatsschnitt zum Vergleich</p>
              </div>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Bauer</th>
                      <th className="t-num">Milch</th>
                      <th className="t-num">Anteil</th>
                      <th style={{ width: "16%" }} />
                      <th className="t-num">Käse</th>
                      <th className="t-num">Monatsschnitt</th>
                      <th className="t-num">Differenz</th>
                      <th className="t-num">abgeholt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {merged.perFarmer.map((row) => (
                      <tr className="linked" key={row.farmerId}>
                        <td>
                          <FarmerLink farmerId={row.farmerId}>
                            {view.farmerNames.get(row.farmerId) ?? "—"}
                          </FarmerLink>
                          {row.blockedL > 0 ? (
                            <div className="faint small">
                              {liter(row.blockedL)} l wegen Behandlung verworfen
                            </div>
                          ) : null}
                        </td>
                        <td className="t-num">{liter0(row.usableL)}</td>
                        <td className="t-num">{pct(row.sharePct)}</td>
                        <td>
                          <MiniBar value={row.cheeseDailyKg} max={maxCheese} />
                        </td>
                        <td className="t-num">{kg(row.cheeseDailyKg)}</td>
                        <td className="t-num faint">{kg(row.cheeseMonthlyKg)}</td>
                        <td className="t-num faint">
                          {signedKg(row.cheeseDailyKg - row.cheeseMonthlyKg)}
                        </td>
                        <td className="t-num">
                          {kg(pickedUpByFarmer.get(row.farmerId) ?? 0)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td>Summe</td>
                      <td className="t-num">{liter0(merged.totalUsableL)}</td>
                      <td className="t-num">{pct(merged.perFarmer.length > 0 ? 1 : 0)}</td>
                      <td />
                      <td className="t-num">
                        {kg(merged.perFarmer.reduce((sum, r) => sum + r.cheeseDailyKg, 0))}
                      </td>
                      <td className="t-num faint">
                        {kg(
                          merged.perFarmer.reduce((sum, r) => sum + r.cheeseMonthlyKg, 0),
                        )}
                      </td>
                      <td className="t-num" />
                      <td className="t-num">
                        {kg(pickupsInScope.reduce((sum, p) => sum + p.kg, 0))}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
              {merged.unallocatedKg > 0 ? (
                <p className="small faint" style={{ marginTop: 10 }}>
                  {kg(merged.unallocatedKg)} kg Käse fielen an Tagen ohne verwertbare Milch
                  an und sind keinem Bauern zugeordnet.
                </p>
              ) : null}
            </div>

            {distribution ? (
              <div className="card">
                <div className="card-head">
                  <h2>Verteilung im Verlauf</h2>
                  <p>
                    verwertbare Milch je Bauer und Tag —{" "}
                    {formatDateDe(distribution.dates[0])} bis{" "}
                    {formatDateDe(distribution.dates.at(-1) ?? distribution.dates[0])}
                  </p>
                </div>
                <DistributionChart series={distribution} />
              </div>
            ) : null}

            {!selected && view.months.length > 1 ? (
              <div className="card">
                <div className="card-head">
                  <h2>Monat für Monat</h2>
                  <p>verteilter Käse je Bauer</p>
                </div>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Bauer</th>
                        {view.months.map((month) => (
                          <th className="t-num" key={month.month}>
                            {formatMonth(month.month)
                              .replace(/ \d{4}$/, "")
                              .slice(0, 3)}
                          </th>
                        ))}
                        <th className="t-num">Saison</th>
                      </tr>
                    </thead>
                    <tbody>
                      {merged.perFarmer.map((row) => (
                        <tr key={row.farmerId}>
                          <td>{view.farmerNames.get(row.farmerId) ?? "—"}</td>
                          {view.months.map((month) => {
                            const cell = month.perFarmer.find(
                              (entry) => entry.farmerId === row.farmerId,
                            );
                            return (
                              <td className="t-num" key={month.month}>
                                {cell ? (
                                  kg(cell.cheeseDailyKg)
                                ) : (
                                  <span className="faint">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="t-num">{kg(row.cheeseDailyKg)}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td>Summe</td>
                        {view.months.map((month) => (
                          <td className="t-num" key={month.month}>
                            {kg(month.netCheeseKg - month.unallocatedKg)}
                          </td>
                        ))}
                        <td className="t-num">
                          {kg(merged.netCheeseKg - merged.unallocatedKg)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            ) : null}

            <CheeseAccount month={selected} view={view} />

            <div className="card">
              <div className="card-head">
                <h2>Wie gerechnet wird</h2>
              </div>
              <ul className="prose small">
                <li>
                  Jede Messung gilt von der Hälfte zur vorigen bis zur Hälfte zur nächsten
                  Messung — also schon vor dem Messtag und noch danach. Die erste Messung
                  reicht bis zum Auftrieb zurück, die letzte bis zum Trockenstellen.
                </li>
                <li>
                  Gemolken wird morgens und abends. Alle Fristen zählen in Gemelken, damit
                  keine halben Tage gerundet werden müssen.
                </li>
                <li>
                  Nach einer Behandlung ist die Milch ab dem Behandlungsgemelk bis zum
                  Ablauf der Wartezeit gesperrt; bei mehrtägiger Behandlung zählt die
                  Wartezeit ab dem letzten Behandlungsgemelk. Diese Milch trägt der
                  betroffene Bauer selbst.
                </li>
                <li>
                  Der Käse eines Tages wird im Verhältnis der an diesem Tag verwertbaren
                  Milch verteilt. Verbindlich ist diese tagesgenaue Zuteilung; der
                  Monatsschnitt steht nur zum Vergleich daneben.
                </li>
                <li>
                  Abgerechnet wird monatweise: was in einem Monat anfällt, wird ihm
                  gutgeschrieben, und was offen bleibt, geht als Übertrag in den nächsten
                  Monat. Der laufende Monat steht getrennt daneben, solange er nicht zu Ende
                  ist.
                </li>
                {merged.deductionKg > 0 ? (
                  <li>
                    Vor der Verteilung wird der eingestellte Abzug abgezogen —{" "}
                    {kg(merged.deductionKg)} kg in diesem Zeitraum.
                  </li>
                ) : null}
                {alpKg > 0 ? (
                  <li>
                    Der Alpkäse — was die Alp selbst isst und was Helfer mitnehmen
                    dürfen — hat kein Datum und wird deshalb nicht Tag für Tag
                    verrechnet, sondern am Ende von dem abgezogen, was zu verteilen ist:{" "}
                    {kg(alpKg)} kg in dieser Saison, getragen von allen im Verhältnis
                    ihres Anspruchs.
                  </li>
                ) : null}
              </ul>
            </div>
          </>
        )}
      </div>
    </>
  );
}
