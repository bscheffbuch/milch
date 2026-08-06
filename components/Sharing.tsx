"use client";

import { useEffect, useState } from "react";

import { host } from "@/lib/data/client";
import type { Hosting } from "@/lib/data/types";

/*
  Freigabe im Heimnetz
  ====================

  Auf dem Tisch steht der Rechner, in der Hand das Telefon. Solange die
  Freigabe läuft, liefert das Programm dieselbe Oberfläche zusätzlich über das
  Netz aus — kein Konto, keine Wolke, kein zweiter Datenbestand. Der QR-Code
  spart das Abtippen von vier Zahlen und einem Doppelpunkt.

  Sie ist aus, bis jemand sie einschaltet, und sie endet mit dem Programm.
  Es gibt kein Kennwort: wer im selben Netz ist, darf alles. Das steht deshalb
  auch so da und nicht kleingedruckt.
*/

/** Der Rand gehört zum QR-Code: ohne ihn findet ihn die Kamera nicht. */
const QUIET = 4;

export default function Sharing() {
  const [state, setState] = useState<Hosting | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    host("status").then(
      (status) => {
        if (alive) setState(status);
      },
      (reason: unknown) => {
        if (alive) setError(String(reason));
      },
    );
    return () => {
      alive = false;
    };
  }, []);

  async function toggle(action: "start" | "stop") {
    setBusy(true);
    setError(null);
    try {
      setState(await host(action));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  // Im Browser und auf dem Telefon selbst gibt es nichts freizugeben — dort
  // läuft das Programm ja gar nicht.
  if (state === null || state.port === 0) return null;

  return (
    <div className="card">
      <div className="card-head card-head-action">
        <div>
          <h2>Im Heimnetz freigeben</h2>
          <p>
            Dieselbe Oberfläche auf dem Telefon — im Stall eintragen, was am Schreibtisch
            zusammengerechnet wird. Der Rechner muss dabei laufen.
          </p>
        </div>
        <button
          className={state.active ? "btn" : "btn-primary"}
          disabled={busy}
          onClick={() => toggle(state.active ? "stop" : "start")}
          type="button"
        >
          {busy ? "Einen Augenblick …" : state.active ? "Freigabe beenden" : "Freigeben"}
        </button>
      </div>

      {error ? <p className="notice notice-blocked">{error}</p> : null}

      {state.active && state.url ? (
        <div className="share">
          {state.qr ? <Qr matrix={state.qr} url={state.url} /> : null}
          <div className="stack-sm">
            <p className="num share-url">{state.url}</p>
            <p className="small faint">
              Mit der Kamera des Telefons auf das Muster halten — oder die Adresse im
              Browser eintippen. Telefon und Rechner müssen im selben Netz sein, also am
              selben WLAN.
            </p>
            <p className="notice notice-blocked">
              Solange die Freigabe läuft, kann jeder im selben Netz alles sehen und ändern.
              Es gibt kein Kennwort. In einem fremden WLAN also besser wieder beenden.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/**
 * Der QR-Code als ein einziger Pfad — ein Rechteck je Kästchen wären tausend
 * Elemente für ein Bild, das sich nie bewegt.
 *
 * Er bleibt in beiden Anstrichen dunkel auf hell. Das ist die einzige Fläche
 * im Programm, die sich nicht umfärben lässt: umgekehrt lesen ihn nicht alle
 * Kameras.
 */
function Qr({ matrix, url }: { matrix: boolean[][]; url: string }) {
  const size = matrix.length + QUIET * 2;
  let d = "";
  matrix.forEach((row, y) => {
    row.forEach((dark, x) => {
      if (dark) d += `M${x + QUIET} ${y + QUIET}h1v1h-1z`;
    });
  });

  return (
    <svg
      aria-label={`QR-Code für ${url}`}
      className="qr"
      role="img"
      viewBox={`0 0 ${size} ${size}`}
    >
      <rect width={size} height={size} fill="#fff" />
      <path d={d} fill="#111" />
    </svg>
  );
}
