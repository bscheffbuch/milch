"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import NavIcon from "@/components/NavIcon";

/*
  Eine Auswahl, die überall gleich aussieht
  =========================================

  `<select>` zeichnet nicht die Seite, sondern das Betriebssystem. Unter macOS
  klappt eine Liste in Systemfarben über dem Feld auf, unter Windows eine
  darunter, und wie hoch, wie breit und in welcher Schrift entscheidet die
  WebView-Fassung des jeweiligen Rechners. Dieselbe Maske sah damit auf der Alp
  anders aus als auf dem Rechner daheim — und in eine Liste, die das System
  zeichnet, bekommt man weder eine Suche noch eine Zwischenüberschrift hinein.

  Deshalb steht hier eine eigene. Sie zeigt dieselben Möglichkeiten wie vorher,
  schickt denselben Wert ab — ein verborgenes Feld unter dem Knopf, die
  Gegenseite merkt vom Wechsel nichts — und bringt zwei Dinge mit, die eine
  Systemliste nicht kann: ein Suchfeld, sobald die Liste länger wird als ein
  Blick, und Zwischenüberschriften für Gruppen.

  Bedient wird sie wie die Systemliste, sonst wäre nichts gewonnen: Pfeiltasten
  gehen durch, Eingabe wählt, Esc bricht ab, Tab geht weiter. Der Aufklapp hängt
  am Körper der Seite und nicht am Feld — in der Ablage rechts stünde er sonst in
  einer Fläche, die scrollt und abschneidet.
*/

export interface DropdownOption {
  value: string;
  label: string;
  /** Steht rechts und leiser — die Glocke neben dem Kuhnamen etwa. */
  hint?: string;
  /** Zwischenüberschrift. Aufeinanderfolgende Gleiche stehen unter einer. */
  group?: string;
  disabled?: boolean;
  /**
   * Führt einen Schritt weiter, statt zu wählen: die Liste bleibt offen, der
   * Wert unberührt. So steht der Weg über den Bauern zur Kuh in derselben
   * Liste wie die Kühe selbst.
   */
  onStep?: () => void;
}

/** Höhe, über die der Aufklapp nicht hinauswächst — und die entscheidet, ob er kippt. */
const SHEET_MAX = 304;

/**
 * Ab so vielen Möglichkeiten steht ein Suchfeld dabei. Darunter sieht man die
 * ganze Liste auf einen Blick und hätte länger getippt als geschaut.
 */
const SEARCH_FROM = 8;

interface Sheet {
  left: number;
  width: number;
  max: number;
  /** Von oben oder von unten gemessen — je nachdem, wohin der Aufklapp passt. */
  top?: number;
  bottom?: number;
}

export default function Dropdown({
  ariaLabel,
  defaultValue,
  disabled,
  display,
  empty = "Nichts gefunden.",
  id,
  name,
  onChange,
  onSearch,
  options,
  placeholder = "wählen",
  required,
  search,
  searchFrom = SEARCH_FROM,
  searchPlaceholder = "suchen",
  value,
}: {
  /** Nur nötig, wo keine Beschriftung danebensteht. */
  ariaLabel?: string;
  defaultValue?: string;
  disabled?: boolean;
  /**
   * Was am Knopf steht, solange die gewählte Zeile gerade nicht in der Liste
   * steht — etwa die gewählte Kuh, während die Liste bei den Bauern steht.
   */
  display?: DropdownOption;
  /** Steht statt der Liste da, wenn nichts übrig bleibt. */
  empty?: string;
  id: string;
  /** Fehlt der Name, wird nichts abgeschickt — die Auswahl steuert dann nur die Seite. */
  name?: string;
  onChange?: (value: string) => void;
  /**
   * Gesetzt heißt: gesucht wird draußen. Das Suchfeld steht dann immer dabei
   * und filtert nicht selbst — die Möglichkeiten kommen schon gefiltert an.
   */
  onSearch?: (query: string) => void;
  options: DropdownOption[];
  placeholder?: string;
  required?: boolean;
  search?: string;
  searchFrom?: number;
  searchPlaceholder?: string;
  value?: string;
}) {
  const [own, setOwn] = useState(defaultValue ?? "");
  const current = value ?? own;

  const [ownQuery, setOwnQuery] = useState("");
  const query = search ?? ownQuery;

  const [sheet, setSheet] = useState<Sheet | null>(null);
  const [cursor, setCursor] = useState(0);

  const wrap = useRef<HTMLDivElement>(null);
  const knopf = useRef<HTMLButtonElement>(null);
  const liste = useRef<HTMLDivElement>(null);
  const feld = useRef<HTMLInputElement>(null);
  const pflicht = useRef<HTMLInputElement>(null);

  const searchable = onSearch !== undefined || options.length > searchFrom;

  // Gesucht wird in der Beschriftung und im Zusatz: welches von beiden einem
  // gerade einfällt, weiß man vorher nicht. Schritte bleiben immer stehen —
  // der Weg zurück darf nicht wegfiltern.
  const needle = query.trim().toLowerCase();
  const shown = useMemo(() => {
    if (onSearch !== undefined || needle === "") return options;
    return options.filter(
      (option) =>
        option.onStep !== undefined ||
        `${option.label} ${option.hint ?? ""}`.toLowerCase().includes(needle),
    );
  }, [needle, onSearch, options]);

  const chosen =
    options.find((option) => option.value === current && !option.onStep) ??
    (current === "" ? undefined : display);

  const place = () => {
    const box = wrap.current?.getBoundingClientRect();
    if (!box) return;
    const below = window.innerHeight - box.bottom - 14;
    const above = box.top - 14;
    // Nach oben nur, wenn es unten wirklich eng ist und oben mehr Platz hat.
    const up = below < SHEET_MAX && above > below;
    const left = Math.max(8, Math.min(box.left, window.innerWidth - box.width - 8));
    setSheet({
      left,
      width: box.width,
      max: Math.max(140, Math.min(SHEET_MAX, up ? above : below)),
      ...(up ? { bottom: window.innerHeight - box.top + 5 } : { top: box.bottom + 5 }),
    });
  };

  const open = () => {
    if (disabled) return;
    const at = shown.findIndex((option) => option.value === current && !option.onStep);
    setCursor(at < 0 ? 0 : at);
    place();
  };

  const close = (back = true) => {
    setSheet(null);
    if (onSearch === undefined) setOwnQuery("");
    else onSearch("");
    if (back) knopf.current?.focus();
  };

  const pick = (option: DropdownOption) => {
    if (option.disabled) return;
    if (option.onStep) {
      option.onStep();
      setCursor(0);
      return;
    }
    if (value === undefined) setOwn(option.value);
    onChange?.(option.value);
    close();
  };

  /** Zur nächsten wählbaren Zeile in der angegebenen Richtung. */
  const step = (from: number, dir: number) => {
    const count = shown.length;
    for (let i = 1; i <= count; i += 1) {
      const at = (((from + dir * i) % count) + count) % count;
      if (!shown[at]?.disabled) return at;
    }
    return from;
  };

  const walk = (event: React.KeyboardEvent) => {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!sheet) {
        open();
        return;
      }
      setCursor((at) => step(at, event.key === "ArrowDown" ? 1 : -1));
      return;
    }
    if (!sheet) return;
    if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      setCursor(event.key === "Home" ? step(-1, 1) : step(shown.length, -1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const option = shown[cursor];
      if (option) pick(option);
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key === "Tab") close(false);
  };

  /*
    Der Aufklapp hängt am Fenster und muss dem Feld folgen, wenn sich darunter
    etwas bewegt — genau wie der Monatsraster am Datumsfeld.
  */
  useEffect(() => {
    if (!sheet) return;

    const follow = () => place();
    const away = (event: PointerEvent) => {
      const target = event.target as Node;
      if (wrap.current?.contains(target) || liste.current?.contains(target)) return;
      setSheet(null);
      if (onSearch === undefined) setOwnQuery("");
      else onSearch("");
    };

    window.addEventListener("resize", follow);
    window.addEventListener("scroll", follow, true);
    window.addEventListener("pointerdown", away, true);
    return () => {
      window.removeEventListener("resize", follow);
      window.removeEventListener("scroll", follow, true);
      window.removeEventListener("pointerdown", away, true);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheet]);

  // Steht ein Suchfeld dabei, gehört der Strich hinein: getippt wird sofort,
  // die Pfeiltasten steuern von dort aus weiter durch die Liste.
  useEffect(() => {
    if (sheet && searchable) feld.current?.focus();
  }, [sheet, searchable]);

  useEffect(() => {
    liste.current?.querySelector("[data-cursor]")?.scrollIntoView({ block: "nearest" });
  }, [cursor, sheet]);

  /*
    Pflicht wird über ein verborgenes Feld geprüft. Der Knopf selbst kann das
    nicht: geprüft wird, was abgeschickt wird, und das ist der Wert. Der Text
    steht hier, weil „Füllen Sie dieses Feld aus“ vor einer Liste danebengreift.
  */
  useEffect(() => {
    pflicht.current?.setCustomValidity(current === "" ? "Bitte eine Zeile wählen." : "");
  }, [current]);

  return (
    <div className="dropdown" ref={wrap}>
      <button
        aria-controls={sheet ? `${id}-liste` : undefined}
        aria-expanded={sheet !== null}
        aria-haspopup="listbox"
        aria-label={ariaLabel}
        className="dropdown-btn"
        disabled={disabled}
        id={id}
        onClick={() => (sheet ? close(false) : open())}
        onKeyDown={walk}
        ref={knopf}
        type="button"
      >
        <span className={chosen ? "dropdown-wert" : "dropdown-wert dropdown-leer"}>
          {chosen ? chosen.label : placeholder}
        </span>
        {chosen?.hint ? <span className="dropdown-zusatz">{chosen.hint}</span> : null}
        <NavIcon className="dropdown-pfeil" name="pfeil" />
      </button>

      {name === undefined ? null : required ? (
        <input
          aria-hidden
          className="dropdown-pflicht"
          name={name}
          onChange={() => undefined}
          ref={pflicht}
          required
          tabIndex={-1}
          value={current}
        />
      ) : (
        <input name={name} type="hidden" value={current} />
      )}

      {sheet
        ? createPortal(
            <div
              className="dropsheet"
              id={`${id}-liste`}
              onKeyDown={walk}
              ref={liste}
              style={{
                bottom: sheet.bottom,
                left: sheet.left,
                maxHeight: sheet.max,
                minWidth: sheet.width,
                top: sheet.top,
              }}
            >
              {searchable ? (
                <div className="dropsheet-suche">
                  <NavIcon className="search-icon" name="suche" />
                  <input
                    aria-label={searchPlaceholder}
                    autoComplete="off"
                    onChange={(event) =>
                      onSearch === undefined
                        ? setOwnQuery(event.target.value)
                        : onSearch(event.target.value)
                    }
                    placeholder={searchPlaceholder}
                    ref={feld}
                    spellCheck={false}
                    type="text"
                    value={query}
                  />
                </div>
              ) : null}

              <div
                aria-label={ariaLabel}
                className="dropsheet-liste"
                role="listbox"
                tabIndex={-1}
              >
                {shown.length === 0 ? <p className="dropsheet-leer">{empty}</p> : null}
                {shown.map((option, at) => (
                  <div key={`${option.value}-${at}`}>
                    {option.group !== undefined && option.group !== shown[at - 1]?.group ? (
                      <div className="dropsheet-gruppe">{option.group}</div>
                    ) : null}
                    <div
                      aria-disabled={option.disabled}
                      aria-selected={option.value === current && !option.onStep}
                      className={
                        option.onStep
                          ? "dropsheet-zeile dropsheet-schritt"
                          : "dropsheet-zeile"
                      }
                      data-cursor={at === cursor ? "" : undefined}
                      data-on={option.value === current && !option.onStep ? "" : undefined}
                      onClick={() => pick(option)}
                      onPointerMove={() => setCursor(at)}
                      role="option"
                    >
                      <span className="dropsheet-text">{option.label}</span>
                      {option.hint ? (
                        <span className="dropsheet-zusatz">{option.hint}</span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
