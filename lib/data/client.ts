import type { CommandResult, Hosting } from "./types";

/*
  Der Draht zur Datenschicht
  ==========================

  Es gibt genau einen Aufruf: einen benannten Auftrag mit einer Nutzlast
  hinschicken, den vollständigen Stand zurückbekommen. Wo die Datenschicht
  läuft, ist von hier aus die einzige Unterscheidung:

    im fertigen Programm — im selben Prozess, über Tauris IPC;
    beim Entwickeln       — derselbe Rust-Dienst, nur über einen Port,
                            weil ein gewöhnlicher Browser kein IPC hat;
    auf dem Telefon       — dieselbe gebaute Oberfläche, ausgeliefert von der
                            Freigabe im Heimnetz, also unter derselben Adresse,
                            unter der auch die Seite selbst herkam.

  Alle drei Wege enden in derselben Rust-Funktion. Es gibt keine zweite
  Datenschicht in JavaScript, die auseinanderlaufen könnte.

  Die letzten beiden lassen sich am Bau auseinanderhalten: eine gebaute
  Oberfläche außerhalb des Programmfensters kann nur von der Freigabe kommen,
  und die liefert `/call` unter ihrer eigenen Adresse mit.
*/

const DEV_ENDPOINT = "http://127.0.0.1:8787/call";

export function inTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function endpoint(): string {
  // Ein Skript im Terminal hat kein Fenster, aus dem es eine Adresse nehmen
  // könnte — es redet mit demselben Entwicklungsdienst wie die Oberfläche
  // beim Entwickeln.
  if (typeof window === "undefined") return DEV_ENDPOINT;
  if (process.env.NODE_ENV === "development") return DEV_ENDPOINT;
  return `${window.location.origin}/call`;
}

/** Die Freigabe im Heimnetz. Sie gibt es nur im Programmfenster selbst. */
export async function host(action: "status" | "start" | "stop"): Promise<Hosting> {
  if (!inTauri()) {
    return { active: false, port: 0, url: null, qr: null, trouble: null };
  }
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<Hosting>("host", { action });
}

export async function call(
  name: string,
  payload: Record<string, unknown> = {},
): Promise<CommandResult> {
  if (inTauri()) {
    const { invoke } = await import("@tauri-apps/api/core");
    return invoke<CommandResult>("run", { name, payload });
  }

  const where = endpoint();
  let response: Response;
  try {
    response = await fetch(where, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, payload }),
    });
  } catch {
    throw new Error(
      where === DEV_ENDPOINT
        ? `Die Datenschicht antwortet nicht. Läuft sie? — npm run data (${DEV_ENDPOINT})`
        : "Der Rechner antwortet nicht. Läuft dort das Programm noch, und ist die Freigabe eingeschaltet?",
    );
  }

  const body = (await response.json()) as
    { ok: true; data: CommandResult } | { ok: false; error: string };

  if (!body.ok) throw new Error(body.error);
  return body.data;
}
