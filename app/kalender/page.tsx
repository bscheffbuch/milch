"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { startTransition, useEffect, useOptimistic, useRef, useState } from "react";

import { BlockLegend, SpanBar } from "@/components/BlockCalendar";
import DateField from "@/components/DateField";
import CalSide from "@/components/CalSide";
import { DayMarks, MarkLegend } from "@/components/DayMarks";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { CowLink, FarmerLink, RoundLink } from "@/components/Preview";
import { Empty } from "@/components/ui";
import {
  buildBlockBars,
  buildDayEvents,
  monthGrid,
  packLanes,
  shiftMonth,
} from "@/lib/calendar";
import type { BlockBar, DayEvents } from "@/lib/calendar";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { kg, liter, liter0, pct, weekdayOf } from "@/lib/format";
import { savedKey } from "@/lib/formular";
import {
  formatDateDe,
  formatDateShort,
  formatMonth,
  isoFromDayIndex,
  monthAbbr,
  monthOf,
  monthsBetween,
} from "@/lib/gemelk";
import { calendarHref } from "@/lib/routes";
import {
  datesBetween,
  parseSelection,
  selectionRuns,
  serializeSelection,
  toggleDate,
} from "@/lib/selection";
import { cowLabel } from "@/lib/view";
import type { SeasonView } from "@/lib/view";

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

export default function Page() {
  const view = useSeasonView();
  if (!view) return <NoSeason what="Der Kalender" />;
  return <Calendar view={view} />;
}

/**
 * Was während des Ziehens gerade unter der Maus entsteht. Erst beim Loslassen
 * wandert das Ergebnis in die Adresse — sonst schriebe jede Mausbewegung einen
 * neuen Verlaufseintrag.
 */
interface Drag {
  anchor: string;
  over: string;
  /** Die Auswahl vor dem Ziehen — nur beim additiven Ziehen gebraucht. */
  base: string[];
  additive: boolean;
  moved: boolean;
}

function Calendar({ view }: { view: SeasonView }) {
  const params = useSearchParams();
  const router = useRouter();
  const { saveProduction, saveProductionDays, saveProductionRange } = useActions();

  const [drag, setDrag] = useState<Drag | null>(null);
  /** Der zuletzt angeklickte Tag — von ihm aus spannt die Umschalttaste auf. */
  const anchor = useRef<string | null>(null);
  /** Dasselbe wie `drag`, aber sofort lesbar — siehe den Zuhörer weiter unten. */
  const pending = useRef<Drag | null>(null);

  const wanted = params.get("m");
  const months = monthsBetween(view.season.startDate, view.season.endDate);
  const month = wanted && months.includes(wanted) ? wanted : monthOf(view.asOf);

  /*
    Fehlt `d` ganz, ist der Stichtag gemeint — der Kalender öffnet auf heute.
    Ein leeres `d` ist die ausdrückliche Abwahl und bleibt leer.
  */
  const raw = params.get("d");
  const chosen = raw === null ? [view.asOf] : parseSelection(raw);

  /*
    Was gemalt ist, während die Adresse noch nachzieht.

    `router.replace` wirkt erst mit der nächsten Transition. Ohne einen
    Zwischenstand läge dazwischen ein Anstrich mit der alten Auswahl — das war
    das Zucken beim Loslassen. Der Zwischenstand hält genau so lange, wie die
    Transition läuft, und fällt dann von selbst weg; danach steht in `chosen`
    ohnehin dasselbe. Ein Vergleich mit dem alten `d` wäre der falsche Weg:
    kehrt die Adresse zu einem früheren Wert zurück — und genau das tut sie
    beim Abwählen, `d=` war schon einmal da —, hielte er den überholten Stand
    für den aktuellen und die Abwahl bliebe wirkungslos.
  */
  const [painted, paint] = useOptimistic(chosen);

  const selection = drag ? dragResult(drag) : painted;
  const selected = new Set(selection);
  /** Genau der heutige Tag gewählt — dann führt „Heute“ nirgendwo mehr hin. */
  const onlyToday = painted.length === 1 && painted[0] === view.asOf;
  const runs = selectionRuns(selection);

  const apply = (dates: string[]) => {
    startTransition(() => {
      paint(dates);
      router.replace(calendarHref(month, dates), { scroll: false });
    });
  };

  const applyRef = useRef(apply);
  /** Ob überhaupt etwas gewählt ist — sonst gibt es nichts abzuwählen. */
  const anySelected = useRef(false);
  useEffect(() => {
    applyRef.current = apply;
    anySelected.current = painted.length > 0;
  });

  /*
    Losgelassen wird oft außerhalb des Kalenders — deshalb hängt der Abschluss
    am Fenster und nicht am Tag. Der Zuhörer wird einmal angemeldet und liest
    den Stand aus `pending`: hinge er am Zustand, wäre er beim Loslassen noch
    gar nicht angemeldet, wenn jemand sehr schnell klickt.
  */
  useEffect(() => {
    const finish = () => {
      const current = pending.current;
      if (!current) return;
      pending.current = null;
      // Beides im selben Ereignis: der Zug endet und sein Ergebnis wird im
      // selben Anstrich gemalt. Dazwischen gibt es kein Bild mit der alten
      // Auswahl, also auch kein Zucken.
      setDrag(null);
      applyRef.current(commitSelection(current));
    };

    window.addEventListener("pointerup", finish);
    window.addEventListener("pointercancel", finish);
    return () => {
      window.removeEventListener("pointerup", finish);
      window.removeEventListener("pointercancel", finish);
    };
  }, []);

  /*
    Ein Griff daneben hebt die Auswahl auf.

    Die Auswahl gehört dem Raster; wer woanders hinfasst, ist mit den Tagen
    fertig. Verschont bleibt, was mit der Auswahl arbeitet — die Tagesspalte
    und jede andere Fläche der Ablage, dazu die Kopfzeile, aus der heraus der
    gewählte Zeitraum in eine Maske übernommen wird — und die Navigation, die
    von der Seite wegführt und dabei ohnehin nichts mitnimmt. Ein leeres `d`
    in der Adresse ist die ausdrückliche Abwahl; deshalb `apply([])` und
    nicht etwa ein Weglassen.
  */
  useEffect(() => {
    const clear = (event: PointerEvent) => {
      if (event.button !== 0 || !anySelected.current) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const keeps = ".cal, .page-head, .dock-col, .dock-surface, .dock-drop, .nav";
      if (target.closest(keeps)) return;
      applyRef.current([]);
    };

    window.addEventListener("pointerdown", clear);
    return () => window.removeEventListener("pointerdown", clear);
  }, []);

  const onDayPointerDown = (event: React.PointerEvent, date: string) => {
    if (event.button !== 0) return;
    // Kein Textmarkieren, und der Tag behält den Tastaturfokus nicht.
    event.preventDefault();
    // Beim Tippen fängt das Element den Zeiger von selbst ein; dann bekämen die
    // übrigen Tage kein `pointerenter` und das Ziehen bliebe auf einem stehen.
    const cell = event.currentTarget;
    if (cell.hasPointerCapture?.(event.pointerId)) {
      cell.releasePointerCapture(event.pointerId);
    }

    if (event.shiftKey) {
      apply(datesBetween(anchor.current ?? painted[0] ?? date, date));
      return;
    }
    anchor.current = date;
    const next: Drag = {
      anchor: date,
      over: date,
      base: painted,
      additive: event.metaKey || event.ctrlKey,
      moved: false,
    };
    pending.current = next;
    setDrag(next);
  };

  const onDayPointerEnter = (date: string) => {
    const current = pending.current;
    if (!current || current.over === date) return;
    const next: Drag = { ...current, over: date, moved: true };
    pending.current = next;
    setDrag(next);
  };

  const onDayKeyDown = (event: React.KeyboardEvent, date: string) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();

    if (event.shiftKey) {
      apply(datesBetween(anchor.current ?? painted[0] ?? date, date));
      return;
    }
    anchor.current = date;
    if (event.metaKey || event.ctrlKey) apply(toggleDate(painted, date));
    else if (painted.length === 1 && painted[0] === date) apply([]);
    else apply([date]);
  };

  const events = buildDayEvents(view);
  const bars = buildBlockBars(view);
  const weeks = monthGrid(month);
  const monthIndex = months.indexOf(month);

  const monthTotal = view.production
    .filter((entry) => entry.date.startsWith(month))
    .reduce((sum, entry) => sum + entry.kg, 0);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kalender</h1>
          <p>
            {formatMonth(month)} — {kg(monthTotal)} kg Käse
          </p>
        </div>
        <div className="row no-print">
          {monthIndex > 0 ? (
            <Link className="btn btn-quiet" href={calendarHref(shiftMonth(month, -1))}>
              ‹ {formatMonth(shiftMonth(month, -1)).split(" ")[0]}
            </Link>
          ) : null}
          {monthIndex < months.length - 1 ? (
            <Link className="btn btn-quiet" href={calendarHref(shiftMonth(month, 1))}>
              {formatMonth(shiftMonth(month, 1)).split(" ")[0]} ›
            </Link>
          ) : null}
          {/*
            Der Weg zurück aus jedem Monat. Er führt nicht nur in den heutigen
            Monat, sondern wählt den heutigen Tag gleich aus — wer „Heute“
            drückt, will den Tag sehen, nicht ihn suchen. Steht er schon so da,
            gibt es nichts zu drücken.
          */}
          {view.running && !(month === monthOf(view.asOf) && onlyToday) ? (
            <Link
              className="btn btn-quiet"
              href={calendarHref(monthOf(view.asOf), [view.asOf])}
            >
              Heute
            </Link>
          ) : null}
          <Panel
            hint="Auch über Monatsgrenzen hinweg."
            id="kaese-zeitraum"
            title="Mehrere Tage gleich"
            trigger="Zeitraum eintragen"
          >
            <form action={saveProductionRange} className="stack-sm" key={selection[0]}>
              <p className="small faint">
                Für einen Zeitraum, der über den Monat hinausreicht. Innerhalb eines Monats
                geht es schneller, die Tage im Kalender auszuwählen. Bestehende Einträge
                werden überschrieben.
              </p>
              <input type="hidden" name="seasonId" value={view.season.id} />
              <div className="form-grid">
                <DateField
                  defaultValue={selection[0] ?? view.asOf}
                  id="fromDate"
                  label="von"
                  name="fromDate"
                />
                <DateField
                  defaultValue={selection[selection.length - 1] ?? view.asOf}
                  id="toDate"
                  label="bis"
                  name="toDate"
                />
                <div className="field">
                  <label htmlFor="rangeKg">kg je Tag</label>
                  <input id="rangeKg" name="kg" type="number" step="0.1" min="0" />
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn-primary" type="submit">
                  Eintragen
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      <div className="stack">
        <div className={drag ? "cal is-dragging" : "cal"}>
          <div className="cal-week cal-head">
            {WEEKDAYS.map((name) => (
              <div className="cal-weekday" key={name}>
                {name}
              </div>
            ))}
          </div>

          {weeks.map((week) => {
            const spans = weekBars(bars, week);
            return (
              <div
                className="cal-week"
                key={week[0]}
                style={{ "--lanes": spans.rows } as React.CSSProperties}
              >
                {week.map((dayNo) => {
                  const date = isoFromDayIndex(dayNo);
                  const inSeason =
                    date >= view.season.startDate && date <= view.season.endDate;
                  const entry = events.get(date);
                  /* Vor- und Nachlauf: der Tag füllt nur das Raster auf. */
                  const away = monthOf(date) !== month;
                  const classes = [
                    "cal-day",
                    inSeason ? "" : "outside",
                    away ? "away" : "",
                    selected.has(date) ? "sel" : "",
                    date === view.asOf ? "today" : "",
                  ]
                    .filter(Boolean)
                    .join(" ");

                  /*
                    Wo der Monat wechselt, steht sein Name neben der Zahl: einmal
                    am Anfang des Rasters und einmal am Ersten des Folgemonats.
                    An jeden Tag geschrieben wäre es Lärm — an diesen beiden
                    Stellen sagt es, wohin der ganze Vor- oder Nachlauf gehört.
                  */
                  const named = away && (dayNo === weeks[0][0] || date.endsWith("-01"));
                  const daynum = (
                    <span className="cal-daynum">
                      {Number(date.slice(8))}
                      {named ? (
                        <span className="cal-monthtag">{monthAbbr(monthOf(date))}</span>
                      ) : null}
                    </span>
                  );

                  if (!inSeason) {
                    return (
                      <div className={classes} key={date}>
                        {daynum}
                      </div>
                    );
                  }

                  return (
                    <button
                      aria-pressed={selected.has(date)}
                      className={classes}
                      key={date}
                      onKeyDown={(event) => onDayKeyDown(event, date)}
                      onPointerDown={(event) => onDayPointerDown(event, date)}
                      onPointerEnter={() => onDayPointerEnter(date)}
                      type="button"
                    >
                      {daynum}
                      {entry?.cheeseKg != null ? (
                        <span className="cal-cheese">
                          {kg(entry.cheeseKg)}
                          <span className="unit">kg</span>
                        </span>
                      ) : date <= view.asOf ? (
                        <span className="cal-cheese faint">–</span>
                      ) : null}
                      {entry?.milkL ? (
                        <span className="cal-milk">{liter0(entry.milkL)} l Milch</span>
                      ) : null}
                      {entry ? <DayMarks events={entry} /> : null}
                    </button>
                  );
                })}

                <WeekSelection runs={runs} week={week} />
                <WeekSpans bars={spans} week={week} />
              </div>
            );
          })}
        </div>

        <div className="stack-sm">
          <MarkLegend />
          <BlockLegend />
          <p className="small faint no-print">
            Ziehen wählt mehrere Tage, ⇧ spannt bis zum angeklickten Tag auf, ⌘ nimmt
            einzelne dazu. Ein Klick auf den gewählten Tag oder neben den Kalender hebt die
            Auswahl auf.
          </p>
        </div>
      </div>

      {/*
        Während des Ziehens zählt die alte Auswahl. Klappte die Spalte mitten
        im Zug auf, bekäme der Kalender eine schmalere Spalte, das Raster
        rückte unter dem stillstehenden Zeiger weg — und die Tage, die dabei
        unter ihn geraten, kämen zur Auswahl dazu.
      */}
      <CalSide
        empty={(drag ? painted : selection).length === 0}
        hint={sideHint(selection, view)}
        title={selection.length > 1 ? `${selection.length} Tage` : "Tag"}
      >
        <SelectionCard
          events={events}
          saveProduction={saveProduction}
          saveProductionDays={saveProductionDays}
          selection={selection}
          view={view}
        />
      </CalSide>
    </>
  );
}

/*
  Der Beisatz in der Kopfzeile der Tagesspalte. Er stand früher als Überschrift
  im Inhalt der Spalte, gleich unter dem Kopf, der dasselbe Datum schon trug —
  einmal reicht. Die Kopfzeile ist der bessere Ort: sie bleibt stehen, wenn der
  Inhalt rollt, und am Telefon ist sie alles, was vom hingelegten Blatt zu sehen
  ist. Was dort früher als zweite Zeile im Inhalt stand — „heute“ und die Zahl
  der Lücken — hängt deshalb mit dran.
*/
function sideHint(selection: string[], view: SeasonView): string | undefined {
  if (selection.length === 0) return undefined;
  if (selection.length === 1) {
    const day = selection[0];
    const heute = day === view.asOf ? " · heute" : "";
    return `${weekdayOf(day)}, ${formatDateDe(day)}${heute}`;
  }

  const von = formatDateShort(selection[0]);
  const bis = formatDateShort(selection[selection.length - 1]);
  const { gaps } = selectionStats(view, selection);
  return `${von} – ${bis}${gaps > 0 ? ` · ${gaps} Lücken` : ""}`;
}

/** Was das Ziehen ergibt: ein Zeitraum, beim additiven Ziehen zur Auswahl dazu. */
function dragResult(drag: Drag): string[] {
  const range = datesBetween(drag.anchor, drag.over);
  if (!drag.additive) return range;
  return [...new Set([...drag.base, ...range])].sort();
}

/** Was beim Loslassen gilt. Ohne Bewegung war es ein Klick. */
function commitSelection(drag: Drag): string[] {
  if (drag.moved) return dragResult(drag);
  if (drag.additive) return toggleDate(drag.base, drag.anchor);
  // Ein schlichter Klick auf den einzigen gewählten Tag wählt ihn ab.
  if (drag.base.length === 1 && drag.base[0] === drag.anchor) return [];
  return [drag.anchor];
}

/* ------------------------------------------------------------ Seitenspalte */

function SelectionCard({
  events,
  saveProduction,
  saveProductionDays,
  selection,
  view,
}: {
  events: Map<string, DayEvents>;
  saveProduction: (data: FormData) => void;
  saveProductionDays: (data: FormData) => void;
  selection: string[];
  view: SeasonView;
}) {
  if (selection.length === 0) {
    return <Empty>Kein Tag gewählt. Einen Tag anklicken oder über mehrere ziehen.</Empty>;
  }

  const single = selection.length === 1 ? selection[0] : null;
  const stats = selectionStats(view, selection);
  const day = single ? events.get(single) : undefined;

  return (
    <div className="stack">
      {/* Im Schlüssel der Tagesmaske steht auch die gespeicherte Menge: nach dem
          Speichern fiele das Feld sonst auf den Wert von vorher zurück — siehe
          `lib/formular.ts`. */}
      {single ? (
        <form
          action={saveProduction}
          className="stack-sm"
          key={savedKey(single, view.productionByDate.get(single)?.kg)}
        >
          <input type="hidden" name="seasonId" value={view.season.id} />
          <input type="hidden" name="date" value={single} />
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="kg">Käse an diesem Tag</label>
              <input
                defaultValue={view.productionByDate.get(single)?.kg ?? ""}
                id="kg"
                min="0"
                name="kg"
                placeholder="kg"
                step="0.1"
                type="number"
              />
            </div>
            <button className="btn-primary" style={{ alignSelf: "flex-end" }} type="submit">
              Speichern
            </button>
          </div>
          <p className="small faint">Leer lassen entfernt den Eintrag für diesen Tag.</p>
        </form>
      ) : (
        <form action={saveProductionDays} className="stack-sm" key={selection.join()}>
          <input type="hidden" name="seasonId" value={view.season.id} />
          <input type="hidden" name="dates" value={serializeSelection(selection)} />
          <div className="row" style={{ flexWrap: "nowrap" }}>
            <div className="field" style={{ flex: 1 }}>
              <label htmlFor="kg">Käse je Tag</label>
              <input id="kg" min="0" name="kg" placeholder="kg" step="0.1" type="number" />
            </div>
            <button className="btn-primary" style={{ alignSelf: "flex-end" }} type="submit">
              Für alle
            </button>
          </div>
          <p className="small faint">
            Trägt denselben Wert für alle {selection.length} Tage ein und überschreibt
            vorhandene.
          </p>
        </form>
      )}

      {stats.pastDays > 0 ? (
        <>
          <div className="divider" />
          <dl className="cal-stats">
            <dt>Käse</dt>
            <dd>
              {kg(stats.producedKg)} kg
              {stats.pastDays > 1 ? (
                <span className="faint"> an {stats.productionDays} Tagen</span>
              ) : null}
            </dd>
            <dt>Verwertbare Milch</dt>
            <dd>{liter0(stats.usableL)} l</dd>
            {stats.blockedL > 0 ? (
              <>
                <dt>wegen Behandlung verworfen</dt>
                <dd className="blocked-text">{liter(stats.blockedL)} l</dd>
              </>
            ) : null}
            <dt>Kühe gemolken</dt>
            <dd>
              {stats.pastDays > 1
                ? `Ø ${Math.round(stats.cowsMilked / stats.pastDays)}`
                : stats.cowsMilked}
            </dd>
            {stats.deductionKg > 0 ? (
              <>
                <dt>Abzug</dt>
                <dd>{kg(stats.deductionKg)} kg</dd>
              </>
            ) : null}
          </dl>
        </>
      ) : null}

      {stats.perFarmer.length > 0 ? (
        <>
          <div className="divider" />
          <h4 className="day-sub">
            {stats.pastDays > 1 ? "Anteile im Zeitraum" : "Anteile an diesem Tag"}
          </h4>
          <ul className="cal-shares">
            {stats.perFarmer.map((row) => {
              const share = stats.usableL > 0 ? row.usableL / stats.usableL : 0;
              return (
                <li key={row.farmerId}>
                  <FarmerLink className="cal-share-name" farmerId={row.farmerId}>
                    {view.farmerNames.get(row.farmerId) ?? "—"}
                  </FarmerLink>
                  <span className="cal-share-val">{kg(row.cheeseKg)} kg</span>
                  <span aria-hidden className="cal-share-bar">
                    <i style={{ width: `${share * 100}%` }} />
                  </span>
                  <span className="cal-share-pct">{pct(share)}</span>
                </li>
              );
            })}
          </ul>
        </>
      ) : null}

      {day ? <DayDetail day={day} view={view} /> : null}
    </div>
  );
}

interface SelectionStats {
  /** Tage bis zum Stichtag — nur für die gibt es überhaupt Zahlen. */
  pastDays: number;
  gaps: number;
  producedKg: number;
  deductionKg: number;
  usableL: number;
  blockedL: number;
  productionDays: number;
  /** Summe über die Tage; die Anzeige teilt für den Durchschnitt selbst. */
  cowsMilked: number;
  perFarmer: Array<{ farmerId: number; usableL: number; cheeseKg: number }>;
}

function selectionStats(view: SeasonView, selection: string[]): SelectionStats {
  const usable = new Map<number, number>();
  const cheese = new Map<number, number>();
  const stats: SelectionStats = {
    pastDays: 0,
    gaps: Math.max(0, selectionRuns(selection).length - 1),
    producedKg: 0,
    deductionKg: 0,
    usableL: 0,
    blockedL: 0,
    productionDays: 0,
    cowsMilked: 0,
    perFarmer: [],
  };

  for (const date of selection) {
    const day = view.result.byDay.get(date);
    if (!day || date > view.asOf) continue;
    stats.pastDays++;
    stats.producedKg += day.producedKg;
    stats.deductionKg += day.deductionKg;
    stats.usableL += day.totalUsableL;
    stats.blockedL += day.totalBlockedL;
    stats.cowsMilked += day.cowsMilked;
    if (day.producedKg > 0) stats.productionDays++;
    for (const row of day.perFarmer) {
      usable.set(row.farmerId, (usable.get(row.farmerId) ?? 0) + row.usableL);
      cheese.set(row.farmerId, (cheese.get(row.farmerId) ?? 0) + row.cheeseKg);
    }
  }

  stats.perFarmer = [...usable.keys()]
    .map((farmerId) => ({
      farmerId,
      usableL: usable.get(farmerId) ?? 0,
      cheeseKg: cheese.get(farmerId) ?? 0,
    }))
    .sort((a, b) => b.usableL - a.usableL);

  return stats;
}

/* ------------------------------------------------------------ Wochenlagen */

const MAX_LANES = 3;

interface WeekBars {
  lanes: { bar: BlockBar; fromDay: number; toDay: number }[][];
  hidden: number;
  /** Zeilen, die die Tage unten freihalten müssen. */
  rows: number;
}

/**
 * Die Balken einer Woche, auf deren Rand beschnitten und auf Spuren verteilt.
 * Die Zahl der Zeilen bestimmt, wie viel Platz die Tage unten freihalten
 * müssen — deshalb steht sie schon beim Zeichnen der Woche fest.
 */
function weekBars(bars: BlockBar[], week: number[]): WeekBars {
  const [first] = week;
  const last = week[6];

  const inWeek = bars
    .filter((bar) => bar.toDay >= first && bar.fromDay <= last)
    .map((bar) => ({
      bar,
      fromDay: Math.max(bar.fromDay, first),
      toDay: Math.min(bar.toDay, last),
    }));

  const all = packLanes(inWeek);
  const lanes = all.slice(0, MAX_LANES);
  const hidden = all.slice(MAX_LANES).reduce((sum, lane) => sum + lane.length, 0);

  return { lanes, hidden, rows: lanes.length + (hidden > 0 ? 1 : 0) };
}

/**
 * Der Rahmen um die ausgewählten Tage — je zusammenhängendem Abschnitt einer,
 * nicht je Tag. Sonst zöge die Auswahl mitten durch die Sperrbalken, die über
 * sie hinweglaufen; so kreuzen die Balken einen einzigen Rand und laufen
 * sichtbar weiter.
 */
function WeekSelection({
  week,
  runs,
}: {
  week: number[];
  runs: Array<{ from: number; to: number }>;
}) {
  const [first] = week;
  const last = week[6];
  const bands = runs.filter((run) => run.to >= first && run.from <= last);
  if (bands.length === 0) return null;

  return (
    <div aria-hidden className="cal-sel">
      {bands.map((run) => {
        const from = Math.max(run.from, first);
        const to = Math.min(run.to, last);
        const opensLeft = run.from < from;
        const opensRight = run.to > to;

        return (
          <span
            className="cal-sel-band"
            key={run.from}
            style={{
              gridColumn: `${from - first + 1} / span ${to - from + 1}`,
              borderTopLeftRadius: opensLeft ? 0 : undefined,
              borderBottomLeftRadius: opensLeft ? 0 : undefined,
              borderTopRightRadius: opensRight ? 0 : undefined,
              borderBottomRightRadius: opensRight ? 0 : undefined,
            }}
          />
        );
      })}
    </div>
  );
}

/**
 * Die Sperrzeiträume einer Kalenderwoche, quer über die Tage gelegt. Ein
 * Zeitraum, der über den Wochenrand hinausgeht, wird beschnitten und verliert
 * dort seine runde Kante — so ist zu sehen, dass er weiterläuft.
 */
function WeekSpans({ week, bars }: { week: number[]; bars: WeekBars }) {
  const [first] = week;
  if (bars.rows === 0) return null;

  return (
    <div className="cal-spans">
      {bars.lanes.map((lane, laneIndex) =>
        lane.map(({ bar, fromDay, toDay }) => {
          const days = toDay - fromDay + 1;
          const opensLeft = bar.fromDay < fromDay;
          const opensRight = bar.toDay > toDay;
          // Eine halbe Tagesspalte, gemessen an der Breite dieses Balkens.
          const half = `calc(${100 / (2 * days)}% + 1px)`;
          const cutLeft = bar.startsPm && !opensLeft;
          const cutRight = bar.endsAm && !opensRight;

          return (
            <SpanBar
              bar={bar}
              fromIdx={Math.max(bar.fromIdx, fromDay * 2)}
              key={bar.key}
              style={{
                gridRow: laneIndex + 1,
                gridColumn: `${fromDay - first + 1} / span ${days}`,
                marginLeft: cutLeft ? half : undefined,
                marginRight: cutRight ? half : undefined,
                borderTopLeftRadius: opensLeft ? 0 : undefined,
                borderBottomLeftRadius: opensLeft ? 0 : undefined,
                borderTopRightRadius: opensRight ? 0 : undefined,
                borderBottomRightRadius: opensRight ? 0 : undefined,
              }}
              toIdx={Math.min(bar.toIdx, toDay * 2 + 1)}
            />
          );
        }),
      )}
      {bars.hidden > 0 ? (
        <span className="span-more" style={{ gridRow: bars.rows }}>
          + {bars.hidden} weitere
        </span>
      ) : null}
    </div>
  );
}

function DayDetail({ view, day }: { view: SeasonView; day: DayEvents }) {
  const cow = (id: number) => {
    const entry = view.cowNames.get(id);
    return entry ? cowLabel(entry) : `Kuh ${id}`;
  };

  const blocked = [...new Set(day.blockedCowIds)];
  const treated = [...new Set(day.treatedCowIds)];

  const sections: { title: string; body: React.ReactNode }[] = [];

  if (day.roundIds.length > 0) {
    sections.push({
      title: "Messung",
      body: day.roundIds.map((id) => (
        <RoundLink className="chip" key={id} roundId={id}>
          Werte ansehen
        </RoundLink>
      )),
    });
  }
  if (treated.length > 0) {
    sections.push({
      title: "Behandelt",
      body: treated.map((id) => (
        <CowLink className="chip chip-blocked" cowId={id} key={id}>
          {cow(id)}
        </CowLink>
      )),
    });
  }
  if (blocked.length > 0) {
    sections.push({
      title: "Milch gesperrt",
      body: blocked.map((id) => (
        <CowLink className="chip chip-blocked" cowId={id} key={id}>
          {cow(id)}
        </CowLink>
      )),
    });
  }
  if (day.arrivals.length > 0) {
    sections.push({
      title: "Auftrieb",
      body: day.arrivals.map((id) => (
        <CowLink className="chip" cowId={id} key={id}>
          {cow(id)}
        </CowLink>
      )),
    });
  }
  if (day.departures.length > 0) {
    sections.push({
      title: "Abtrieb",
      body: day.departures.map((id) => (
        <CowLink className="chip" cowId={id} key={id}>
          {cow(id)}
        </CowLink>
      )),
    });
  }
  if (day.dryOffs.length > 0) {
    sections.push({
      title: "Trockengestellt",
      body: day.dryOffs.map((id) => (
        <CowLink className="chip" cowId={id} key={id}>
          {cow(id)}
        </CowLink>
      )),
    });
  }
  if (day.pickupFarmerIds.length > 0) {
    sections.push({
      title: `Abholungen — ${kg(day.pickupKg)} kg`,
      body: day.pickupFarmerIds.map((id, i) => (
        <FarmerLink className="chip" farmerId={id} key={`${id}-${i}`}>
          {view.farmerNames.get(id) ?? "—"}
        </FarmerLink>
      )),
    });
  }

  if (sections.length === 0) return null;

  return (
    <>
      <div className="divider" />
      <div className="stack-sm">
        {sections.map((section) => (
          <div key={section.title}>
            <h4 className="day-sub">{section.title}</h4>
            <div className="row">{section.body}</div>
          </div>
        ))}
      </div>
    </>
  );
}
