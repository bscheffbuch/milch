import { de } from "@/lib/i18n/de";

/*
  Die Sprache der Oberfläche
  ==========================

  Bisher stand jeder sichtbare Satz dort, wo er angezeigt wird. Das liest sich
  gut und lässt sich nicht übersetzen: eine zweite Sprache hieße, jede Datei ein
  zweites Mal zu schreiben. Deshalb steht der Text jetzt in einem Wörterbuch und
  die Anzeige holt ihn über einen Schlüssel: `t("update.ready", { version })`.

  Eine weitere Sprache ist damit eine weitere Datei neben `de.ts` mit denselben
  Schlüsseln. Dass sie wirklich dieselben sind, prüft TypeScript: die neue Datei
  wird gegen `Dictionary` — also gegen die Form der deutschen — geschrieben, und
  ein fehlender oder erfundener Schlüssel ist dann ein Fehler beim Übersetzen und
  nicht ein leeres Feld im laufenden Programm.

  Was Next.js unter Internationalisierung beschreibt (`app/[lang]/…`, die Sprache
  als Teil der Adresse) passt hier bewusst nicht. Das hier ist ein Programmfenster
  und keine Website: die Sprache ist eine Einstellung und kein Ort, und der
  statische Export würde sich mit jeder Sprache vervielfachen.

  Die Schlüssel sind englisch, die Texte deutsch. Der Schlüssel gehört zum Code
  wie ein Bezeichner auch — die Sprache steht auf der anderen Seite des
  Doppelpunkts.
*/

/** Alle Sprachen, die es gibt. Eine weitere kommt hier und in `DICTIONARIES` dazu. */
export type Language = "de";

export const DEFAULT_LANGUAGE: Language = "de";

/**
 * Die Form des Wörterbuchs — festgelegt von der deutschen Fassung, weil sie
 * vollständig ist und es bleibt. Jede weitere Sprache wird gegen diesen Typ
 * geschrieben und ist damit zur Vollständigkeit gezwungen.
 */
export type Dictionary = typeof de;

export const DICTIONARIES: Record<Language, Dictionary> = { de };

/** Was in den Einstellungen zur Auswahl steht. */
export const LANGUAGE_NAMES: Record<Language, string> = { de: "Deutsch" };

/**
 * Alle Schlüssel als Punktpfade — `"update.ready"` und nicht `["update",
 * "ready"]`. Der Typ entsteht aus dem Wörterbuch selbst, ein Tippfehler im
 * Schlüssel ist deshalb ein Fehler beim Übersetzen.
 */
type Path<T> = {
  [K in keyof T & string]: T[K] extends string ? K : `${K}.${Path<T[K]>}`;
}[keyof T & string];

export type Key = Path<Dictionary>;

/** Was in `{…}` eingesetzt werden kann. Zahlen kommen als solche herein. */
export type Values = Record<string, string | number>;

/** Wo eine Zahl mitspielt, stehen zwei Schlüssel nebeneinander. */
export type CountKey = Key extends infer K
  ? K extends `${infer B}.one`
    ? B
    : never
  : never;

const PLACEHOLDER = /\{(\w+)\}/g;

function lookup(dict: Dictionary, key: string): string | null {
  let current: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof current !== "object" || current === null) return null;
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === "string" ? current : null;
}

/**
 * Holt den Text und setzt ein, was in `{…}` steht.
 *
 * Fehlt ein Schlüssel, steht er selbst da. Das ist hässlich und mit Absicht: ein
 * leeres Feld sähe nach einem Programmfehler an anderer Stelle aus, der Schlüssel
 * sagt dagegen genau, was fehlt und wo es nachzutragen ist.
 */
export function translate(dict: Dictionary, key: string, values?: Values): string {
  const text = lookup(dict, key);
  if (text === null) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`Kein Text zum Schlüssel ${key}`);
    }
    return key;
  }
  if (!values) return text;
  return text.replace(PLACEHOLDER, (whole, name: string) =>
    name in values ? String(values[name]) : whole,
  );
}

/**
 * Der Text zu einer Anzahl. Unter dem Schlüssel stehen dafür `one` und `other`,
 * und `{count}` steht in beiden zur Verfügung.
 *
 * Deutsch und Englisch kommen mit diesen beiden aus. Sprachen mit mehr Formen
 * brauchen hier `Intl.PluralRules` — dann wird aus der Fallunterscheidung eine
 * Abfrage, die Schlüssel bleiben dieselben.
 */
export function translateCount(
  dict: Dictionary,
  key: string,
  count: number,
  values?: Values,
): string {
  return translate(dict, `${key}.${count === 1 ? "one" : "other"}`, {
    count,
    ...values,
  });
}

export interface Translator {
  (key: Key, values?: Values): string;
  /** Dasselbe für eine Anzahl: `n("cows.count", 3)` → „3 Kühe“. */
  n: (key: CountKey, count: number, values?: Values) => string;
}

/**
 * Bindet ein Wörterbuch an beide Aufrufe. Zusammengesetzt wird mit
 * `Object.assign` und nicht nachträglich zugewiesen: der React-Compiler sieht
 * eine nachträgliche Änderung an einem Wert und hält sie für einen Fehler — zu
 * Recht, denn hier soll nichts verändert, sondern eines erzeugt werden.
 */
export function translator(dict: Dictionary): Translator {
  return Object.assign((key: Key, values?: Values) => translate(dict, key, values), {
    n: (key: CountKey, count: number, values?: Values) =>
      translateCount(dict, key, count, values),
  });
}
