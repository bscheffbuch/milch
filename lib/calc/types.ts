import type { Slot } from "@/lib/gemelk";

export interface GemelkRef {
  date: string;
  slot: Slot;
}

/**
 * Eine Messung besteht aus zwei aufeinanderfolgenden Gemelken — entweder
 * morgens+abends desselben Tages oder abends+morgens des Folgetages. Beides
 * ergibt eine volle 24-Stunden-Menge.
 *
 * `first` ist das erste der beiden Gemelke; das zweite ist immer das direkt
 * darauffolgende. Einzelne Werte dürfen fehlen (Kuh nicht gemessen); fehlt
 * genau einer, wird er über das Morgen/Abend-Verhältnis der Herde geschätzt.
 */
export interface CowRound {
  roundId: number;
  first: GemelkRef;
  firstL: number | null;
  secondL: number | null;
}

/**
 * Eine Behandlung sperrt die Milch ab dem Gemelk der Behandlung. Zieht sich
 * die Behandlung über mehrere Gemelke (`end`), läuft die Sperrfrist ab dem
 * letzten Behandlungsgemelk.
 *
 * `withholdGemelke` zählt das letzte Behandlungsgemelk mit: 6 Gemelke ab
 * "10.06. abends" sperren 10.06. abends bis 13.06. morgens; ab 13.06. abends
 * ist die Milch wieder verwertbar.
 */
export interface TreatmentInput {
  treatmentId: number;
  start: GemelkRef;
  /**
   * Letztes Behandlungsgemelk. `null` heißt: die Behandlung läuft noch und ihr
   * Ende steht nicht fest — dann sperrt sie, bis jemand sie beendet.
   */
  end: GemelkRef | null;
  withholdGemelke: number;
  label: string;
}

export interface CowInput {
  cowId: number;
  farmerId: number;
  /** Erstes Gemelk, das auf der Alp gemolken wurde. */
  arrival: GemelkRef;
  /** Letztes gemolkenes Gemelk vor dem Abtrieb, falls die Kuh früher geht. */
  departure?: GemelkRef | null;
  /**
   * Gemelk, nach dem trockengestellt wurde. Dieses Gemelk zählt noch mit —
   * trockengestellt wird nach dem Melken.
   */
  dryOff?: GemelkRef | null;
  rounds: CowRound[];
  treatments: TreatmentInput[];
}

export interface DeductionConfig {
  /** Anteil der Tagesproduktion, der vorab abgezogen wird (0 = aus). */
  percent: number;
  /** Fixe kg, die an einem Produktionstag vorab abgezogen werden. */
  fixedPerDay: number;
}

export interface EngineInput {
  seasonStart: string;
  seasonEnd: string;
  cows: CowInput[];
  /** Tatsächlich produzierte Käsemenge je Tag, in kg. */
  production: Record<string, number>;
  deduction: DeductionConfig;
  /**
   * Anteil des Morgengemelks an der Tagesmenge. Wird normalerweise aus den
   * vollständigen Messungen der Saison berechnet und nur als Rückfallwert
   * gebraucht, wenn es noch keine gibt.
   */
  amShareFallback?: number;
  /**
   * Der Tag, bis zu dem die Saison gelaufen ist — heute, höchstens das
   * Saisonende. Er begrenzt, wie weit eine noch laufende Behandlung sperrt:
   * weiter als bis heute lässt sich über sie nichts sagen. Ohne Angabe sperrt
   * sie bis zum letzten Gemelk der Kuh.
   */
  asOf?: string;
}

/** Gültigkeitsbereich einer Messung auf der Gemelk-Achse. */
export interface RoundSpan {
  roundId: number;
  anchor: number;
  fromIdx: number;
  toIdx: number;
  amL: number;
  pmL: number;
  amEstimated: boolean;
  pmEstimated: boolean;
}

export interface BlockedSpan {
  fromIdx: number;
  toIdx: number;
  /** Das Ende ist kein Ende, sondern der Rand des Bekannten. */
  open: boolean;
  labels: string[];
  treatmentIds: number[];
}

export interface CowDay {
  day: number;
  date: string;
  cowId: number;
  farmerId: number;
  amMilked: boolean;
  pmMilked: boolean;
  amL: number;
  pmL: number;
  amBlocked: boolean;
  pmBlocked: boolean;
  /** Erwartete Menge laut Messung, unabhängig von Sperren. */
  rawL: number;
  /** Verwertbare Menge — fließt in die Käseverteilung ein. */
  usableL: number;
  /** Wegen Behandlung verworfen. */
  blockedL: number;
  estimated: boolean;
}

export interface CowTimeline {
  cowId: number;
  farmerId: number;
  fromIdx: number;
  toIdx: number;
  spans: RoundSpan[];
  blocked: BlockedSpan[];
  days: CowDay[];
  hasMeasurements: boolean;
  totalUsableL: number;
  totalBlockedL: number;
}

export interface FarmerDayShare {
  farmerId: number;
  usableL: number;
  /** Wegen Behandlung verworfen — trägt der Bauer selbst. */
  blockedL: number;
  share: number;
  cheeseKg: number;
}

export interface DayAllocation {
  day: number;
  date: string;
  producedKg: number;
  deductionKg: number;
  netCheeseKg: number;
  totalUsableL: number;
  totalRawL: number;
  totalBlockedL: number;
  cowsMilked: number;
  perFarmer: FarmerDayShare[];
  /** Käse an einem Tag ohne verwertbare Milch — nicht zuordenbar. */
  unallocatedKg: number;
}

export interface FarmerMonthRow {
  farmerId: number;
  usableL: number;
  blockedL: number;
  sharePct: number;
  /** Verbindlich: Summe der tagesgenauen Zuteilungen. */
  cheeseDailyKg: number;
  /** Vergleichswert: Monatskäse × Monatsanteil. */
  cheeseMonthlyKg: number;
}

export interface MonthReport {
  month: string;
  fromDate: string;
  toDate: string;
  days: DayAllocation[];
  producedKg: number;
  deductionKg: number;
  netCheeseKg: number;
  totalUsableL: number;
  totalBlockedL: number;
  unallocatedKg: number;
  perFarmer: FarmerMonthRow[];
}

export interface EngineResult {
  amShare: number;
  timelines: CowTimeline[];
  byDay: Map<string, DayAllocation>;
  months: MonthReport[];
}
