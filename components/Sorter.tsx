"use client";

import { useState } from "react";

/*
  Sortieren einer Liste
  =====================

  Sortieren ist eine Frage an die Liste, keine Änderung an den Daten — deshalb
  steht es im Bauteil und nicht in der Adresse. Die Spaltenköpfe sind die
  Bedienung: was man vergleichen will, klickt man an. Zahlen fangen beim größten
  Wert an, Namen beim ersten Buchstaben; das ist jeweils die Frage, die man
  wirklich stellt, wenn man auf so eine Spalte klickt.

  Die Kühe und die Bauern brauchen dasselbe, also steht es einmal hier. Was die
  beiden Listen unterscheidet — welche Spalten es gibt und wie zwei Zeilen
  verglichen werden — bleibt bei ihnen; das ist der Teil, der wirklich von der
  Liste abhängt.
*/

export interface Sort<K extends string> {
  key: K;
  desc: boolean;
}

export interface Sorter<K extends string> {
  sort: Sort<K>;
  /**
   * Ein Spaltenkopf, der sortiert. Er sieht aus wie die übrigen Köpfe; der
   * Pfeil steht nur an der Spalte, nach der gerade sortiert wird — an allen
   * anderen wäre er eine Behauptung über eine Ordnung, die dort nicht gilt.
   */
  head: (key: K, label: string, num?: boolean) => React.ReactNode;
}

export function useSort<K extends string>(
  start: K,
  /** Welche Spalten Zahlen sind — sie beginnen absteigend, also mit der Spitze. */
  numeric: ReadonlySet<K>,
): Sorter<K> {
  const [sort, setSort] = useState<Sort<K>>({ key: start, desc: numeric.has(start) });

  const click = (key: K) => {
    setSort((now) =>
      now.key === key ? { key, desc: !now.desc } : { key, desc: numeric.has(key) },
    );
  };

  return {
    sort,
    head: (key, label, num) => {
      const active = sort.key === key;
      return (
        <th
          aria-sort={active ? (sort.desc ? "descending" : "ascending") : "none"}
          className={num ? "t-num" : undefined}
          key={key}
        >
          <button className="th-sort" onClick={() => click(key)} type="button">
            {label}
            <span aria-hidden className="th-arrow">
              {active ? (sort.desc ? "↓" : "↑") : ""}
            </span>
          </button>
        </th>
      );
    },
  };
}

/**
 * Sortiert eine Kopie. `tie` entscheidet den Gleichstand, damit dieselbe Liste
 * zweimal gleich aussieht — sonst hinge die Reihenfolge gleicher Werte davon
 * ab, in welcher Ordnung man vorher war.
 */
export function ordered<T, K extends string>(
  rows: readonly T[],
  sort: Sort<K>,
  compare: (a: T, b: T, key: K) => number,
  tie: (a: T, b: T) => number,
): T[] {
  return [...rows].sort((a, b) => {
    const order = compare(a, b, sort.key);
    return order !== 0 ? (sort.desc ? -order : order) : tie(a, b);
  });
}
