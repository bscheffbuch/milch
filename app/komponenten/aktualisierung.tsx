"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { isTauri } from "@tauri-apps/api/core";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";

import stile from "./aktualisierung.module.css";

/**
 * Schlüssel im `localStorage`, unter dem eine bewußt übersprungene Version
 * abgelegt wird. Wer einmal auf „Diese Version überspringen" geklickt hat,
 * soll für genau diese Versionsnummer nie wieder gefragt werden — bei der
 * nächsten, höheren Version meldet sich das Fenster aber wieder.
 */
const SCHLUESSEL_UEBERSPRUNGEN = "milch.aktualisierung.uebersprungen";

type Zustand =
  | { art: "ruhig" }
  | { art: "gefunden"; update: Update }
  | { art: "laedt"; update: Update; geladen: number; gesamt: number | null }
  | { art: "bereit"; update: Update }
  | { art: "neustartNoetig" }
  | { art: "fehler"; meldung: string };

/** Rechnet Bytes in eine kurze, lesbare Angabe in Megabyte um. */
function alsMegabyte(bytes: number): string {
  return (bytes / 1_000_000).toLocaleString("de-CH", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  });
}

/**
 * Prüft beim Start, ob im GitHub-Repository eine neuere Version liegt, und
 * bietet sie zum Einspielen an.
 *
 * Bewußt gibt es hier keine Rückmeldung „Du bist auf dem neuesten Stand" —
 * ein funktionierender Normalzustand braucht keine Anzeige, gemeldet wird nur,
 * was eine Entscheidung verlangt. Aus demselben Grund läuft die Prüfung still
 * im Hintergrund: schlägt sie fehl (kein Netz, GitHub nicht erreichbar), sieht
 * der Benutzer beim Start nichts davon. Erst wenn er selbst eine
 * Aktualisierung angestoßen hat und *die* scheitert, wird ein Fehler gezeigt,
 * denn dann wartet er auf ein Ergebnis.
 */
export default function Aktualisierung() {
  const [zustand, setZustand] = useState<Zustand>({ art: "ruhig" });

  // Verhindert, daß die Prüfung im Entwicklungsmodus durch React StrictMode
  // zweimal läuft und dadurch zwei Abfragen an GitHub schickt.
  const bereitsGeprueft = useRef(false);

  useEffect(() => {
    // Im Browser (`npm run dev` ohne Tauri, oder ein späterer Web-Build) gibt
    // es die Tauri-Schnittstelle nicht. Ohne diese Abfrage würde `check()`
    // dort mit einem unverständlichen Fehler über die fehlende IPC-Brücke
    // abbrechen.
    if (!isTauri() || bereitsGeprueft.current) return;
    bereitsGeprueft.current = true;

    let abgebrochen = false;

    void (async () => {
      try {
        const update = await check();
        if (!update || abgebrochen) return;

        if (window.localStorage.getItem(SCHLUESSEL_UEBERSPRUNGEN) === update.version) {
          return;
        }

        setZustand({ art: "gefunden", update });
      } catch (fehler) {
        // Siehe Kommentar am Kopf der Komponente: die Prüfung beim Start ist
        // nicht das, worauf der Benutzer gerade wartet, also bleibt sie still.
        console.warn("Aktualisierungsprüfung fehlgeschlagen:", fehler);
      }
    })();

    return () => {
      abgebrochen = true;
    };
  }, []);

  const installieren = useCallback(async (update: Update) => {
    setZustand({ art: "laedt", update, geladen: 0, gesamt: null });

    try {
      let geladen = 0;
      let gesamt: number | null = null;

      await update.downloadAndInstall((ereignis) => {
        // Der Fortschritt zeigt ausschließlich tatsächlich übertragene Bytes.
        // Liefert der Server keine Gesamtgröße, bleibt der Balken bewußt
        // unbestimmt, statt einen erfundenen Prozentwert anzuzeigen.
        if (ereignis.event === "Started") {
          gesamt = ereignis.data.contentLength ?? null;
        } else if (ereignis.event === "Progress") {
          geladen += ereignis.data.chunkLength;
        }
        setZustand({ art: "laedt", update, geladen, gesamt });
      });

      setZustand({ art: "bereit", update });
    } catch (fehler) {
      setZustand({
        art: "fehler",
        meldung: fehler instanceof Error ? fehler.message : String(fehler),
      });
      return;
    }

    // Der Neustart steht bewusst ausserhalb des obigen `try`: an dieser Stelle
    // ist die neue Fassung bereits eingespielt. Scheitert nur noch das
    // Neustarten, wäre die Meldung „Aktualisierung fehlgeschlagen" schlicht
    // falsch — dann fehlt bloss der letzte Schritt, den der Benutzer selbst
    // erledigen kann.
    //
    // Unter Windows übernimmt ab hier ohnehin der NSIS-Installer und beendet
    // die laufende Anwendung selbst; `relaunch()` kommt dort unter Umständen
    // gar nicht mehr zum Zug. Unter macOS und Linux ist der Neustart nötig,
    // damit das soeben ausgetauschte Paket geladen wird.
    try {
      await relaunch();
    } catch (fehler) {
      console.warn("Neustart nach der Aktualisierung fehlgeschlagen:", fehler);
      setZustand({ art: "neustartNoetig" });
    }
  }, []);

  if (zustand.art === "ruhig") return null;

  if (zustand.art === "neustartNoetig") {
    // Kein Fehlerzustand: eingespielt ist die neue Fassung bereits, es fehlt
    // nur der Neustart. Deshalb die gewöhnliche Karte und nicht die rote.
    return (
      <aside className={stile.karte} aria-live="polite">
        <p className={stile.titel}>Aktualisierung eingespielt</p>
        <p className={stile.text}>
          Bitte die Anwendung beenden und neu starten, damit die neue Fassung
          geladen wird.
        </p>
      </aside>
    );
  }

  if (zustand.art === "fehler") {
    return (
      <aside className={stile.karte} role="alert">
        <p className={stile.titel}>Aktualisierung fehlgeschlagen</p>
        <p className={stile.text}>{zustand.meldung}</p>
        <div className={stile.knopfreihe}>
          <button
            type="button"
            className={stile.knopf}
            onClick={() => setZustand({ art: "ruhig" })}
          >
            Schliessen
          </button>
        </div>
      </aside>
    );
  }

  if (zustand.art === "laedt" || zustand.art === "bereit") {
    const gesamt = zustand.art === "laedt" ? zustand.gesamt : null;
    const geladen = zustand.art === "laedt" ? zustand.geladen : 0;
    const anteil = gesamt ? Math.min(geladen / gesamt, 1) : null;

    return (
      <aside className={stile.karte} aria-live="polite">
        <p className={stile.titel}>
          {zustand.art === "bereit"
            ? "Neustart wird vorbereitet"
            : `Version ${zustand.update.version} wird geladen`}
        </p>
        <div
          className={stile.balken}
          role="progressbar"
          aria-label="Fortschritt der Aktualisierung"
          aria-valuemin={0}
          aria-valuemax={100}
          // Ohne bekannte Gesamtgröße bleibt `aria-valuenow` weg — so meldet
          // die Bedienungshilfe ehrlich „unbestimmt" statt einer Zahl, die
          // niemand kennt.
          aria-valuenow={anteil === null ? undefined : Math.round(anteil * 100)}
        >
          <div
            className={anteil === null ? stile.fuellungUnbestimmt : stile.fuellung}
            style={anteil === null ? undefined : { width: `${anteil * 100}%` }}
          />
        </div>
        {zustand.art === "laedt" && (
          <p className={stile.text}>
            {alsMegabyte(geladen)}
            {gesamt ? ` von ${alsMegabyte(gesamt)}` : ""} MB
          </p>
        )}
      </aside>
    );
  }

  const { update } = zustand;

  return (
    <aside className={stile.karte} aria-live="polite">
      <p className={stile.titel}>Version {update.version} ist verfügbar</p>
      {update.body && <p className={stile.text}>{update.body}</p>}
      <div className={stile.knopfreihe}>
        <button
          type="button"
          className={`${stile.knopf} ${stile.knopfBetont}`}
          onClick={() => void installieren(update)}
        >
          Jetzt installieren
        </button>
        <button
          type="button"
          className={stile.knopf}
          onClick={() => setZustand({ art: "ruhig" })}
        >
          Später
        </button>
        <button
          type="button"
          className={stile.knopf}
          onClick={() => {
            window.localStorage.setItem(SCHLUESSEL_UEBERSPRUNGEN, update.version);
            setZustand({ art: "ruhig" });
          }}
        >
          Überspringen
        </button>
      </div>
    </aside>
  );
}
