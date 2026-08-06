/*
  Zwei Größen, zwei Einheiten: Milch wird in Litern gemessen, Käse in
  Kilogramm. Die Zahlen werden gleich gesetzt — getrennte Namen gibt es, damit
  an der Aufrufstelle steht, wovon die Rede ist, und niemand aus Versehen
  Liter mit „kg" beschriftet.
*/
const ONE = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
const ZERO = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 0 });
const TWO = new Intl.NumberFormat("de-DE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const PCT = new Intl.NumberFormat("de-DE", {
  style: "percent",
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
});
/** Halbe Tage kommen vor (ein Gemelk), ganze bleiben ohne Nachkommastelle. */
const DAYS = new Intl.NumberFormat("de-DE", { maximumFractionDigits: 1 });

/** Käse, eine Nachkommastelle. */
export function kg(value: number): string {
  return ONE.format(value);
}

export function kg0(value: number): string {
  return ZERO.format(value);
}

export function kg2(value: number): string {
  return TWO.format(value);
}

/** Milch, eine Nachkommastelle — für einzelne Gemelke und Verluste. */
export function liter(value: number): string {
  return ONE.format(value);
}

/** Milch in Tages- und Saisonmengen: dort sind Zehntelliter Zierrat. */
export function liter0(value: number): string {
  return ZERO.format(value);
}

export function pct(value: number): string {
  return PCT.format(value);
}

export function days(value: number): string {
  return DAYS.format(value);
}

export function signedKg(value: number): string {
  return `${value > 0 ? "+" : ""}${ONE.format(value)}`;
}

/**
 * Dateigrößen. Eine Alpsaison umfasst ein paar hundert Kilobyte — Byte-genau
 * abgelesen sagt das nichts, deshalb wird gerundet, und unter einem Megabyte
 * bleibt es bei Kilobyte.
 */
export function bytes(value: number): string {
  if (value < 1024) return `${ZERO.format(value)} B`;
  if (value < 1024 * 1024) return `${ZERO.format(value / 1024)} kB`;
  return `${ONE.format(value / (1024 * 1024))} MB`;
}

const WEEKDAYS = ["So", "Mo", "Di", "Mi", "Do", "Fr", "Sa"];

export function weekdayOf(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

/** Heutiges Datum in lokaler Zeit als ISO-Tag. */
export function todayIso(): string {
  const now = new Date();
  return [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("-");
}

/** Der frühere der beiden Tage — für den Stichtag einer laufenden Saison. */
export function minIso(a: string, b: string): string {
  return a < b ? a : b;
}

/** Der spätere der beiden Tage. */
export function maxIso(a: string, b: string): string {
  return a > b ? a : b;
}
