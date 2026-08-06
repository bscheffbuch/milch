"use client";

import Link from "next/link";

import BlockCalendar, { BlockLegend } from "@/components/BlockCalendar";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { CowLink } from "@/components/Preview";
import TreatmentForm, { EndTreatmentForm } from "@/components/TreatmentForm";
import { Empty } from "@/components/ui";
import { blockedSpanL } from "@/lib/calc/report";
import { buildBlockBars } from "@/lib/calendar";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { liter } from "@/lib/format";
import {
  formatDateDe,
  formatGemelk,
  gemelkIndex,
  gemelkeToDays,
  slotLabel,
} from "@/lib/gemelk";

export default function Page() {
  const view = useSeasonView();
  const { deleteTreatment } = useActions();
  if (!view) return <NoSeason what="Behandlungen" />;

  const timelines = new Map(view.result.timelines.map((t) => [t.cowId, t]));
  const nowIdx = gemelkIndex(view.asOf, "PM");

  const rows = [...view.treatments]
    .sort((a, b) =>
      b.startDate === a.startDate
        ? b.startSlot.localeCompare(a.startSlot)
        : b.startDate.localeCompare(a.startDate),
    )
    .map((treatment) => {
      const timeline = timelines.get(treatment.cowId);
      const span = timeline?.blocked.find((entry) =>
        entry.treatmentIds.includes(treatment.id),
      );
      return {
        treatment,
        span,
        lostL: timeline && span ? blockedSpanL(timeline, span) : 0,
        active: span ? span.fromIdx <= nowIdx && span.toIdx >= nowIdx : false,
      };
    });

  const lostTotal = view.result.timelines.reduce((sum, t) => sum + t.totalBlockedL, 0);
  const bars = buildBlockBars(view);

  const cows = view.activeHerd.map((cow) => ({
    id: cow.id,
    name: cow.name,
    bellNumber: cow.bellNumber,
    farmerId: cow.farmerId,
    farmerName: cow.farmerName,
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Behandlungen</h1>
          <p>
            {view.treatments.length === 0
              ? "keine in dieser Saison"
              : `${view.treatments.length} in ${view.season.name} — ${liter(lostTotal)} l Milch verworfen`}
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Die Wartezeit zählt ab dem letzten Behandlungsgemelk."
            id="behandlung-neu"
            primary
            title="Behandlung eintragen"
            trigger="Behandlung eintragen"
          >
            <TreatmentForm
              seasonId={view.season.id}
              cows={cows}
              types={view.treatmentTypes}
              defaultDate={view.asOf}
            />
            <p className="small faint" style={{ marginTop: 12 }}>
              Voreinstellungen lassen sich unter{" "}
              <Link href="/einstellungen/">Einstellungen</Link> pflegen.
            </p>
          </Panel>
        </div>
      </div>

      <div className="stack">
        <div className="card stack-sm">
          <div className="card-head">
            <h2>Behandelt und gesperrt</h2>
            <p>
              ganze Saison, ein Balken je Sperrzeitraum — Stand {formatDateDe(view.asOf)}
            </p>
          </div>
          <BlockCalendar
            bars={bars}
            endDate={view.season.endDate}
            startDate={view.season.startDate}
            today={view.asOf}
          />
          <BlockLegend withToday />
        </div>

        <div className="card">
          {rows.length === 0 ? (
            <Empty>
              Noch keine Behandlung eingetragen. Die Sperrfrist zählt ab dem letzten
              Behandlungsgemelk und schließt es ein.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Kuh</th>
                    <th>Behandlung</th>
                    <th>von</th>
                    <th>bis</th>
                    <th className="t-num">Wartezeit</th>
                    <th>Milch gesperrt</th>
                    <th className="t-num">verworfen</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ treatment, span, lostL, active: isActive }) => {
                    const cow = view.cowNames.get(treatment.cowId);
                    return (
                      <tr key={treatment.id}>
                        <td>
                          <CowLink cowId={treatment.cowId}>
                            {cow?.name ?? `Kuh ${treatment.cowId}`}
                          </CowLink>{" "}
                          <span className="bell">{cow?.bellNumber}</span>
                          <div className="faint small">{cow?.farmerName}</div>
                        </td>
                        <td>
                          {treatment.label}
                          {treatment.note ? (
                            <div className="faint small">{treatment.note}</div>
                          ) : null}
                        </td>
                        <td className="num small">
                          {formatDateDe(treatment.startDate)}{" "}
                          {slotLabel(treatment.startSlot)}
                        </td>
                        <td className="num small">
                          {treatment.endDate === null || treatment.endSlot === null ? (
                            <span className="chip chip-blocked">läuft</span>
                          ) : treatment.startDate === treatment.endDate &&
                            treatment.startSlot === treatment.endSlot ? (
                            <span className="faint">—</span>
                          ) : (
                            `${formatDateDe(treatment.endDate)} ${slotLabel(treatment.endSlot)}`
                          )}
                        </td>
                        <td className="t-num">
                          {treatment.withholdGemelke === 0
                            ? "keine"
                            : `${treatment.withholdGemelke} (${gemelkeToDays(treatment.withholdGemelke)} T)`}
                        </td>
                        <td className="small">
                          {span ? (
                            <span className={isActive ? "blocked-text num" : "num muted"}>
                              {formatGemelk(span.fromIdx)} – {formatGemelk(span.toIdx)}
                            </span>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </td>
                        <td className="t-num">
                          {lostL > 0 ? (
                            <span className="blocked-text">{liter(lostL)}</span>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </td>
                        <td className="t-num no-print">
                          <div className="row row-end">
                            {treatment.endDate === null ? (
                              <Panel
                                hint="Ab dem letzten Behandlungsgemelk zählt die Wartezeit."
                                id={`behandlung-ende-${treatment.id}`}
                                quiet
                                title="Behandlung beenden"
                                trigger="Beenden"
                              >
                                <EndTreatmentForm
                                  defaultDate={view.asOf}
                                  minDate={treatment.startDate}
                                  treatmentId={treatment.id}
                                />
                              </Panel>
                            ) : null}
                            <form action={deleteTreatment}>
                              <input type="hidden" name="id" value={treatment.id} />
                              <button
                                className="btn-quiet btn-danger btn-sm zeilen-tat"
                                type="submit"
                              >
                                Löschen
                              </button>
                            </form>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          <p className="small faint" style={{ marginTop: 10 }}>
            Verworfene Milch trägt der Bauer der behandelten Kuh selbst — sein Anteil sinkt,
            die übrigen steigen entsprechend. Grenzen mehrere Behandlungen aneinander,
            werden sie zu einem Sperrzeitraum zusammengefasst.
          </p>
        </div>
      </div>
    </>
  );
}
