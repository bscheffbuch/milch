"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { inTauri } from "@/lib/data/client";

import type { Update as UpdateInfo } from "@tauri-apps/plugin-updater";

/*
  Das Update des Programms
  ========================

  Beim Start wird beim Repositorium nachgefragt, ob dort eine höhere Version
  liegt. Gibt es eine, erscheint unten links eine Karte, die sie anbietet.

  Gibt es keine, erscheint nichts. Das ist Absicht und dieselbe Regel wie bei
  den Abzeichen der Navigation: gemeldet wird, was eine Entscheidung verlangt,
  und ein Programm auf dem neuesten Stand verlangt keine.

  Aus demselben Grund ist die Prüfung beim Start stumm. Wer das Programm
  öffnet, wartet auf die Saison und nicht auf eine Auskunft über GitHub — ist
  kein Netz da, geht das niemanden etwas an. Erst wenn jemand selbst auf
  „Jetzt einspielen“ gedrückt hat und *das* scheitert, steht eine Meldung da,
  denn dann wartet jemand auf ein Ergebnis.

  Die Prüfung läuft nur im Programmfenster. Im Browser — beim Entwickeln und
  über die Freigabe im Heimnetz — gibt es weder Tauris IPC noch etwas zu
  aktualisieren; dort bliebe nur ein Fehler über eine fehlende Brücke übrig.

  Warum das eine Signatur braucht und warum macOS und Windows beim ersten
  Öffnen trotzdem warnen, steht in `docs/updates.md`.
*/

/**
 * Wo eine übersprungene Version abgelegt wird.
 *
 * Wer „Überspringen“ gedrückt hat, soll für genau diese Nummer nie wieder
 * gefragt werden — bei der nächsten, höheren meldet sich die Karte wieder.
 * Deshalb steht die Versionsnummer darin und nicht bloß ein Schalter.
 */
const UEBERSPRUNGEN = "milch.update.skipped";

type Zustand =
  | { art: "still" }
  | { art: "gefunden"; update: UpdateInfo }
  | { art: "laedt"; update: UpdateInfo; geladen: number; gesamt: number | null }
  | { art: "bereit" }
  | { art: "neustart" }
  | { art: "fehler"; meldung: string };

/** Bytes als Megabyte, eine Nachkommastelle — mehr sagt beim Laden nichts. */
function megabyte(bytes: number): string {
  return (bytes / 1_000_000).toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

export default function Update() {
  const [zustand, setZustand] = useState<Zustand>({ art: "still" });

  // Beim Entwickeln läuft jeder Effekt zweimal. Ohne diese Sperre ginge auch
  // die Abfrage zweimal hinaus.
  const geprueft = useRef(false);

  useEffect(() => {
    if (!inTauri() || geprueft.current) return;
    geprueft.current = true;

    let weg = false;

    void (async () => {
      try {
        const { check } = await import("@tauri-apps/plugin-updater");
        const update = await check();
        if (!update || weg) return;
        if (window.localStorage.getItem(UEBERSPRUNGEN) === update.version)
          return;
        setZustand({ art: "gefunden", update });
      } catch (fehler) {
        // Siehe oben: beim Start wird nicht gemeldet, was niemand angestoßen hat.
        console.warn("Das Update ließ sich nicht prüfen:", fehler);
      }
    })();

    return () => {
      weg = true;
    };
  }, []);

  const einspielen = useCallback(async (update: UpdateInfo) => {
    setZustand({ art: "laedt", update, geladen: 0, gesamt: null });

    try {
      let geladen = 0;
      let gesamt: number | null = null;

      await update.downloadAndInstall((schritt) => {
        // Gezählt werden nur wirklich übertragene Bytes. Nennt die Gegenstelle
        // keine Gesamtgröße, bleibt der Balken unbestimmt — ein erfundener
        // Prozentsatz wäre schlimmer als gar keiner.
        if (schritt.event === "Started") {
          gesamt = schritt.data.contentLength ?? null;
        } else if (schritt.event === "Progress") {
          geladen += schritt.data.chunkLength;
        }
        setZustand({ art: "laedt", update, geladen, gesamt });
      });

      setZustand({ art: "bereit" });
    } catch (fehler) {
      setZustand({
        art: "fehler",
        meldung: fehler instanceof Error ? fehler.message : String(fehler),
      });
      return;
    }

    /*
      Der Neustart steht mit Absicht außerhalb des Blocks darüber: hier ist
      die neue Version bereits eingespielt. Scheiterte nur noch das Neustarten
      und stünde dann „fehlgeschlagen“ da, wäre das schlicht falsch — es fehlt
      dann bloß der letzte Schritt, und den kann jeder selbst tun.

      Auf Windows übernimmt ab hier ohnehin das Installationsprogramm und
      beendet das laufende Programm selbst; der Aufruf kommt dort unter
      Umständen gar nicht mehr an.
    */
    try {
      const { relaunch } = await import("@tauri-apps/plugin-process");
      await relaunch();
    } catch (fehler) {
      console.warn("Der Neustart nach dem Update ging nicht:", fehler);
      setZustand({ art: "neustart" });
    }
  }, []);

  if (zustand.art === "still") return null;

  if (zustand.art === "fehler") {
    return (
      <div className="update update-error no-print" role="alert">
        <div className="stack-sm">
          <b>Das Update ist fehlgeschlagen</b>
          <span className="small">{zustand.meldung}</span>
        </div>
        <button
          className="btn-quiet btn-sm"
          onClick={() => setZustand({ art: "still" })}
          type="button"
        >
          Schließen
        </button>
      </div>
    );
  }

  // Eingespielt ist die neue Version bereits, es fehlt nur der Neustart. Das
  // ist kein Fehlschlag und trägt deshalb auch nicht dessen Ton.
  if (zustand.art === "neustart") {
    return (
      <div className="update no-print" role="status">
        <div className="stack-sm">
          <b>Das Update ist eingespielt</b>
          <span className="small muted">
            Bitte das Programm einmal schließen und wieder öffnen — dann läuft
            die neue Version.
          </span>
        </div>
      </div>
    );
  }

  if (zustand.art === "laedt" || zustand.art === "bereit") {
    const gesamt = zustand.art === "laedt" ? zustand.gesamt : null;
    const geladen = zustand.art === "laedt" ? zustand.geladen : 0;
    const anteil = gesamt ? Math.min(geladen / gesamt, 1) : null;

    return (
      <div className="update no-print" role="status">
        <div className="stack-sm">
          <b>
            {zustand.art === "bereit"
              ? "Der Neustart wird vorbereitet"
              : `Version ${zustand.update.version} wird geladen`}
          </b>
          <div
            className="update-bar"
            role="progressbar"
            aria-label="Fortschritt des Updates"
            aria-valuemin={0}
            aria-valuemax={100}
            /*
              Ohne bekannte Gesamtgröße bleibt der Wert weg. Die Bedienungshilfe
              sagt dann „unbestimmt“, und das ist die Wahrheit — eine Zahl
              stünde hier nur, weil das Feld eine erwartet.
            */
            aria-valuenow={
              anteil === null ? undefined : Math.round(anteil * 100)
            }
          >
            <div
              className={anteil === null ? "update-run" : "update-fill"}
              style={
                anteil === null ? undefined : { width: `${anteil * 100}%` }
              }
            />
          </div>
          {zustand.art === "laedt" && (
            <span className="small muted num">
              {megabyte(geladen)}
              {gesamt ? ` von ${megabyte(gesamt)}` : ""} MB
            </span>
          )}
        </div>
      </div>
    );
  }

  const { update } = zustand;

  return (
    <div className="update no-print" role="status">
      <div className="stack-sm">
        <b>Version {update.version} steht bereit</b>
        {update.body && (
          <span className="small muted update-text">{update.body}</span>
        )}
        <div className="row">
          <button
            className="btn-sm btn-primary"
            onClick={() => void einspielen(update)}
            type="button"
          >
            Jetzt einspielen
          </button>
          <button
            className="btn-quiet btn-sm"
            onClick={() => setZustand({ art: "still" })}
            type="button"
          >
            Später
          </button>
          <button
            className="btn-quiet btn-sm"
            onClick={() => {
              window.localStorage.setItem(UEBERSPRUNGEN, update.version);
              setZustand({ art: "still" });
            }}
            type="button"
          >
            Überspringen
          </button>
        </div>
      </div>
    </div>
  );
}
