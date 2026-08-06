import NavIcon from "@/components/NavIcon";
import type { DayEvents } from "@/lib/calendar";

/**
 * Ereignisarten unterscheiden sich über die Form, nicht über den Farbton.
 *
 * Die Messung trägt die Waage aus der Leiste: sie ist der Tag, um den sich hier
 * alles dreht, und ein Punkt wie jeder andere sagte darüber nichts. Was einmal
 * im Jahr geschieht — Auf- und Abtrieb, Trockenstellen, Abholung — bleibt bei
 * seiner geometrischen Marke.
 *
 * Behandlung und Sperre stehen bewusst nicht hier: sie dauern an, und eine
 * Dauer gehört nicht in ein Tageszeichen. Sie laufen als Balken unter der
 * Woche durch.
 */
export const MARKS = [
  {
    key: "round",
    glyph: <NavIcon className="mark-icon" name="messung" />,
    label: "Messung",
  },
  { key: "arrival", glyph: "▲", label: "Auftrieb" },
  { key: "departure", glyph: "▼", label: "Abtrieb" },
  { key: "dryOff", glyph: "◆", label: "trockengestellt" },
  { key: "pickup", glyph: "○", label: "Abholung" },
] as const;

export function DayMarks({ events }: { events: DayEvents }) {
  const counts: Record<string, number> = {
    round: events.roundIds.length,
    arrival: events.arrivals.length,
    departure: events.departures.length,
    dryOff: events.dryOffs.length,
    pickup: events.pickupFarmerIds.length,
  };

  return (
    <div className="cal-marks">
      {MARKS.map((mark) => {
        const count = counts[mark.key];
        if (!count) return null;
        return (
          <span className="mark" key={mark.key} title={`${count}× ${mark.label}`}>
            {mark.glyph}
            {count > 1 ? <b>{count}</b> : null}
          </span>
        );
      })}
    </div>
  );
}

export function MarkLegend() {
  return (
    <div className="legend">
      {MARKS.map((mark) => (
        <span key={mark.key}>
          <i className="mark">{mark.glyph}</i>
          {mark.label}
        </span>
      ))}
    </div>
  );
}
