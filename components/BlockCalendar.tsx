"use client";

import HoverCard from "@/components/HoverCard";
import ScrollStrip from "@/components/ScrollStrip";
import { Empty } from "@/components/ui";
import { packLanes } from "@/lib/calendar";
import type { BlockBar } from "@/lib/calendar";
import { days, liter } from "@/lib/format";
import {
  dayIndex,
  formatGemelk,
  gemelkeToDays,
  isoFromDayIndex,
  monthsBetween,
} from "@/lib/gemelk";
import { cowHref } from "@/lib/routes";

const MONTH_NAMES = [
  "Januar",
  "Februar",
  "März",
  "April",
  "Mai",
  "Juni",
  "Juli",
  "August",
  "September",
  "Oktober",
  "November",
  "Dezember",
];

/**
 * Durchgehender Kalender über die ganze Saison: eine Spalte je Tag, und jeder
 * Sperrzeitraum ein Balken, der sich über genau die Tage zieht, die er sperrt.
 */
export default function BlockCalendar({
  bars,
  startDate,
  endDate,
  today,
}: {
  bars: BlockBar[];
  startDate: string;
  endDate: string;
  today: string;
}) {
  if (bars.length === 0) {
    return <Empty>In dieser Saison ist noch keine Milch gesperrt.</Empty>;
  }

  const from = dayIndex(startDate);
  const to = dayIndex(endDate);
  const days = to - from + 1;
  const todayDay = dayIndex(today);
  const lanes = packLanes(bars);
  const col = (day: number) => day - from + 1;

  const mondays = Array.from({ length: days }, (_, i) => from + i).filter(
    (day) => new Date(day * 86_400_000).getUTCDay() === 1,
  );

  return (
    <ScrollStrip focus={(todayDay - from + 0.5) / days}>
      <div
        className="strip"
        style={
          {
            "--days": days,
            gridTemplateRows: `auto auto repeat(${lanes.length}, var(--span-h))`,
          } as React.CSSProperties
        }
      >
        {/* Untergrund zuerst, damit die Balken darüber liegen. */}
        {mondays.map((day) => (
          <i className="strip-week" key={`w${day}`} style={{ gridColumn: col(day) }} />
        ))}
        {todayDay >= from && todayDay <= to ? (
          <i className="strip-today" style={{ gridColumn: col(todayDay) }} />
        ) : null}

        {monthsBetween(startDate, endDate).map((month) => {
          const [year, monthNo] = month.split("-").map(Number);
          const first = Math.max(from, dayIndex(`${month}-01`));
          const last = Math.min(
            to,
            dayIndex(`${month}-01`) + new Date(Date.UTC(year, monthNo, 0)).getUTCDate() - 1,
          );
          return (
            <span
              className="strip-month"
              key={month}
              style={{ gridRow: 1, gridColumn: `${col(first)} / span ${last - first + 1}` }}
            >
              {MONTH_NAMES[monthNo - 1]}
            </span>
          );
        })}

        {Array.from({ length: days }, (_, i) => from + i).map((day) => (
          <span
            className={`strip-day${day === todayDay ? " is-today" : ""}`}
            key={`d${day}`}
            style={{ gridRow: 2, gridColumn: col(day) }}
          >
            {Number(isoFromDayIndex(day).slice(8))}
          </span>
        ))}

        {lanes.map((lane, laneIndex) =>
          lane.map((bar) => (
            <SpanBar
              bar={bar}
              fromIdx={bar.fromIdx}
              key={bar.key}
              style={{
                gridRow: laneIndex + 3,
                gridColumn: `${col(bar.fromDay)} / span ${bar.toDay - bar.fromDay + 1}`,
                // Halbe Tage: eine Sperre ab abends beginnt in der Tagesmitte.
                marginLeft: bar.startsPm ? "calc(var(--day-w) / 2 + 1px)" : undefined,
                marginRight: bar.endsAm ? "calc(var(--day-w) / 2 + 1px)" : undefined,
              }}
              toIdx={bar.toIdx}
            />
          )),
        )}
      </div>
    </ScrollStrip>
  );
}

/**
 * Ein Balken. `fromIdx`/`toIdx` sind die Gemelke, die das gezeichnete Kästchen
 * tatsächlich abdeckt — im Monatsgitter ist das der auf die Woche beschnittene
 * Ausschnitt, im durchgehenden Kalender der ganze Zeitraum.
 *
 * Der Balken zeigt zwei Dinge auseinandergehalten: die Gemelke, an denen
 * behandelt wurde, stehen als volle Fläche, die anschließende Wartezeit als
 * schraffierte. Die Beschriftung liegt immer am linken Rand — beide Flächen
 * sind hell genug abgestimmt, dass sie darauf lesbar bleibt.
 */
export function SpanBar({
  bar,
  fromIdx,
  toIdx,
  style,
}: {
  bar: BlockBar;
  fromIdx: number;
  toIdx: number;
  style: React.CSSProperties;
}) {
  const gemelke = toIdx - fromIdx + 1;
  const pct = (idx: number) => ((idx - fromIdx) / gemelke) * 100;

  const runs = bar.treated
    .map((run) => ({
      from: Math.max(run.fromIdx, fromIdx),
      to: Math.min(run.toIdx, toIdx),
    }))
    .filter((run) => run.to >= run.from)
    .sort((a, b) => a.from - b.from);

  return (
    <HoverCard
      card={<SpanCard bar={bar} />}
      className={bar.open ? "span-bar is-open" : "span-bar"}
      href={cowHref(bar.cowId)}
      style={style}
    >
      {runs.map((run) => (
        <i
          className="span-treated"
          key={run.from}
          style={{
            left: `${pct(run.from)}%`,
            width: `${pct(run.to + 1) - pct(run.from)}%`,
          }}
        />
      ))}
      <span className="span-label">
        <b>{bar.cowName}</b> {bar.labels.join(", ")}
      </span>
    </HoverCard>
  );
}

function SpanCard({ bar }: { bar: BlockBar }) {
  const gemelke = bar.toIdx - bar.fromIdx + 1;
  const treatedGemelke = bar.treated.reduce(
    (sum, run) => sum + (run.toIdx - run.fromIdx + 1),
    0,
  );

  return (
    <>
      <div className="hovercard-head">
        <b>{bar.cowName}</b>
        <span className="bell">{bar.bellNumber}</span>
      </div>
      <dl className="hovercard-rows">
        <dt>
          <i className="span-swatch is-treated" /> behandelt
        </dt>
        <dd>
          {bar.labels.join(", ")}
          <span className="faint"> · {treatedGemelke} Gemelke</span>
        </dd>
        <dt>
          <i className="span-swatch" /> gesperrt
        </dt>
        <dd>
          {bar.open ? (
            <>
              ab {formatGemelk(bar.fromIdx)}
              <span className="faint"> · läuft noch, Ende offen</span>
            </>
          ) : (
            <>
              {formatGemelk(bar.fromIdx)} – {formatGemelk(bar.toIdx)}
              <span className="faint">
                {" "}
                · {gemelke} Gemelke, {days(gemelkeToDays(gemelke))} Tage
              </span>
            </>
          )}
        </dd>
        <dt>verworfen</dt>
        <dd className="blocked-text">{liter(bar.lostL)} l</dd>
      </dl>
    </>
  );
}

export function BlockLegend({ withToday }: { withToday?: boolean }) {
  return (
    <div className="legend">
      <span>
        <i className="span-swatch is-treated" />
        behandelt
      </span>
      <span>
        <i className="span-swatch" />
        Wartezeit, Milch gesperrt
      </span>
      {withToday ? (
        <span>
          <i className="span-swatch is-plain" />
          heute
        </span>
      ) : null}
    </div>
  );
}
