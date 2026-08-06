"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import type { DistributionSeries } from "@/lib/distribution";
import { liter, liter0, pct, weekdayOf } from "@/lib/format";
import { formatDateDe, formatMonth, monthOf } from "@/lib/gemelk";
import { farmerHref } from "@/lib/routes";

/*
  Verteilung im Verlauf
  =====================

  Übereinandergelegte Flächen, eine je Bauer, eine Spalte je Tag. Zwei
  Lesarten derselben Reihe:

    Anteil — die Flächen füllen die Höhe ganz aus. Man sieht, wie sich das
             Verhältnis zwischen den Bauern verschiebt.
    Menge  — dieselben Flächen an einer Literachse. Man sieht zusätzlich, dass
             die Milch über die Saison insgesamt weniger wird.

  Zwischen beiden wird nicht umgeschaltet, sondern übergeblendet: es ist
  dieselbe Fläche, nur anders skaliert, und genau das soll die Bewegung
  zeigen.

  Bauern tragen keine eigene Farbe. Der Farbton bleibt in dieser Anwendung
  dem Zustand vorbehalten (Bernstein = Milch gesperrt); die Bänder
  unterscheiden sich über die Helligkeit — unten kräftig, nach oben immer
  zurückgenommener — und sind durch eine Haarlinie getrennt.
*/

const W = 1000;
const H = 320;
const MORPH_MS = 340;
const LABEL_H = 18;

/**
 * Die Leiter der Helligkeiten. Sechs Stufen liegen zwangsläufig nah
 * beieinander; auseinander hält sie erst die Trennlinie zwischen den Bändern.
 * Deshalb wird die Leiter so weit gespannt, wie die Fläche es zulässt, ohne
 * dass das oberste Band im Untergrund verschwindet.
 */
function bandTone(band: number, bands: number): string {
  const step = bands > 1 ? band / (bands - 1) : 0;
  const mix = 82 - 62 * step;
  return `color-mix(in srgb, var(--text) ${mix.toFixed(1)}%, var(--surface))`;
}

/**
 * Obere Kante jedes Bandes als Bruchteil der Höhe, für den Übergang zwischen
 * beiden Lesarten gemischt: `t = 1` ist der Anteil, `t = 0` die Menge.
 */
function stack(series: DistributionSeries, t: number): number[][] {
  const days = series.dates.length;
  const running = new Array<number>(days).fill(0);

  return series.valuesL.map((row) => {
    const edge = new Array<number>(days);
    for (let i = 0; i < days; i++) {
      running[i] += row[i];
      const asShare = series.dayTotalsL[i] > 0 ? running[i] / series.dayTotalsL[i] : 0;
      const asAmount = running[i] / series.maxDayL;
      edge[i] = asAmount + (asShare - asAmount) * t;
    }
    return edge;
  });
}

const px = (i: number, last: number) => ((i / last) * W).toFixed(2);
const py = (f: number) => (H - f * H).toFixed(2);

/** Die obere Kante eines Bandes, von links nach rechts. */
function edgePath(upper: number[]): string {
  const last = upper.length - 1;
  let d = `M${px(0, last)},${py(upper[0])}`;
  for (let i = 1; i <= last; i++) d += `L${px(i, last)},${py(upper[i])}`;
  return d;
}

function areaPath(upper: number[], lower: number[] | null): string {
  const last = upper.length - 1;
  let d = edgePath(upper);
  if (lower) {
    for (let i = last; i >= 0; i--) d += `L${px(i, last)},${py(lower[i])}`;
  } else {
    d += `L${px(last, last)},${H}L${px(0, last)},${H}`;
  }
  return `${d}Z`;
}

export default function DistributionChart({
  series,
  height = 300,
}: {
  series: DistributionSeries;
  height?: number;
}) {
  const [mode, setMode] = useState<"share" | "amount">("share");
  const [day, setDay] = useState<number | null>(null);
  const [band, setBand] = useState<number | null>(null);
  const [t, setT] = useState(1);
  const held = useRef(1);
  held.current = t;

  const days = series.dates.length;
  const bands = series.valuesL.length;

  useEffect(() => {
    const to = mode === "share" ? 1 : 0;
    const from = held.current;
    if (from === to) return;

    const started = performance.now();
    let frame = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - started) / MORPH_MS);
      const eased = p < 0.5 ? 2 * p * p : 1 - (-2 * p + 2) ** 2 / 2;
      setT(from + (to - from) * eased);
      if (p < 1) frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);

    // Ein verdecktes Fenster bekommt keine Bilder mehr. Ohne diesen Schluss
    // bliebe die Fläche stehen, wo sie beim Wegklicken gerade war.
    const settle = setTimeout(() => {
      cancelAnimationFrame(frame);
      setT(to);
    }, MORPH_MS + 150);

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(settle);
    };
  }, [mode]);

  const edges = useMemo(() => stack(series, t), [series, t]);

  /*
    Die Namen stehen neben ihrem Band statt in einer Legende darunter — so muss
    niemand zwischen Farbe und Name hin und her sehen. Sind zwei Bänder dünn,
    würden die Namen übereinanderfallen; deshalb werden sie von oben nach unten
    auf Abstand geschoben.
  */
  const labelTops = useMemo(() => {
    const tops = edges.map((upper, b) => {
      const lower = b > 0 ? edges[b - 1][days - 1] : 0;
      const middle = (upper[days - 1] + lower) / 2;
      return (1 - middle) * height - LABEL_H / 2;
    });
    for (let b = bands - 2; b >= 0; b--) {
      tops[b] = Math.max(tops[b], tops[b + 1] + LABEL_H);
    }
    tops[0] = Math.min(tops[0], height - LABEL_H);
    for (let b = 1; b < bands; b++) {
      tops[b] = Math.min(tops[b], tops[b - 1] - LABEL_H);
    }
    return tops.map((top) => Math.max(0, top));
  }, [bands, days, edges, height]);

  const monthMarks = useMemo(
    () =>
      series.dates
        .map((date, i) => ({ date, i }))
        .filter(({ date }) => date.slice(8) === "01"),
    [series.dates],
  );

  const track = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      if (box.width === 0) return;
      const ratio = (event.clientX - box.left) / box.width;
      setDay(Math.max(0, Math.min(days - 1, Math.round(ratio * (days - 1)))));
    },
    [days],
  );

  const axis =
    mode === "share"
      ? ["100 %", "50 %", "0"]
      : [`${liter0(series.maxDayL)} l`, `${liter0(series.maxDayL / 2)} l`, "0"];

  return (
    <div className="dist">
      <div className="wahl no-print">
        <button
          aria-pressed={mode === "share"}
          onClick={() => setMode("share")}
          type="button"
        >
          Anteil
        </button>
        <button
          aria-pressed={mode === "amount"}
          onClick={() => setMode("amount")}
          type="button"
        >
          Menge
        </button>
      </div>

      <div
        className="dist-grid"
        style={{ "--dist-h": `${height}px` } as React.CSSProperties}
      >
        <div className="dist-axis" key={mode}>
          {axis.map((label) => (
            <span key={label}>{label}</span>
          ))}
        </div>

        <div
          className="dist-plot"
          onPointerLeave={() => setDay(null)}
          onPointerMove={track}
        >
          <svg
            aria-label={`Verteilung zwischen ${bands} Bauern von ${formatDateDe(series.dates[0])} bis ${formatDateDe(series.dates[days - 1])}`}
            preserveAspectRatio="none"
            role="img"
            viewBox={`0 0 ${W} ${H}`}
          >
            {edges.map((upper, b) => (
              <path
                className={`dist-band${band !== null && band !== b ? " is-dim" : ""}`}
                d={areaPath(upper, b > 0 ? edges[b - 1] : null)}
                fill={bandTone(b, bands)}
                key={series.farmerIds[b]}
                onPointerEnter={() => setBand(b)}
                onPointerLeave={() => setBand(null)}
              />
            ))}
            {/*
              Die Oberkante des Stapels ist in der Mengenansicht die Tagesmilch
              der ganzen Alp — und zugleich das, was das hellste Band vom
              Untergrund abgrenzt. In der Anteilsansicht liegt sie auf dem
              Rahmen und hätte nichts zu sagen; sie blendet mit ab.
            */}
            <path
              className="dist-edge"
              d={edgePath(edges[bands - 1])}
              style={{ opacity: 1 - t }}
            />
          </svg>

          {monthMarks.map(({ date, i }) => (
            <i
              className="dist-month"
              key={date}
              style={{ left: `${(i / (days - 1)) * 100}%` }}
            />
          ))}

          {day !== null ? (
            <i className="dist-cross" style={{ left: `${(day / (days - 1)) * 100}%` }} />
          ) : null}

          {day !== null ? <Readout day={day} series={series} /> : null}
        </div>

        {/* Der Name führt zum Bauern — ein Klick, kein Umweg über die Tabelle. */}
        <div className="dist-names">
          {series.names.map((name, b) => (
            <Link
              className={`dist-name${band === b ? " is-on" : ""}`}
              href={farmerHref(series.farmerIds[b])}
              key={series.farmerIds[b]}
              onPointerEnter={() => setBand(b)}
              onPointerLeave={() => setBand(null)}
              style={{ top: labelTops[b] }}
            >
              <i style={{ background: bandTone(b, bands) }} />
              {name}
            </Link>
          ))}
        </div>

        {/* Ganz außen läuft die Beschriftung sonst aus der Fläche heraus. */}
        <div className="dist-scale">
          {monthMarks.map(({ date, i }) => {
            const ratio = i / (days - 1);
            return (
              <span
                key={date}
                style={{
                  left: `${ratio * 100}%`,
                  transform: `translateX(${ratio > 0.94 ? "-100%" : ratio < 0.06 ? "0" : "-50%"})`,
                }}
              >
                {formatMonth(monthOf(date)).replace(/ \d{4}$/, "")}
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/** Was an einem einzelnen Tag zusammenkam — größter Anteil zuerst. */
function Readout({ day, series }: { day: number; series: DistributionSeries }) {
  const total = series.dayTotalsL[day];
  const rows = series.valuesL
    .map((row, b) => ({ name: series.names[b], value: row[day] }))
    .sort((a, b) => b.value - a.value);
  const ratio = day / (series.dates.length - 1);

  return (
    <div
      className="hovercard dist-read"
      style={{
        left: `${ratio * 100}%`,
        transform: `translateX(${ratio > 0.66 ? "calc(-100% - 10px)" : ratio < 0.34 ? "10px" : "-50%"})`,
      }}
    >
      <div className="hovercard-head">
        <b>
          {weekdayOf(series.dates[day])} {formatDateDe(series.dates[day])}
        </b>
        <span className="faint">{liter0(total)} l</span>
      </div>
      <dl className="hovercard-rows">
        {rows.map((row) => (
          <Fragment key={row.name}>
            <dt>{row.name}</dt>
            <dd>
              {pct(total > 0 ? row.value / total : 0)}
              <span className="faint"> {liter(row.value)} l</span>
            </dd>
          </Fragment>
        ))}
      </dl>
    </div>
  );
}
