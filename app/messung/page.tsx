"use client";

import { useSearchParams } from "next/navigation";

import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { RoundLink } from "@/components/Preview";
import { Empty } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { liter, liter0 } from "@/lib/format";
import {
  dayIndex,
  formatDateDe,
  formatGemelk,
  gemelkIndex,
  halfwayBoundary,
  slotLabel,
} from "@/lib/gemelk";
import { idFrom } from "@/lib/routes";

import RoundDetail from "./detail";

export default function Page() {
  const roundId = idFrom(useSearchParams());
  // Der Schlüssel baut die Detailansicht beim Wechsel neu auf — sonst behielten
  // die Eingabefelder die Messwerte der zuvor gezeigten Messung.
  return roundId === null ? <RoundList /> : <RoundDetail roundId={roundId} key={roundId} />;
}

function RoundList() {
  const view = useSeasonView();
  const { createRound } = useActions();
  if (!view) return <NoSeason what="Messungen" />;

  const byRound = new Map<number, { cows: number; totalL: number; partial: number }>();
  for (const value of view.values) {
    const entry = byRound.get(value.roundId) ?? {
      cows: 0,
      totalL: 0,
      partial: 0,
    };
    entry.cows++;
    entry.totalL += (value.firstL ?? 0) + (value.secondL ?? 0);
    if (value.firstL === null || value.secondL === null) entry.partial++;
    byRound.set(value.roundId, entry);
  }

  // Anker liegen zwischen den beiden Gemelken einer Messung; die Halbzeit-Regel
  // rechnet von Anker zu Anker. Das hier ist die Sicht auf die ganze Herde —
  // einzelne Kühe werden zusätzlich von Auftrieb und Trockenstellen begrenzt.
  const seasonFrom = gemelkIndex(view.season.startDate, "AM");
  const seasonTo = gemelkIndex(view.season.endDate, "PM");
  const anchors = view.rounds.map(
    (round) => gemelkIndex(round.firstDate, round.firstSlot) + 1,
  );

  const rows = view.rounds.map((round, i) => {
    const from = i === 0 ? seasonFrom : halfwayBoundary(anchors[i - 1], anchors[i]);
    const to =
      i === view.rounds.length - 1
        ? seasonTo
        : halfwayBoundary(anchors[i], anchors[i + 1]) - 1;
    const stats = byRound.get(round.id) ?? { cows: 0, totalL: 0, partial: 0 };
    const gap =
      i === 0 ? null : dayIndex(round.firstDate) - dayIndex(view.rounds[i - 1].firstDate);
    return { round, from, to, stats, gap };
  });

  const missing = view.activeHerd.length;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Messungen</h1>
          <p>
            {view.rounds.length === 0
              ? "noch keine"
              : `${view.rounds.length} in ${view.season.name}`}
            {view.lastRoundDate ? ` — zuletzt ${formatDateDe(view.lastRoundDate)}` : ""}
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Eintragen wird das erste der beiden Gemelke."
            id="messung-neu"
            primary
            title="Neue Messung"
            trigger="Messung anlegen"
          >
            <form action={createRound} className="stack-sm">
              <input type="hidden" name="seasonId" value={view.season.id} />
              <div className="form-grid">
                <DateField
                  defaultValue={view.asOf}
                  id="firstDate"
                  label="Datum"
                  name="firstDate"
                  required
                />
                <div className="field">
                  <label htmlFor="firstSlot">beginnt</label>
                  <Dropdown
                    defaultValue="AM"
                    id="firstSlot"
                    name="firstSlot"
                    options={[
                      {
                        hint: "mit dem Abend desselben Tages",
                        label: "morgens",
                        value: "AM",
                      },
                      { hint: "mit dem Morgen danach", label: "abends", value: "PM" },
                    ]}
                  />
                </div>
                <div className="field">
                  <label htmlFor="note">Notiz</label>
                  <input id="note" name="note" placeholder="optional" />
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn-primary" type="submit">
                  Anlegen und Werte eintragen
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      <div className="card">
        {rows.length === 0 ? (
          <Empty>
            Noch keine Messung eingetragen. Eine Messung sind zwei aufeinanderfolgende
            Gemelke — morgens und abends desselben Tages oder abends und der Morgen darauf.
          </Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Messung</th>
                  <th className="t-num">Abstand</th>
                  <th className="t-num">Kühe</th>
                  <th className="t-num">Tagesmenge</th>
                  <th>gilt von</th>
                  <th>bis</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ round, from, to, stats, gap }) => (
                  <tr className="linked" key={round.id}>
                    <td>
                      <RoundLink roundId={round.id}>
                        {formatDateDe(round.firstDate)} {slotLabel(round.firstSlot)}
                      </RoundLink>
                      {round.note ? (
                        <span className="faint small"> — {round.note}</span>
                      ) : null}
                    </td>
                    <td className="t-num faint">{gap === null ? "—" : `${gap} T`}</td>
                    <td className="t-num">
                      {stats.cows}
                      {stats.cows < missing ? (
                        <span className="faint"> / {missing}</span>
                      ) : null}
                      {stats.partial > 0 ? (
                        <span className="faint small"> · {stats.partial} halb</span>
                      ) : null}
                    </td>
                    <td className="t-num">{liter0(stats.totalL)}</td>
                    <td className="num small">{formatGemelk(from)}</td>
                    <td className="num small">{formatGemelk(to)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Summe</td>
                  <td />
                  <td />
                  <td className="t-num">
                    {liter(rows.reduce((sum, row) => sum + row.stats.totalL, 0))}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <p className="small faint" style={{ marginTop: 10 }}>
          Jede Messung gilt von der Hälfte zur vorigen bis zur Hälfte zur nächsten. Die
          erste reicht bis zum Auftrieb zurück, die letzte bis zum Trockenstellen oder
          Saisonende — so bleibt kein Tag unbewertet.
        </p>
      </div>
    </>
  );
}
