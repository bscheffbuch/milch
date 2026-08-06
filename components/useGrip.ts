"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject } from "react";

import type { DockMode } from "@/lib/collapse";

/*
  Andocken und Losreißen
  ======================

  Jede Fläche in der rechten Ablage steht entweder dort in der Reihe oder
  schwebt frei über der Seite. Gewechselt wird durch Ziehen am Kopf — von der
  Kante weg löst sich die Fläche, zurück an die Kante rastet sie wieder ein. Der
  Wechsel ist eine einzige Bewegung: dieselbe Fläche wandert und ändert dabei
  ihre Form, sie verschwindet nicht und erscheint neu.

  Der Griff weiß nichts davon, was in der Fläche steht oder wo ihr Zustand
  liegt; er kennt nur das Element und zwei Setzer. Deshalb genügt ein einziger
  für alle Flächen.
*/

export interface Spot {
  x: number;
  y: number;
}

/** Wie weit man von der Kante wegziehen muss, damit sich die Fläche löst. */
const TEAR_OFF = 36;
/** Wie nah an der Kante sie wieder einrastet. */
export const DOCK_ZONE = 64;
const MORPH_MS = 260;
const EASE = "cubic-bezier(0.22, 0.61, 0.36, 1)";

function reducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export interface Grip {
  /** Gehört an den Kopf der Fläche — hier wird angefasst. */
  grab: (event: ReactPointerEvent<HTMLElement>) => void;
  /** Beim Ziehen wahr, solange Loslassen die Fläche andocken würde. */
  docking: boolean;
  /** Schaltet ohne Ziehen um, für die Schaltfläche im Kopf. */
  flip: () => void;
}

export function useGrip({
  node,
  mode,
  setMode,
  setSpot,
}: {
  node: RefObject<HTMLElement | null>;
  mode: DockMode;
  setMode: (mode: DockMode, spot?: Spot) => void;
  setSpot: (spot: Spot) => void;
}): Grip {
  const before = useRef<DOMRect | null>(null);
  const [docking, setDocking] = useState(false);
  /** Beendet einen laufenden Zug — von ihm selbst oder beim Ausbau der Fläche. */
  const release = useRef<(() => void) | null>(null);

  /*
    Der Formwechsel wird nachträglich animiert: die alte Lage steht schon fest,
    die neue ergibt sich aus dem Layout. Dazwischen läuft eine einzige
    Bewegung — verschieben und Form ändern in einem Zug.
  */
  useLayoutEffect(() => {
    const el = node.current;
    const from = before.current;
    before.current = null;
    if (!el || !from || reducedMotion()) return;

    const to = el.getBoundingClientRect();
    const dx = from.left - to.left;
    const dy = from.top - to.top;
    if (!dx && !dy && from.width === to.width && from.height === to.height) return;

    el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px)`,
          width: `${from.width}px`,
          height: `${from.height}px`,
        },
        {
          transform: "translate(0, 0)",
          width: `${to.width}px`,
          height: `${to.height}px`,
        },
      ],
      { duration: MORPH_MS, easing: EASE },
    );
  }, [mode, node]);

  // Wird die Fläche mitten im Zug ausgebaut, bleibt kein Zuhörer am Fenster.
  useEffect(() => () => release.current?.(), []);

  /*
    Ein Zug ist eine abgeschlossene Sache: was er wissen muss, steht in seinen
    eigenen Veränderlichen, und die Zuhörer am Fenster leben nur so lange wie er.
    Dass `willDock` hier eine gewöhnliche Variable ist und kein Zustand, ist
    wesentlich — beim Loslassen zählt die Lage von eben, und ein Zustand hinkt
    einer schnellen Bewegung um einen Anstrich hinterher.
  */
  const grab = (event: ReactPointerEvent<HTMLElement>) => {
    const el = node.current;
    if (!el || event.button !== 0) return;
    // Ging ein Loslassen verloren, endet der alte Zug hier — er darf nicht
    // neben dem neuen weiterlaufen.
    release.current?.();

    const box = el.getBoundingClientRect();
    const dx = event.clientX - box.left;
    const dy = event.clientY - box.top;
    const fromX = event.clientX;
    let floating = mode === "window";
    let willDock = false;

    const move = (moved: PointerEvent) => {
      if (!floating) {
        // Erst wenn spürbar von der Kante weggezogen wird, löst sich die Fläche.
        if (fromX - moved.clientX < TEAR_OFF) return;
        before.current = el.getBoundingClientRect();
        setMode("window", { x: moved.clientX - dx, y: moved.clientY - dy });
        floating = true;
        return;
      }

      const x = moved.clientX - dx;
      const y = moved.clientY - dy;
      const width = el.offsetWidth;
      setSpot({
        x: Math.min(Math.max(x, 8 - width + 120), window.innerWidth - 120),
        y: Math.min(Math.max(y, 8), window.innerHeight - 44),
      });
      willDock = window.innerWidth - (x + width) < DOCK_ZONE;
      setDocking(willDock);
    };

    const up = () => {
      release.current?.();
      if (willDock) {
        before.current = el.getBoundingClientRect();
        setMode("drawer");
      }
      setDocking(false);
    };

    release.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      release.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };

  const flip = () => {
    const el = node.current;
    if (el) before.current = el.getBoundingClientRect();
    if (mode === "window") {
      setMode("drawer");
      return;
    }
    const box = el?.getBoundingClientRect();
    // Deutlich weg von der Kante — sonst zeigt schon die erste Mausbewegung
    // den Andockstreifen, obwohl niemand andocken wollte.
    setMode("window", {
      x: Math.max(24, (box?.left ?? window.innerWidth - 380) - DOCK_ZONE * 2),
      y: Math.max(24, Math.round(window.innerHeight * 0.16)),
    });
  };

  return { grab, docking, flip };
}
