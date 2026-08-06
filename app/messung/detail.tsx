"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";

import { Aenderbar } from "@/components/Aendern";
import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { CowLink, RoundLink } from "@/components/Preview";
import QuickEntry from "@/components/QuickEntry";
import { Empty } from "@/components/ui";
import { useActions, type Action } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { liter, liter0 } from "@/lib/format";
import { savedKey } from "@/lib/formular";
import {
  formatDateDe,
  formatGemelk,
  gemelkAt,
  gemelkIndex,
  halfwayBoundary,
  SLOT_OPTIONS,
  slotLabel,
} from "@/lib/gemelk";

/*
  Von selbst zwischenspeichern
  ============================

  Im Melkstand liest man ab, tippt ein und geht zur nächsten Kuh. Dass jemand
  zwischendurch noch auf „Speichern“ drückt, ist nichts, worauf man bauen darf:
  ein leerer Akku, ein zugeklapptes Telefon oder ein Fehltritt auf der Treppe
  nähmen sonst eine halbe Melkung mit.

  Zwischenspeichern heißt hier wirklich speichern. Ein Messwert gilt für sich,
  ein halb gefülltes Blatt ist kein unfertiger Zustand, sondern eine Messung,
  die noch läuft — ein zweiter Entwurfsspeicher wäre nur ein zweiter Bestand,
  der auseinanderlaufen kann. Geschrieben wird, wenn das Tippen aufhört, und
  noch einmal, bevor die Seite verschwindet.
*/

/** Ruhe zwischen zwei Anschlägen, ab der geschrieben wird. */
const SAVE_AFTER = 900;

function useAutoSave(action: Action) {
  /*
    Das Formular kommt aus dem Anschlag selbst, der es meldet — dort steht es
    als `currentTarget`. So braucht die Maske dem Haken nichts zu reichen und
    der Haken der Maske nichts, was sie beim Zeichnen nicht anfassen dürfte.
  */
  const form = useRef<HTMLFormElement | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);

  const stop = useCallback(() => {
    if (timer.current !== null) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  // Dieselbe Stelle für den Knopf und für die Uhr: der Knopf reicht sein
  // Formular herein, die Uhr nimmt sich das Formular selbst.
  const save = useCallback(
    async (data: FormData) => {
      stop();
      setDirty(false);
      await action(data);
      setSavedAt(
        new Date().toLocaleTimeString("de-DE", { hour: "2-digit", minute: "2-digit" }),
      );
    },
    [action, stop],
  );

  const now = useCallback(() => {
    const el = form.current;
    if (el) void save(new FormData(el));
  }, [save]);

  const touch = useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      form.current = event.currentTarget;
      setDirty(true);
      stop();
      timer.current = setTimeout(now, SAVE_AFTER);
    },
    [now, stop],
  );

  /*
    Wer die Messung verlässt oder das Fenster schließt, wartet nicht die
    Ruhezeit ab — beim Aufräumen wird darum nachgeholt, was noch aussteht.
  */
  useEffect(() => {
    const flush = () => {
      if (timer.current !== null) now();
    };
    addEventListener("pagehide", flush);
    return () => {
      removeEventListener("pagehide", flush);
      flush();
    };
  }, [now]);

  const status = dirty
    ? "wird gespeichert …"
    : savedAt
      ? `gespeichert um ${savedAt} Uhr`
      : "speichert von selbst";

  return { save, status, touch };
}

/**
 * Zwei Wege in dieselbe Messung: das ganze Blatt auf einmal oder eine Kuh nach
 * der anderen. Die Wahl gilt nur für den Besuch — wer sie beim nächsten Mal
 * anders braucht, hat sie mit einem Griff wieder.
 */
const MODES: { value: "sheet" | "quick"; label: string }[] = [
  { value: "sheet", label: "Blatt" },
  { value: "quick", label: "Eintippen" },
];

export default function RoundDetail({ roundId }: { roundId: number }) {
  const view = useSeasonView();
  const { deleteRound, saveRoundValues, updateRound } = useActions();
  const sheet = useAutoSave(saveRoundValues);
  const [mode, setMode] = useState<"sheet" | "quick">("sheet");

  /*
    Was gerade getippt wurde, steht noch in keinem Bestand: geschrieben wird
    erst nach der Ruhezeit. Die Summen sollen aber sofort mitlaufen — sie sind
    ja dazu da, eine danebengegriffene Zahl auffallen zu lassen, und zwar
    während man sie eintippt und nicht eine Sekunde später. Deshalb merkt sich
    diese Ablage jeden Anschlag beim Namen des Feldes; was nicht darin steht,
    kommt aus dem gespeicherten Stand.
  */
  const [typed, setTyped] = useState<Record<string, string>>({});
  const noteTyped = (event: React.FormEvent<HTMLFormElement>) => {
    const field = event.target as HTMLInputElement;
    if (field.name) setTyped((before) => ({ ...before, [field.name]: field.value }));
    sheet.touch(event);
  };

  if (!view) return <NoSeason what="Eine Messung" />;

  const round = view.rounds.find((entry) => entry.id === roundId);
  if (!round) {
    return (
      <p className="notice">
        Diese Messung gibt es nicht. <Link href="/messung/">Zur Liste</Link>
      </p>
    );
  }

  const values = new Map(
    view.values.filter((value) => value.roundId === roundId).map((v) => [v.cowId, v]),
  );

  const index = view.rounds.findIndex((entry) => entry.id === roundId);
  const previous = index > 0 ? view.rounds[index - 1] : null;
  const next = index < view.rounds.length - 1 ? view.rounds[index + 1] : null;
  const previousValues = new Map(
    view.values.filter((value) => value.roundId === previous?.id).map((v) => [v.cowId, v]),
  );

  const firstIdx = gemelkIndex(round.firstDate, round.firstSlot);
  const secondIdx = firstIdx + 1;
  const anchor = firstIdx + 1;
  const validFrom = previous
    ? halfwayBoundary(gemelkIndex(previous.firstDate, previous.firstSlot) + 1, anchor)
    : gemelkIndex(view.season.startDate, "AM");
  const validTo = next
    ? halfwayBoundary(anchor, gemelkIndex(next.firstDate, next.firstSlot) + 1) - 1
    : gemelkIndex(view.season.endDate, "PM");

  const first = gemelkAt(firstIdx);
  const second = gemelkAt(secondIdx);

  // Kühe, die zu diesem Zeitpunkt tatsächlich gemolken wurden — vor dem Auftrieb
  // oder nach dem Trockenstellen gibt es nichts zu messen.
  const timelines = new Map(view.result.timelines.map((t) => [t.cowId, t]));
  const cows = view.activeHerd.filter((cow) => {
    const timeline = timelines.get(cow.id);
    if (!timeline) return false;
    return timeline.fromIdx <= secondIdx && timeline.toIdx >= firstIdx;
  });

  const groups: { farmerId: number; farmerName: string; cows: typeof cows }[] = [];
  for (const cow of cows) {
    const last = groups.at(-1);
    if (last && last.farmerId === cow.farmerId) last.cows.push(cow);
    else groups.push({ farmerId: cow.farmerId, farmerName: cow.farmerName, cows: [cow] });
  }

  /**
   * Der Wert einer Zelle, so wie er in diesem Augenblick dasteht: das eben
   * Getippte, sonst das Gespeicherte. Eine leere Zelle ist nicht null Liter,
   * sondern nichts — sie zählt in keine Summe hinein.
   */
  const cellL = (cowId: number, slot: "first" | "second"): number | null => {
    const key = `${slot}_${cowId}`;
    if (key in typed) {
      const raw = typed[key].trim().replace(",", ".");
      if (raw === "") return null;
      const parsed = Number(raw);
      return Number.isFinite(parsed) ? parsed : null;
    }
    const stored = values.get(cowId);
    if (!stored) return null;
    return (slot === "first" ? stored.firstL : stored.secondL) ?? null;
  };

  /** Was ein Hof in diesem Gemelk zusammen gegeben hat. */
  const groupSum = (herd: typeof cows, slot: "first" | "second") =>
    herd.reduce((sum, cow) => sum + (cellL(cow.id, slot) ?? 0), 0);

  const entered = cows.filter((cow) => values.has(cow.id)).length;
  const total = cows.reduce((sum, cow) => {
    const value = values.get(cow.id);
    return sum + (value?.firstL ?? 0) + (value?.secondL ?? 0);
  }, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="crumb" href="/messung/">
            ‹ Messungen
          </Link>
          <h1>
            Messung {formatDateDe(round.firstDate)} {slotLabel(round.firstSlot)}
          </h1>
          <p>
            {formatGemelk(firstIdx)} und {formatGemelk(secondIdx)} — gilt von{" "}
            {formatGemelk(validFrom)} bis {formatGemelk(validTo)}
          </p>
        </div>
        <div className="row no-print">
          {previous ? (
            <RoundLink className="btn btn-quiet" roundId={previous.id}>
              ‹ {formatDateDe(previous.firstDate)}
            </RoundLink>
          ) : null}
          {next ? (
            <RoundLink className="btn btn-quiet" roundId={next.id}>
              {formatDateDe(next.firstDate)} ›
            </RoundLink>
          ) : null}
          <Panel
            hint="Zeitpunkt ändern oder die Messung entfernen."
            id="messung-bearbeiten"
            title="Messung bearbeiten"
            trigger="Bearbeiten"
          >
            {/* Der Schlüssel hält die Maske am gespeicherten Stand und stellt
                den Schalter nach dem Speichern zurück — siehe
                `lib/formular.ts` und `components/Aendern.tsx`. Das Löschen
                liegt mit hinter dem Schalter: auch das ist eine Änderung, und
                zwar die gröbste. */}
            <Aenderbar
              key={savedKey(round.firstDate, round.firstSlot, round.note)}
              was="die Messung"
            >
              <form action={updateRound} className="stack-sm">
                <input type="hidden" name="id" value={roundId} />
                <div className="form-grid">
                  <DateField
                    defaultValue={round.firstDate}
                    id="firstDate"
                    label="Datum"
                    name="firstDate"
                    required
                  />
                  <div className="field">
                    <label htmlFor="firstSlot">beginnt</label>
                    <Dropdown
                      defaultValue={round.firstSlot}
                      id="firstSlot"
                      name="firstSlot"
                      options={SLOT_OPTIONS}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Notiz</label>
                    <input id="note" name="note" defaultValue={round.note ?? ""} />
                  </div>
                </div>
                <p className="small faint">
                  Ändert sich das Datum, verschieben sich auch die Gültigkeitsbereiche der
                  Nachbarmessungen.
                </p>
                <div className="panel-foot">
                  <button className="btn-primary" type="submit">
                    Speichern
                  </button>
                </div>
              </form>

              <div className="divider" style={{ margin: "16px 0 12px" }} />

              <form action={deleteRound} className="stack-sm">
                <input type="hidden" name="id" value={roundId} />
                <p className="small muted">
                  Löschen entfernt die Messung samt aller {entered} Messwerte. Die
                  benachbarten Messungen dehnen sich dann über den freigewordenen Zeitraum
                  aus.
                </p>
                <div className="panel-foot">
                  <button className="btn-quiet btn-danger" type="submit">
                    Messung löschen
                  </button>
                </div>
              </form>
            </Aenderbar>
          </Panel>
        </div>
      </div>

      <div className="card">
        <div className="card-head card-head-action">
          <div>
            <h2>Messwerte</h2>
            <p className="num">
              {entered} von {cows.length} Kühen — {liter0(total)} l
            </p>
          </div>
          {/*
            Zwei Wege zu denselben Zahlen: das Blatt für den, der abliest und
            einträgt, das Eintippen für den, der im Melkstand steht und die
            Hand nicht von der Tastatur nimmt.
          */}
          <div className="wahl no-print" role="group">
            {MODES.map((entry) => (
              <button
                aria-pressed={mode === entry.value}
                key={entry.value}
                onClick={() => setMode(entry.value)}
                type="button"
              >
                {entry.label}
              </button>
            ))}
          </div>
        </div>

        {mode === "quick" && cows.length > 0 ? (
          <QuickEntry
            cows={cows}
            first={`${slotLabel(first.slot)} ${formatDateDe(first.date).slice(0, 6)}`}
            roundId={roundId}
            second={`${slotLabel(second.slot)} ${formatDateDe(second.date).slice(0, 6)}`}
            values={values}
          />
        ) : (
          <form action={sheet.save} onInput={noteTyped}>
            <input type="hidden" name="roundId" value={roundId} />

            {cows.length === 0 ? (
              <Empty>
                Zu diesem Zeitpunkt war keine Kuh im Melkstand.{" "}
                <Link href="/kuehe/">Herde prüfen</Link>
              </Empty>
            ) : (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Kuh</th>
                        <th className="t-num" style={{ width: 120 }}>
                          {slotLabel(first.slot)}
                          <span className="faint small">
                            {" "}
                            {formatDateDe(first.date).slice(0, 6)}
                          </span>
                        </th>
                        <th className="t-num" style={{ width: 120 }}>
                          {slotLabel(second.slot)}
                          <span className="faint small">
                            {" "}
                            {formatDateDe(second.date).slice(0, 6)}
                          </span>
                        </th>
                        <th className="t-num">Tag</th>
                        <th className="t-num">zuletzt</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups.map((group) => (
                        <Fragment key={group.farmerId}>
                          <tr>
                            {/* Die Zelle liegt über mehrere Spalten und kann
                            deshalb selbst nicht stehen bleiben, wenn man die
                            Tabelle seitlich schiebt — der Name in ihr schon. */}
                            <td className="group-row">
                              <span>{group.farmerName}</span>
                            </td>
                            {/*
                              Neben dem Namen steht, was der Hof zusammen gegeben
                              hat, Spalte für Spalte über denselben Zahlen. Wer
                              das Blatt ausfüllt, sieht damit sofort, ob eine
                              Zahl danebengegriffen ist, statt es im Kopf
                              nachzurechnen. Die Summen laufen beim Tippen mit.
                            */}
                            <td className="group-row t-num">
                              {liter(groupSum(group.cows, "first"))}
                            </td>
                            <td className="group-row t-num">
                              {liter(groupSum(group.cows, "second"))}
                            </td>
                            <td className="group-row t-num">
                              {liter(
                                groupSum(group.cows, "first") +
                                  groupSum(group.cows, "second"),
                              )}
                            </td>
                            {/* Gab es vorher nichts, steht hier auch keine
                                Null: eine Summe aus lauter Strichen ist kein
                                Nullergebnis, sondern gar keines. */}
                            <td className="group-row t-num">
                              {group.cows.some((cow) => previousValues.has(cow.id))
                                ? liter(
                                    group.cows.reduce((sum, cow) => {
                                      const before = previousValues.get(cow.id);
                                      if (!before) return sum;
                                      return (
                                        sum + (before.firstL ?? 0) + (before.secondL ?? 0)
                                      );
                                    }, 0),
                                  )
                                : "—"}
                            </td>
                          </tr>
                          {group.cows.map((cow) => {
                            const value = values.get(cow.id);
                            const sum = (value?.firstL ?? 0) + (value?.secondL ?? 0);
                            const before = previousValues.get(cow.id);
                            const beforeSum = before
                              ? (before.firstL ?? 0) + (before.secondL ?? 0)
                              : null;
                            return (
                              <tr key={cow.id}>
                                <td>
                                  <input type="hidden" name="cowId" value={cow.id} />
                                  <CowLink cowId={cow.id}>{cow.name}</CowLink>{" "}
                                  <span className="bell">{cow.bellNumber}</span>
                                </td>
                                <td className="t-num">
                                  <input
                                    aria-label={`${cow.name} ${slotLabel(first.slot)}`}
                                    className="cell-input"
                                    name={`first_${cow.id}`}
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    inputMode="decimal"
                                    defaultValue={value?.firstL ?? ""}
                                  />
                                </td>
                                <td className="t-num">
                                  <input
                                    aria-label={`${cow.name} ${slotLabel(second.slot)}`}
                                    className="cell-input"
                                    name={`second_${cow.id}`}
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    inputMode="decimal"
                                    defaultValue={value?.secondL ?? ""}
                                  />
                                </td>
                                <td className="t-num">
                                  {value ? liter(sum) : <span className="faint">—</span>}
                                </td>
                                <td className="t-num faint">
                                  {beforeSum === null ? "—" : liter(beforeSum)}
                                </td>
                              </tr>
                            );
                          })}
                        </Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="row row-between" style={{ marginTop: 14 }}>
                  <p className="small faint">
                    Leer lassen heißt „nicht gemessen“. Fehlt nur eines der beiden Gemelke,
                    wird es aus dem Morgen-/Abendverhältnis der Herde ergänzt.
                  </p>
                  <div className="row no-print">
                    {/* Was von selbst geschieht, muss man sehen können — sonst weiß
                    niemand, ob er das Fenster schon zumachen darf. */}
                    <span aria-live="polite" className="small faint">
                      {sheet.status}
                    </span>
                    <button className="btn-primary" type="submit">
                      Werte speichern
                    </button>
                  </div>
                </div>
              </>
            )}
          </form>
        )}
      </div>
    </>
  );
}
