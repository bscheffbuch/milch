"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import NavIcon from "@/components/NavIcon";
import { monthGrid, shiftMonth } from "@/lib/calendar";
import { todayIso } from "@/lib/format";
import {
  dayIndex,
  formatMonth,
  isoFromDayIndex,
  monthOf,
  formatDateDe,
} from "@/lib/gemelk";

/*
  Ein Feld für ein Datum
  ======================

  `<input type="date">` sieht auf jedem Rechner anders aus und liest sich auf
  keinem gut. Unter macOS steht dort die amerikanische Reihenfolge, wenn die
  Systemsprache es so will; unter Windows kommt ein eigener Kalender in
  Systemfarben, der von der Seite nichts weiß; in der Tauri-Ansicht hängt beides
  an der WebView-Version des Rechners. Ein Formular, das auf drei Rechnern drei
  verschiedene Dinge zeigt, ist kein Formular, sondern ein Glücksspiel.

  Deshalb steht hier ein eigenes Feld. Es zeigt und nimmt deutsche Datumsangaben
  (`TT.MM.JJJJ`), tippen geht durchgehend, und daneben klappt derselbe
  Monatsraster auf, den auch der große Kalender zeichnet. Was abgeschickt wird,
  ist unverändert das ISO-Datum in einem verborgenen Feld — die Gegenseite merkt
  vom Wechsel nichts.

  Getippt wird großzügig gelesen: `1.6.`, `1.6.26`, `01.06.2026` und `2026-06-01`
  meinen alle denselben Tag. Fehlt das Jahr, ist es das des gerade gezeigten
  Monats; das ist beim Nachtragen einer Saison fast immer das gemeinte.
*/

const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];

/** Höhe des aufgeklappten Rasters — entscheidet nur, ob es nach oben kippt. */
const SHEET_HEIGHT = 306;
const SHEET_WIDTH = 252;

/**
 * Liest eine getippte Datumsangabe. `null` heißt: daraus wird kein Datum.
 * Leer ist kein Fehler, sondern die leere Angabe — das prüft `required`.
 */
export function parseDateInput(text: string, fallbackYear: number): string | null {
  const trimmed = text.trim();
  if (trimmed === "") return null;

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(trimmed);
  if (iso) return build(Number(iso[1]), Number(iso[2]), Number(iso[3]));

  // Punkt, Schrägstrich oder Bindestrich trennen; der letzte Punkt darf fehlen.
  const de = /^(\d{1,2})\s*[./-]\s*(\d{1,2})\s*(?:[./-]\s*(\d{1,4}))?\.?$/.exec(trimmed);
  if (!de) return null;

  const day = Number(de[1]);
  const month = Number(de[2]);
  let year = de[3] === undefined ? fallbackYear : Number(de[3]);
  // Zwei Ziffern meinen dieses Jahrhundert: „26“ ist 2026, nicht 26 n. Chr.
  if (de[3] !== undefined && de[3].length <= 2) year += 2000;
  return build(year, month, day);
}

/** Nur echte Tage: der 31. Februar ist kein Datum, sondern ein Tippfehler. */
function build(year: number, month: number, day: number): string | null {
  if (year < 1900 || year > 2200) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const iso = `${year}-${pad(month)}-${pad(day)}`;
  return isoFromDayIndex(dayIndex(iso)) === iso ? iso : null;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export default function DateField({
  defaultValue = "",
  disabled,
  hint,
  id,
  label,
  max,
  min,
  name,
  onChange,
  required,
}: {
  defaultValue?: string;
  disabled?: boolean;
  hint?: string;
  id: string;
  /** Fehlt die Beschriftung, steht nur das Feld da — etwa in einer Tabellenzelle. */
  label?: string;
  /** Grenzen als ISO-Datum. Außerhalb liegende Tage bleiben sichtbar, aber tot. */
  max?: string;
  min?: string;
  name: string;
  onChange?: (iso: string) => void;
  required?: boolean;
}) {
  const [value, setValue] = useState(defaultValue);
  const [text, setText] = useState(defaultValue ? formatDateDe(defaultValue) : "");
  const [month, setMonth] = useState(monthOf(defaultValue || todayIso()));
  const [sheet, setSheet] = useState<{ left: number; top: number } | null>(null);
  const [cursor, setCursor] = useState(defaultValue || todayIso());

  const wrap = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const grid = useRef<HTMLDivElement>(null);

  const take = (iso: string) => {
    setValue(iso);
    setText(iso ? formatDateDe(iso) : "");
    if (iso) {
      setMonth(monthOf(iso));
      setCursor(iso);
    }
    onChange?.(iso);
  };

  /*
    Getippt wird laufend gelesen, nicht erst beim Verlassen: wer das Datum
    eintippt und gleich abschickt, hat sonst ein leeres Feld abgeschickt. Was
    (noch) kein Datum ergibt, löscht den Wert — bis der Tippende fertig ist,
    steht dann nichts da, und das ist ehrlicher als der vorige Tag.
  */
  const type = (next: string) => {
    setText(next);
    const iso = parseDateInput(next, Number(month.slice(0, 4)));
    setValue(iso ?? "");
    if (iso) {
      setMonth(monthOf(iso));
      setCursor(iso);
    }
    onChange?.(iso ?? "");
    field.current?.setCustomValidity(
      next.trim() !== "" && !iso ? "Bitte ein Datum als TT.MM.JJJJ." : "",
    );
  };

  /** Beim Verlassen wird aufgeräumt: `1.6.` steht danach als `01.06.2026` da. */
  const tidy = () => {
    if (value) setText(formatDateDe(value));
  };

  const place = () => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom > SHEET_HEIGHT + 12;
    setSheet({
      left: Math.max(8, Math.min(box.left, window.innerWidth - SHEET_WIDTH - 8)),
      top: below ? box.bottom + 6 : Math.max(8, box.top - SHEET_HEIGHT - 6),
    });
  };

  const openSheet = () => {
    setMonth(monthOf(value || todayIso()));
    setCursor(value || todayIso());
    place();
  };

  /*
    Der Raster hängt am Fenster, nicht am Feld: in der Ablage steht er sonst in
    einer Fläche, die scrollt und abschneidet. Dafür muss er dem Feld folgen,
    wenn sich darunter etwas bewegt.
  */
  useEffect(() => {
    if (!sheet) return;

    const follow = () => place();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrap.current?.contains(target) || grid.current?.contains(target)) return;
      setSheet(null);
    };
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSheet(null);
        field.current?.focus();
      }
    };

    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("pointerdown", away, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("pointerdown", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [sheet]);

  const blocked = (iso: string) =>
    (min !== undefined && iso < min) || (max !== undefined && iso > max);

  const step = (days: number) => {
    const next = isoFromDayIndex(dayIndex(cursor) + days);
    setCursor(next);
    setMonth(monthOf(next));
  };

  const walk = (event: React.KeyboardEvent) => {
    const moves: Record<string, number> = {
      ArrowLeft: -1,
      ArrowRight: 1,
      ArrowUp: -7,
      ArrowDown: 7,
    };
    if (event.key in moves) {
      event.preventDefault();
      step(moves[event.key]);
      return;
    }
    if (event.key === "PageUp" || event.key === "PageDown") {
      event.preventDefault();
      setMonth(shiftMonth(month, event.key === "PageUp" ? -1 : 1));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      if (blocked(cursor)) return;
      take(cursor);
      setSheet(null);
      field.current?.focus();
    }
  };

  const today = todayIso();

  return (
    <div className={label ? "field" : undefined}>
      {label ? <label htmlFor={id}>{label}</label> : null}
      <div className="field-date" ref={wrap}>
        <input
          aria-label={label ? undefined : name}
          autoComplete="off"
          className="num"
          disabled={disabled}
          id={id}
          inputMode="numeric"
          onBlur={tidy}
          onChange={(event) => type(event.target.value)}
          placeholder="TT.MM.JJJJ"
          ref={field}
          required={required}
          spellCheck={false}
          value={text}
        />
        <button
          aria-expanded={sheet !== null}
          aria-label="Kalender öffnen"
          className="field-date-btn"
          disabled={disabled}
          onClick={() => (sheet ? setSheet(null) : openSheet())}
          title="Kalender öffnen"
          type="button"
        >
          <NavIcon className="nav-icon" name="kalender" />
        </button>
        {/* Abgeschickt wird das ISO-Datum — daran ändert die Anzeige nichts. */}
        <input name={name} type="hidden" value={value} />
      </div>
      {hint ? <p className="small faint">{hint}</p> : null}

      {/*
        Der Raster hängt am Körper der Seite. In der Ablage steht das Feld sonst
        in einer Fläche mit eigenem Zeichengrund — `position: fixed` gölte dann
        relativ zu ihr, und der Raster klebte irgendwo im Nirgendwo.
      */}
      {sheet
        ? createPortal(
            <div
              className="datesheet"
              onKeyDown={walk}
              ref={grid}
              role="dialog"
              style={{ left: sheet.left, top: sheet.top }}
              tabIndex={-1}
            >
              <div className="datesheet-head">
                <button
                  aria-label="Voriger Monat"
                  className="datesheet-step"
                  onClick={() => setMonth(shiftMonth(month, -1))}
                  type="button"
                >
                  ‹
                </button>
                <strong>{formatMonth(month)}</strong>
                <button
                  aria-label="Nächster Monat"
                  className="datesheet-step"
                  onClick={() => setMonth(shiftMonth(month, 1))}
                  type="button"
                >
                  ›
                </button>
              </div>

              <div className="datesheet-grid">
                {WEEKDAYS.map((day) => (
                  <div className="datesheet-wd" key={day}>
                    {day}
                  </div>
                ))}
                {monthGrid(month).map((week) =>
                  week.map((day) => {
                    const iso = isoFromDayIndex(day);
                    const outside = monthOf(iso) !== month;
                    return (
                      <button
                        aria-current={iso === today ? "date" : undefined}
                        className="datesheet-day"
                        data-cursor={iso === cursor ? "" : undefined}
                        data-off={outside ? "" : undefined}
                        data-on={iso === value ? "" : undefined}
                        data-today={iso === today ? "" : undefined}
                        disabled={blocked(iso)}
                        key={day}
                        onClick={() => {
                          take(iso);
                          setSheet(null);
                          field.current?.focus();
                        }}
                        type="button"
                      >
                        {Number(iso.slice(8))}
                      </button>
                    );
                  }),
                )}
              </div>

              <div className="datesheet-foot">
                <button
                  className="btn-quiet btn-sm"
                  disabled={blocked(today)}
                  onClick={() => {
                    take(today);
                    setSheet(null);
                    field.current?.focus();
                  }}
                  type="button"
                >
                  Heute
                </button>
                {required ? null : (
                  <button
                    className="btn-quiet btn-sm"
                    onClick={() => {
                      take("");
                      setSheet(null);
                      field.current?.focus();
                    }}
                    type="button"
                  >
                    Leeren
                  </button>
                )}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
