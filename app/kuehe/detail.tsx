"use client";

import Link from "next/link";

import { Aenderbar } from "@/components/Aendern";
import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { FarmerLink, RoundLink } from "@/components/Preview";
import TreatmentForm, { EndTreatmentForm } from "@/components/TreatmentForm";
import { Empty, Stat } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { liter, liter0 } from "@/lib/format";
import { savedKey } from "@/lib/formular";
import {
  formatDateDe,
  formatGemelk,
  gemelkeToDays,
  SLOT_OPTIONS,
  slotLabel,
} from "@/lib/gemelk";

export default function CowDetail({ cowId }: { cowId: number }) {
  const view = useSeasonView();
  const { deleteTreatment, saveCowSeason, updateCow } = useActions();

  if (!view) return <NoSeason what="Eine Kuh" />;

  const cow = view.cowNames.get(cowId);
  if (!cow) {
    return (
      <p className="notice">
        Diese Kuh gibt es nicht. <Link href="/kuehe/">Zur Liste</Link>
      </p>
    );
  }

  const cowSeason = view.cowSeasons.find((entry) => entry.cowId === cowId) ?? null;
  const timeline = view.result.timelines.find((entry) => entry.cowId === cowId);
  const treatments = view.treatments.filter((entry) => entry.cowId === cowId);
  const roundById = new Map(view.rounds.map((round) => [round.id, round]));

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="crumb" href="/kuehe/">
            ‹ Kühe
          </Link>
          <h1>
            {cow.name} <span className="bell">{cow.bellNumber}</span>
          </h1>
          <p>
            <FarmerLink farmerId={cow.farmerId}>
              {view.farmerNames.get(cow.farmerId) ?? "—"}
            </FarmerLink>
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Die Wartezeit zählt ab dem letzten Behandlungsgemelk."
            id="kuh-behandlung"
            primary
            title="Behandlung eintragen"
            trigger="Behandlung"
          >
            <TreatmentForm
              seasonId={view.season.id}
              cowId={cowId}
              types={view.treatmentTypes}
              defaultDate={view.asOf}
            />
          </Panel>
          <Panel
            hint={view.season.name}
            id="kuh-saison"
            title="Auftrieb und Saisonende"
            trigger="Saison"
          >
            {/*
              Der Schlüssel hängt am gespeicherten Stand: ändert er sich, baut
              React die Felder mit den neuen Vorgaben auf und stellt den
              Schalter zurück. Ohne ihn stünde nach dem Speichern in „nach dem
              Gemelk“ wieder der alte Wert — siehe `lib/formular.ts` und
              `components/Aendern.tsx`.
            */}
            <Aenderbar
              key={savedKey(
                cowSeason?.arrivalDate,
                cowSeason?.arrivalSlot,
                cowSeason?.dryOffDate,
                cowSeason?.dryOffSlot,
                cowSeason?.departureDate,
                cowSeason?.departureSlot,
              )}
              was="Auftrieb und Saisonende"
            >
              <form action={saveCowSeason} className="stack-sm">
                <input type="hidden" name="seasonId" value={view.season.id} />
                <input type="hidden" name="cowId" value={cowId} />
                <input type="hidden" name="farmerId" value={cow.farmerId} />

                <div className="form-grid">
                  <DateField
                    defaultValue={cowSeason?.arrivalDate ?? view.season.startDate}
                    id="arrivalDate"
                    label="Auftrieb"
                    name="arrivalDate"
                  />
                  <div className="field">
                    <label htmlFor="arrivalSlot">ab Gemelk</label>
                    <Dropdown
                      defaultValue={cowSeason?.arrivalSlot ?? "AM"}
                      id="arrivalSlot"
                      name="arrivalSlot"
                      options={SLOT_OPTIONS}
                    />
                  </div>
                  <DateField
                    defaultValue={cowSeason?.dryOffDate ?? ""}
                    id="dryOffDate"
                    label="Trockengestellt am"
                    name="dryOffDate"
                  />
                  <div className="field">
                    <label htmlFor="dryOffSlot">nach dem Gemelk</label>
                    <Dropdown
                      defaultValue={cowSeason?.dryOffSlot ?? "PM"}
                      id="dryOffSlot"
                      name="dryOffSlot"
                      options={SLOT_OPTIONS}
                    />
                  </div>
                  <DateField
                    defaultValue={cowSeason?.departureDate ?? ""}
                    id="departureDate"
                    label="Abtrieb"
                    name="departureDate"
                  />
                  <div className="field">
                    <label htmlFor="departureSlot">letztes Gemelk</label>
                    <Dropdown
                      defaultValue={cowSeason?.departureSlot ?? "PM"}
                      id="departureSlot"
                      name="departureSlot"
                      options={SLOT_OPTIONS}
                    />
                  </div>
                </div>

                <p className="small faint">
                  Trockengestellt wird nach dem Melken — das angegebene Gemelk zählt noch
                  mit. Ohne Auftriebsdatum nimmt die Kuh nicht an der Saison teil.
                </p>
                <div className="panel-foot">
                  <button className="btn-primary" type="submit">
                    Speichern
                  </button>
                </div>
              </form>
            </Aenderbar>
          </Panel>
          <Panel id="kuh-stamm" title="Stammdaten" trigger="Stammdaten">
            <Aenderbar
              key={savedKey(cow.bellNumber, cow.name, cow.farmerId, cow.note)}
              was="die Stammdaten"
            >
              <form action={updateCow} className="stack-sm">
                <input type="hidden" name="id" value={cow.id} />
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="bellNumber">Glockennummer</label>
                    <input
                      id="bellNumber"
                      name="bellNumber"
                      defaultValue={cow.bellNumber}
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input id="name" name="name" defaultValue={cow.name} required />
                  </div>
                  <div className="field">
                    <label htmlFor="farmerId">Bauer</label>
                    <Dropdown
                      defaultValue={String(cow.farmerId)}
                      id="farmerId"
                      name="farmerId"
                      options={view.farmers.map((farmer) => ({
                        label: farmer.name,
                        value: String(farmer.id),
                      }))}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Notiz</label>
                    <input id="note" name="note" defaultValue={cow.note ?? ""} />
                  </div>
                </div>
                <div className="panel-foot">
                  <button className="btn-primary" type="submit">
                    Speichern
                  </button>
                </div>
              </form>
            </Aenderbar>
          </Panel>
        </div>
      </div>

      <div className="stack">
        {!cowSeason ? (
          <p className="notice">
            Diese Kuh ist für {view.season.name} nicht eingetragen und zählt daher nicht
            mit. Unten lässt sich der Auftrieb nachtragen.
          </p>
        ) : null}

        <div className="grid grid-4">
          <Stat
            label="Milch verwertbar"
            value={liter0(timeline?.totalUsableL ?? 0)}
            unit="l"
            note={
              timeline
                ? `${formatGemelk(timeline.fromIdx)} bis ${formatGemelk(timeline.toIdx)}`
                : undefined
            }
          />
          <Stat
            label="Wegen Behandlung verworfen"
            value={liter(timeline?.totalBlockedL ?? 0)}
            unit="l"
          />
          <Stat label="Messungen" value={String(timeline?.spans.length ?? 0)} />
          <Stat
            label="Ø je Tag"
            value={
              timeline && timeline.days.length > 0
                ? liter(timeline.totalUsableL / timeline.days.length)
                : "0,0"
            }
            unit="l"
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Gültigkeitsbereiche der Messungen</h2>
            <p>
              Jede Messung gilt bis zur Hälfte zur nächsten — also schon vor und noch nach
              dem Messtag.
            </p>
          </div>
          {!timeline || timeline.spans.length === 0 ? (
            <Empty>
              Für diese Kuh gibt es noch keine Messwerte.{" "}
              <Link href="/messung/">Messung eintragen</Link>
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Messung</th>
                    <th className="t-num">morgens</th>
                    <th className="t-num">abends</th>
                    <th className="t-num">Tagesmenge</th>
                    <th>gilt von</th>
                    <th>bis</th>
                    <th className="t-num">Gemelke</th>
                  </tr>
                </thead>
                <tbody>
                  {timeline.spans.map((span) => {
                    const round = roundById.get(span.roundId);
                    return (
                      <tr key={span.roundId}>
                        <td>
                          <RoundLink roundId={span.roundId}>
                            {round
                              ? `${formatDateDe(round.firstDate)} ${slotLabel(round.firstSlot)}`
                              : formatGemelk(span.anchor)}
                          </RoundLink>
                        </td>
                        <td className="t-num">
                          {liter(span.amL)}
                          {span.amEstimated ? (
                            <span className="faint"> geschätzt</span>
                          ) : null}
                        </td>
                        <td className="t-num">
                          {liter(span.pmL)}
                          {span.pmEstimated ? (
                            <span className="faint"> geschätzt</span>
                          ) : null}
                        </td>
                        <td className="t-num">{liter(span.amL + span.pmL)}</td>
                        <td className="num small">{formatGemelk(span.fromIdx)}</td>
                        <td className="num small">{formatGemelk(span.toIdx)}</td>
                        <td className="t-num faint">{span.toIdx - span.fromIdx + 1}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {timeline?.spans.some((span) => span.amEstimated || span.pmEstimated) ? (
            <p className="small faint" style={{ marginTop: 10 }}>
              Fehlt ein halbes Gemelk, wird es aus dem Morgen-/Abendverhältnis der Herde
              ergänzt ({Math.round(view.result.amShare * 100)} % morgens).
            </p>
          ) : null}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Behandlungen</h2>
            {timeline && timeline.blocked.length > 0 ? (
              <p>{timeline.blocked.length} Sperrzeitraum/-räume</p>
            ) : null}
          </div>

          {treatments.length === 0 ? (
            <Empty>Keine Behandlung eingetragen.</Empty>
          ) : (
            <div className="table-wrap" style={{ marginBottom: 14 }}>
              <table>
                <thead>
                  <tr>
                    <th>Behandlung</th>
                    <th>von</th>
                    <th>bis</th>
                    <th className="t-num">Wartezeit</th>
                    <th>Milch gesperrt</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {treatments.map((treatment) => {
                    const span = timeline?.blocked.find((entry) =>
                      entry.treatmentIds.includes(treatment.id),
                    );
                    return (
                      <tr key={treatment.id}>
                        <td>
                          {treatment.label}
                          {treatment.note ? (
                            <span className="faint small"> — {treatment.note}</span>
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
                            <span className="blocked-text num">
                              {formatGemelk(span.fromIdx)} – {formatGemelk(span.toIdx)}
                            </span>
                          ) : (
                            <span className="faint">—</span>
                          )}
                        </td>
                        <td className="t-num no-print">
                          <div className="row row-end">
                            {treatment.endDate === null ? (
                              <Panel
                                hint="Ab dem letzten Behandlungsgemelk zählt die Wartezeit."
                                id={`kuh-behandlung-ende-${treatment.id}`}
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
        </div>
      </div>
    </>
  );
}
