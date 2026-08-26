"use client";

import Link from "next/link";

import NoSeason from "@/components/NoSeason";
import { CowLink, FarmerLink } from "@/components/Preview";
import { Bars, Empty, Ghost, MiniBar, Sparkline, Stat } from "@/components/ui";
import type { SeasonTotals } from "@/lib/calc/report";
import { blockedCowsOn, daysSince } from "@/lib/calc/report";
import { useSeasonView } from "@/lib/data/store";
import { kg, kg0, liter, liter0, pct } from "@/lib/format";
import {
  dayRange,
  formatDateDe,
  formatDateShort,
  formatMonth,
  isoFromDayIndex,
} from "@/lib/gemelk";
import { cowLabel } from "@/lib/view";

/**
 * Der Beisatz unter dem verteilbaren Käse. Abzug und Alpkäse mindern beide, was
 * bei den Bauern ankommt, sind aber verschiedene Dinge — die Rate, die Tag für
 * Tag greift, und die gegessene Menge, die am Ende abgeht —, deshalb werden sie
 * einzeln genannt. Kommt keines von beiden vor, sagt der Beisatz stattdessen,
 * über wie viele Tage die Menge zusammenkam.
 */
function cheeseNote(totals: SeasonTotals): string {
  const parts: string[] = [];
  if (totals.deductionKg > 0) parts.push(`${kg(totals.deductionKg)} kg Abzug`);
  if (totals.alpKg > 0) parts.push(`${kg(totals.alpKg)} kg Alpkäse`);
  if (parts.length === 0) return `an ${totals.productionDays} Produktionstagen`;
  return [`${kg0(totals.producedKg)} kg produziert`, ...parts].join(", ");
}

export default function Page() {
  const view = useSeasonView();
  if (!view) {
    return (
      <>
        <div className="page-head">
          <h1>Übersicht</h1>
        </div>
        <NoSeason />
      </>
    );
  }

  const { season, asOf, result, totals, balances, farmerNames } = view;

  const days = dayRange(season.startDate, asOf).map((day) => isoFromDayIndex(day));
  const cheeseSeries = days.map((date) => view.productionByDate.get(date)?.kg ?? null);
  const milkSeries = days.map((date) => result.byDay.get(date)?.totalUsableL ?? null);

  const gaps = days.filter((date) => !view.productionByDate.has(date));
  const overdue = daysSince(view.lastRoundDate, asOf);
  const blocked = blockedCowsOn(result, asOf);
  /** Fällig ist nur, was aus abgeschlossenen Monaten offen steht. */
  const outstandingTotal = balances.reduce((sum, b) => sum + b.settledOutstandingKg, 0);

  const today = result.byDay.get(asOf);
  const cowsMilked = today?.cowsMilked ?? 0;
  const maxEntitled = Math.max(...balances.map((b) => b.entitledKg), 1);
  /** Der Monat, der noch nicht abgerechnet ist — für alle Bauern derselbe. */
  const openMonth = balances[0]?.openMonth ?? null;
  const ghostTotal = balances.reduce((sum, b) => sum + b.ghostKg, 0);

  const monthBars = view.months.map((month) => ({
    label: formatMonth(month.month).slice(0, 3),
    title: formatMonth(month.month),
    value: month.netCheeseKg,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Übersicht</h1>
          <p>
            Stand {formatDateDe(asOf)}
            {view.running ? " — Saison läuft" : ""}
          </p>
        </div>
        <div className="row no-print">
          <Link className="btn" href="/messung/">
            Messung eintragen
          </Link>
          <Link className="btn btn-primary" href="/kalender/">
            Käse eintragen
          </Link>
        </div>
      </div>

      <div className="stack">
        {overdue !== null && overdue >= 8 ? (
          <p className="notice notice-blocked">
            Die letzte Messung ist {overdue} Tage her ({formatDateDe(view.lastRoundDate!)}).{" "}
            <Link href="/messung/">Jetzt eintragen</Link>
          </p>
        ) : null}

        {gaps.length > 0 ? (
          <p className="notice">
            {gaps.length === 1
              ? `Für den ${formatDateDe(gaps[0])} fehlt die Käsemenge.`
              : `An ${gaps.length} Tagen fehlt die Käsemenge, zuletzt am ${formatDateDe(gaps.at(-1)!)}.`}{" "}
            <Link href="/kalender/">Im Kalender nachtragen</Link>
          </p>
        ) : null}

        <div className="grid grid-4">
          <Stat
            label="Käse verteilbar"
            value={kg0(totals.distributableKg)}
            unit="kg"
            note={cheeseNote(totals)}
          />
          <Stat
            label="Milch verwertbar"
            value={liter0(totals.usableMilkL)}
            unit="l"
            note={
              totals.blockedMilkL > 0
                ? `${liter(totals.blockedMilkL)} l wegen Behandlung verworfen`
                : undefined
            }
          />
          <Stat
            label="Kühe im Melkstand"
            value={String(cowsMilked)}
            note={`von ${view.activeHerd.length} auf der Alp`}
          />
          <Stat
            label="Offen bei den Bauern"
            value={kg0(outstandingTotal)}
            unit="kg"
            note={`${kg0(totals.pickedUpKg)} kg bereits abgeholt`}
          />
        </div>

        {/*
          Ein paar gesperrte Kühe füllen keine eigene Karte — als Hinweiszeile
          nehmen sie genau die Höhe ein, die sie brauchen.
        */}
        {blocked.length > 0 ? (
          <div className="notice notice-blocked notice-row">
            <span>
              Am {formatDateShort(asOf)} gesperrt, fließt nicht in die Verteilung:
            </span>
            {blocked.map((entry) => {
              const cow = view.cowNames.get(entry.cowId);
              return (
                <CowLink
                  className="chip chip-blocked"
                  cowId={entry.cowId}
                  key={entry.cowId}
                >
                  {cow ? cowLabel(cow) : `Kuh ${entry.cowId}`}
                  <span>
                    {entry.amBlocked && entry.pmBlocked
                      ? "ganztags"
                      : entry.amBlocked
                        ? "morgens"
                        : "abends"}
                  </span>
                </CowLink>
              );
            })}
          </div>
        ) : null}

        {/*
          Die drei Verläufe teilen sich eine Reihe. Einzeln über die volle Breite
          gezogen wirkten besonders die Monatsbalken grotesk breit — deshalb
          stehen sie in der Mitte: bleibt auf schmalen Fenstern eine Karte für
          die letzte Reihe übrig, ist es eine Linie, und die verträgt Breite.
        */}
        <div className="grid grid-3">
          <div className="card chart-card">
            <div className="card-head">
              <h2>Käse je Tag</h2>
              <p className="num">
                {kg(cheeseSeries.filter((v) => v !== null).at(-1) ?? 0)} kg zuletzt
              </p>
            </div>
            <div className="chart-body">
              <Sparkline dates={days} values={cheeseSeries} label="Käseproduktion" />
            </div>
          </div>

          {monthBars.length > 1 ? (
            <div className="card chart-card">
              <div className="card-head">
                <h2>Käse je Monat</h2>
                <p>kg verteilbar</p>
              </div>
              <div className="chart-body">
                <Bars data={monthBars} />
              </div>
            </div>
          ) : null}

          <div className="card chart-card">
            <div className="card-head">
              <h2>Verwertbare Milch je Tag</h2>
              <p className="num">
                {liter0(milkSeries.filter((v) => v !== null).at(-1) ?? 0)} l zuletzt
              </p>
            </div>
            <div className="chart-body">
              <Sparkline dates={days} values={milkSeries} label="Milchmenge" unit="l" />
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Käsekonto der Bauern</h2>
            <p>
              monatlich abgerechnet
              {openMonth
                ? ` — der ${formatMonth(openMonth).replace(/ \d{4}$/, "")} läuft noch`
                : ` — Stand ${formatDateShort(asOf)}`}
            </p>
          </div>
          {balances.length === 0 ? (
            <Empty>Noch keine Zuteilung — es fehlen Messwerte oder Käsemengen.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bauer</th>
                    <th className="t-num">Kühe</th>
                    <th className="t-num">Milch</th>
                    <th className="t-num">Anteil</th>
                    <th style={{ width: "18%" }} />
                    <th className="t-num">abgerechnet</th>
                    <th className="t-num">abgeholt</th>
                    <th className="t-num">offen</th>
                  </tr>
                </thead>
                <tbody>
                  {balances.map((balance) => (
                    <tr className="linked" key={balance.farmerId}>
                      <td>
                        <FarmerLink farmerId={balance.farmerId}>
                          {farmerNames.get(balance.farmerId) ?? "—"}
                        </FarmerLink>
                      </td>
                      <td className="t-num">{balance.cowCount}</td>
                      <td className="t-num">{liter0(balance.usableL)}</td>
                      <td className="t-num">
                        {pct(
                          totals.usableMilkL > 0 ? balance.usableL / totals.usableMilkL : 0,
                        )}
                      </td>
                      <td>
                        <MiniBar value={balance.entitledKg} max={maxEntitled} />
                      </td>
                      <td className="t-num">
                        {kg(balance.settledKg)}
                        <Ghost
                          block
                          title={`im ${openMonth ? formatMonth(openMonth) : "laufenden Monat"} dazugekommen, noch nicht abgerechnet`}
                          value={balance.ghostKg}
                        />
                      </td>
                      <td className="t-num faint">{kg(balance.pickedUpKg)}</td>
                      <td className="t-num">{kg(balance.settledOutstandingKg)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td>Summe</td>
                    <td className="t-num">{view.activeHerd.length}</td>
                    <td className="t-num">{liter0(totals.usableMilkL)}</td>
                    <td className="t-num">{pct(1)}</td>
                    <td />
                    <td className="t-num">
                      {kg(totals.netCheeseKg - totals.unallocatedKg - ghostTotal)}
                      <Ghost block value={ghostTotal} />
                    </td>
                    <td className="t-num">{kg(totals.pickedUpKg)}</td>
                    <td className="t-num">{kg(outstandingTotal)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          {openMonth && ghostTotal > 0.05 ? (
            <p className="small faint" style={{ marginTop: 10 }}>
              Abgerechnet wird zum Monatsende. Die gestrichelte Zahl ist der Schatten des
              laufenden Monats: {kg(ghostTotal)} kg sind im{" "}
              {formatMonth(openMonth).replace(/ \d{4}$/, "")} bis {formatDateShort(asOf)}{" "}
              dazugekommen.
            </p>
          ) : null}
          {totals.unallocatedKg > 0 ? (
            <p className="small faint" style={{ marginTop: 10 }}>
              {kg(totals.unallocatedKg)} kg Käse fielen an Tagen ohne verwertbare Milch an
              und sind keinem Bauern zugeordnet.
            </p>
          ) : null}
        </div>
      </div>
    </>
  );
}
