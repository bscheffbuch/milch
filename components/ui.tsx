"use client";

import { useCallback, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

import { kg, liter, signedKg, weekdayOf } from "@/lib/format";
import { formatDateDe } from "@/lib/gemelk";

export function Stat({
  label,
  value,
  unit,
  note,
}: {
  label: string;
  value: string;
  unit?: string;
  note?: string;
}) {
  return (
    <div className="stat">
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit ? <span className="unit">{unit}</span> : null}
      </div>
      {note ? <div className="stat-note">{note}</div> : null}
    </div>
  );
}

export function MiniBar({
  value,
  max,
  unit = "kg",
}: {
  value: number;
  max: number;
  unit?: Unit;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(1, value / max)) : 0;
  return (
    // Die Zahl steht in der Zeile daneben; der Balken sagt sie beim Verweilen
    // noch einmal, damit man sie nicht mit dem Auge zurücksuchen muss.
    <div className="bar" aria-hidden title={`${amount(value, unit)} ${unit}`}>
      <div className="bar-fill" style={{ width: `${pct * 100}%` }} />
    </div>
  );
}

/**
 * Der Schatten des laufenden Monats: was seit dem Monatsersten dazugekommen
 * ist, aber noch nicht abgerechnet wurde. Steht gestrichelt neben der
 * abgerechneten Zahl, damit niemand die beiden verwechselt.
 */
export function Ghost({
  value,
  title,
  block,
}: {
  value: number;
  title?: string;
  /** Unter der abgerechneten Zahl statt neben ihr. */
  block?: boolean;
}) {
  if (Math.abs(value) < 0.05) return block ? null : <span className="faint">—</span>;
  return (
    <span className={block ? "ghost ghost-block" : "ghost"} title={title}>
      {signedKg(value)}
    </span>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <p className="empty">{children}</p>;
}

/**
 * Milch wird gemessen, Käse gewogen — beide Zahlen sehen gleich aus und meinen
 * verschiedenes. Deshalb sagt jedes Diagramm seine Einheit selbst, statt sie
 * dem Aufrufer zu überlassen und irgendwann Liter in Kilogramm zu beschriften.
 */
type Unit = "kg" | "l";

const amount = (value: number, unit: Unit) => (unit === "l" ? liter(value) : kg(value));

/**
 * Der nächste Wert, der wirklich da ist. Der Zeiger zielt auf eine Stelle der
 * Fläche, nicht auf einen Eintrag; über einer Lücke wäre ohne das hier nichts
 * abzulesen, obwohl zwei Pixel weiter ein Wert steht.
 */
function nearestFilled(values: (number | null)[], from: number): number | null {
  if (values[from] != null) return from;
  for (let step = 1; step < values.length; step++) {
    if (values[from - step] != null) return from - step;
    if (values[from + step] != null) return from + step;
  }
  return null;
}

/**
 * Verlaufskurve über eine Tagesreihe. Lücken (null) unterbrechen die Linie,
 * statt sie auf null zu ziehen — ein Tag ohne Eintrag ist kein Tag mit 0 kg.
 *
 * Die Achse spannt sich über die tatsächlichen Werte, nicht ab null: Die
 * Tagesmengen schwanken um wenige Prozent, ab null gezeichnet wäre die Kurve
 * ein waagrechter Strich über einer grauen Fläche.
 *
 * Abzulesen ist sie beim Darüberfahren: Fadenkreuz, Punkt auf der Kurve und
 * die Zahl zum Tag. Ohne das bleibt eine Kurve eine Form — man sieht, dass es
 * bergab geht, aber nicht, um wie viel.
 */
export function Sparkline({
  values,
  dates,
  height = 64,
  label,
  unit = "kg",
}: {
  values: (number | null)[];
  /** Ein ISO-Datum je Wert. Fehlt es, steht im Hinweis nur die Zahl. */
  dates?: string[];
  height?: number;
  label: string;
  unit?: Unit;
}) {
  const [at, setAt] = useState<number | null>(null);

  const last = values.length - 1;
  const track = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      const box = event.currentTarget.getBoundingClientRect();
      if (box.width === 0) return;
      const ratio = (event.clientX - box.left) / box.width;
      setAt(Math.max(0, Math.min(last, Math.round(ratio * last))));
    },
    [last],
  );

  const present = values.filter((v): v is number => v !== null);
  if (present.length < 2) return <Empty>Noch zu wenige Werte für einen Verlauf.</Empty>;

  const high = Math.max(...present);
  const low = Math.min(...present);
  // Etwas Luft, damit Höchst- und Tiefstwert nicht am Rand kleben.
  const pad = (high - low || high || 1) * 0.12;
  const max = high + pad;
  const min = low - pad;
  const span = max - min || 1;
  const width = 1000;
  const step = values.length > 1 ? width / (values.length - 1) : width;

  const x = (i: number) => i * step;
  const y = (v: number) => height - ((v - min) / span) * (height - 6) - 3;

  // Zusammenhängende Abschnitte einzeln zeichnen, damit Lücken sichtbar bleiben.
  const segments: string[] = [];
  let current: string[] = [];
  values.forEach((value, i) => {
    if (value === null) {
      if (current.length > 1) segments.push(current.join(" "));
      current = [];
      return;
    }
    current.push(
      `${current.length === 0 ? "M" : "L"}${x(i).toFixed(1)},${y(value).toFixed(1)}`,
    );
  });
  if (current.length > 1) segments.push(current.join(" "));

  const spot = at === null ? null : nearestFilled(values, at);
  const ratio = spot === null ? 0 : spot / (last || 1);

  return (
    // Der Zeiger wird über der ganzen Fläche verfolgt, nicht über der Linie:
    // eine 1,5 Pixel breite Kurve zu treffen ist keine Bedienung.
    <div
      className="spark-wrap"
      onPointerDown={track}
      onPointerLeave={() => setAt(null)}
      onPointerMove={track}
    >
      <svg
        className="spark"
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`${label}: ${amount(present.at(-1) ?? 0, unit)} ${unit} zuletzt, zwischen ${amount(low, unit)} und ${amount(high, unit)} ${unit}`}
      >
        <line
          className="spark-grid"
          x1={0}
          y1={height - 0.5}
          x2={width}
          y2={height - 0.5}
        />
        {segments.map((d, i) => (
          <path className="spark-line" d={d} key={i} />
        ))}
      </svg>

      {spot !== null ? (
        <>
          <i className="spark-cross" style={{ left: `${ratio * 100}%` }} />
          {/*
            Der Punkt ist ein Kreis und darf deshalb nicht in die Fläche
            hinein: das SVG wird in der Breite gezerrt (`preserveAspectRatio`),
            aus dem Kreis würde eine Ellipse. Als Element darüber bleibt er rund.
          */}
          <i
            className="spark-dot"
            style={{
              left: `${ratio * 100}%`,
              top: `${(y(values[spot]!) / height) * 100}%`,
            }}
          />
          <div
            className="hovercard spark-read"
            style={{
              left: `${ratio * 100}%`,
              transform: `translateX(${ratio > 0.66 ? "calc(-100% - 10px)" : ratio < 0.34 ? "10px" : "-50%"})`,
            }}
          >
            <b className="num">
              {amount(values[spot]!, unit)} {unit}
            </b>
            {dates?.[spot] ? (
              <span className="faint">
                {" "}
                {weekdayOf(dates[spot])} {formatDateDe(dates[spot])}
              </span>
            ) : null}
          </div>
        </>
      ) : null}
    </div>
  );
}

/**
 * Senkrechte Balken je Monat oder Bauer — für wenige, benannte Werte. Die
 * Balken haben eine Höchstbreite: bei drei Monaten über eine ganze Kartenbreite
 * gezogen sähen sie sonst aus wie Plakate, nicht wie ein Diagramm.
 */
export function Bars({
  data,
  height = 64,
  unit = "kg",
}: {
  /** `title` ist der ausgeschriebene Name — die Beschriftung ist kurz. */
  data: { label: string; value: number; title?: string }[];
  height?: number;
  unit?: Unit;
}) {
  const [at, setAt] = useState<string | null>(null);

  if (data.length === 0) return <Empty>Keine Werte.</Empty>;
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="bars" style={{ "--bars-h": `${height}px` } as React.CSSProperties}>
      {data.map((entry) => (
        <div
          className={`bars-col${at === entry.label ? " is-on" : ""}`}
          key={entry.label}
          onPointerEnter={() => setAt(entry.label)}
          onPointerLeave={() => setAt(null)}
        >
          <div className="num small faint">{amount(entry.value, unit)}</div>
          <div
            className="bars-bar"
            style={{ height: Math.max(2, (entry.value / max) * height) }}
          />
          <div className="small muted">{entry.label}</div>
          {at === entry.label ? (
            <div className="hovercard bars-read">
              <b className="num">
                {amount(entry.value, unit)} {unit}
              </b>{" "}
              <span className="faint">{entry.title ?? entry.label}</span>
            </div>
          ) : null}
        </div>
      ))}
    </div>
  );
}
