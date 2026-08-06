"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { buildSeasonView, type SeasonView } from "@/lib/view";

import { call } from "./client";
import type { Snapshot } from "./types";

/*
  Ein Stand für das ganze Fenster
  ===============================

  Die Datenschicht liefert die Saison in einem Stück. Daraus rechnet diese
  Stelle die vollständige Auswertung — einmal, nicht einmal je Seite — und
  reicht sie weiter. Jede Änderung geht denselben Weg zurück: Auftrag hin,
  neuer Stand her, Auswertung neu. Es gibt keinen Teilstand, der veralten
  könnte, und keine Stelle, an der man das Nachladen vergessen kann.
*/

interface Data {
  /** Der rohe Stand — gebraucht, wo es noch keine Saison gibt. */
  snapshot: Snapshot;
  view: SeasonView | null;
  /** Zahl der noch laufenden Aufträge — die Oberfläche fühlt sich damit ruhig an. */
  busy: number;
  error: string | null;
  clearError: () => void;
  /** Gelungenes, das man sonst nicht sähe: wohin gesichert, was ersetzt wurde. */
  notice: string | null;
  clearNotice: () => void;
  run: (name: string, payload?: Record<string, unknown>) => Promise<number | null>;
}

const DataContext = createContext<Data | null>(null);

export function DataProvider({ children }: { children: React.ReactNode }) {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const started = useRef(false);

  useEffect(() => {
    // Im Entwicklungsmodus läuft der Effekt zweimal; der zweite Lauf würde nur
    // dieselbe Antwort noch einmal holen.
    if (started.current) return;
    started.current = true;

    setBusy((count) => count + 1);
    call("snapshot")
      .then((result) => setSnapshot(result.snapshot))
      .catch((cause: unknown) => setError(messageOf(cause)))
      .finally(() => setBusy((count) => count - 1));
  }, []);

  const run = useCallback(async (name: string, payload: Record<string, unknown> = {}) => {
    setBusy((count) => count + 1);
    try {
      const result = await call(name, payload);
      setSnapshot(result.snapshot);
      setError(null);
      setNotice(result.notice);
      return result.insertedId;
    } catch (cause: unknown) {
      setError(messageOf(cause));
      setNotice(null);
      return null;
    } finally {
      setBusy((count) => count - 1);
    }
  }, []);

  const view = useMemo(() => (snapshot ? buildSeasonView(snapshot) : null), [snapshot]);

  const value = useMemo<Data | null>(
    () =>
      snapshot
        ? {
            snapshot,
            view,
            busy,
            error,
            clearError: () => setError(null),
            notice,
            clearNotice: () => setNotice(null),
            run,
          }
        : null,
    [snapshot, view, busy, error, notice, run],
  );

  // Ohne Stand gibt es nichts zu zeigen — auch nicht die Navigation, die
  // Saisonname und Abzeichen daraus nimmt.
  if (!value) {
    return (
      <div className="boot">
        <p>{error ?? "Daten werden geladen …"}</p>
        {error ? (
          <button className="btn" onClick={() => location.reload()} type="button">
            Noch einmal versuchen
          </button>
        ) : null}
      </div>
    );
  }

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData(): Data {
  const data = useContext(DataContext);
  if (!data) throw new Error("useData außerhalb von DataProvider");
  return data;
}

/** Die fertige Auswertung der laufenden Saison. Null heißt: keine Saison angelegt. */
export function useSeasonView(): SeasonView | null {
  return useData().view;
}

function messageOf(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}
