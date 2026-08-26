import type { Slot } from "@/lib/gemelk";

/*
  Der Stand, wie ihn die Datenschicht liefert
  ===========================================

  Jede Form hier hat ihr Gegenstück in `src-tauri/src/model.rs`. Die Namen sind
  auf beiden Seiten dieselben — wer hier ein Feld ändert, ändert es dort mit.

  Ein Alpsommer umfasst ein paar Dutzend Kühe und ein paar hundert Zeilen. Das
  kommt in einem Zug herüber, und die gesamte Auswertung entsteht daraus im
  Fenster. Deshalb gibt es keine einzelnen Abfragen: es gibt einen Stand, und
  nach jeder Änderung einen neuen.
*/

export interface Season {
  id: number;
  name: string;
  startDate: string;
  endDate: string;
  isActive: number;
  deductionPercent: number;
  deductionFixedPerDay: number;
}

export interface Farmer {
  id: number;
  name: string;
  contact: string | null;
  note: string | null;
  archived: number;
}

export interface Cow {
  id: number;
  farmerId: number;
  bellNumber: string;
  name: string;
  note: string | null;
  archived: number;
}

/** Kuh mit Bauern- und Saisondaten — die Form, die fast jede Ansicht braucht. */
export interface HerdCow extends Cow {
  farmerName: string;
  cowSeasonId: number | null;
  arrivalDate: string | null;
  arrivalSlot: Slot | null;
  departureDate: string | null;
  departureSlot: Slot | null;
  dryOffDate: string | null;
  dryOffSlot: Slot | null;
}

export interface CowSeason {
  id: number;
  seasonId: number;
  cowId: number;
  farmerId: number;
  arrivalDate: string;
  arrivalSlot: Slot;
  departureDate: string | null;
  departureSlot: Slot | null;
  dryOffDate: string | null;
  dryOffSlot: Slot | null;
  note: string | null;
}

export interface MeasurementRound {
  id: number;
  seasonId: number;
  firstDate: string;
  firstSlot: Slot;
  note: string | null;
}

/** Messwert samt Datum seiner Messung — gebraucht wird fast immer beides. */
export interface MeasurementValue {
  id: number;
  roundId: number;
  cowId: number;
  firstL: number | null;
  secondL: number | null;
  firstDate: string;
  firstSlot: Slot;
}

export interface TreatmentType {
  id: number;
  name: string;
  defaultWithholdGemelke: number;
  note: string | null;
  archived: number;
}

export interface Treatment {
  id: number;
  seasonId: number;
  cowId: number;
  typeId: number | null;
  label: string;
  startDate: string;
  startSlot: Slot;
  /** Fehlt das Ende, läuft die Behandlung noch — sie sperrt bis auf Weiteres. */
  endDate: string | null;
  endSlot: Slot | null;
  withholdGemelke: number;
  note: string | null;
}

/**
 * Welche Kuh in welcher Saison stand — über alle Saisons hinweg. Der
 * Schnappschuss führt sonst nur die aktive; für die Übernahme in eine neue
 * Saison muss die Oberfläche aber wissen, wer in der vorigen stand.
 */
export interface SeasonCow {
  seasonId: number;
  cowId: number;
}

export interface CheeseProduction {
  id: number;
  seasonId: number;
  date: string;
  kg: number;
  note: string | null;
}

/**
 * Käse, den die Alp selbst verbraucht — ein Eintrag je Entnahme.
 *
 * Anders als eine Abholung gehört er keinem Bauern: er wird vor der Verteilung
 * vom Käse seines Tages abgezogen und damit von allen getragen.
 */
export interface AlpCheese {
  id: number;
  seasonId: number;
  kg: number;
  note: string | null;
}

export interface Pickup {
  id: number;
  seasonId: number;
  farmerId: number;
  date: string;
  kg: number;
  wheels: number | null;
  note: string | null;
}

/** Ein abgelegtes Backup, wie es im Backup-Ordner liegt. */
export interface BackupFile {
  name: string;
  path: string;
  bytes: number;
  /** Ortszeit als 'YYYY-MM-TT HH:MM'. */
  savedAt: string;
}

/**
 * Der Zustand der Datei selbst — nicht ihres Inhalts. Wo sie liegt, steht
 * daneben in `Snapshot.dbPath` und nicht noch einmal hier.
 */
export interface DbFile {
  bytes: number;
  savedAt: string;
  backupDir: string;
  /** Neueste zuerst. */
  backups: BackupFile[];
  /** Ob vor größeren Änderungen von selbst gesichert wird. */
  auto: boolean;
  /** So viele selbsttätige Backups bleiben liegen. */
  autoKeep: number;
}

export interface Snapshot {
  /** Wo die Datei liegt — die Einstellungen zeigen es an. */
  dbPath: string;
  db: DbFile;
  seasons: Season[];
  /** Aktive Saison, ersatzweise die neueste. Null nur bei leerer Datenbank. */
  season: Season | null;
  /** Alle Bauern, auch archivierte; was angezeigt wird, entscheidet die Ansicht. */
  farmers: Farmer[];
  cows: Cow[];
  herd: HerdCow[];
  cowSeasons: CowSeason[];
  /** Die Zugehörigkeit über alle Saisons — für die Übernahme in eine neue. */
  seasonCows: SeasonCow[];
  rounds: MeasurementRound[];
  values: MeasurementValue[];
  treatmentTypes: TreatmentType[];
  treatments: Treatment[];
  production: CheeseProduction[];
  /** Neueste zuerst. */
  alpCheese: AlpCheese[];
  pickups: Pickup[];
}

/**
 * Antwort einer Änderung: der frische Stand, dazu die Kennung eines neu
 * angelegten Eintrags, falls die Maske gleich dorthin springen will.
 *
 * `notice` bleibt leer, wo das Ergebnis schon auf dem Bildschirm steht. Wer
 * ein Backup schreibt, sieht davon aber nichts — dort steht dann, wohin.
 */
export interface CommandResult {
  snapshot: Snapshot;
  insertedId: number | null;
  notice: string | null;
}

/**
 * Die Freigabe im Heimnetz — dieselbe Oberfläche auf dem Telefon.
 *
 * `port` ist `0`, wo es die Freigabe gar nicht geben kann: im Browser beim
 * Entwickeln und auf dem Telefon selbst. Das `qr` ist der QR-Code als Feld aus
 * Wahrheitswerten, zeilenweise und ohne Rand — gezeichnet wird er hier.
 */
export interface Hosting {
  active: boolean;
  port: number;
  url: string | null;
  qr: boolean[][] | null;
  trouble: string | null;
}
