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
import { createPortal, flushSync } from "react-dom";

import { useGrip } from "@/components/useGrip";
import type { Spot } from "@/components/useGrip";
import { type DockMode, readSurface, saveSurface } from "@/lib/collapse";

/*
  Die Ablage am rechten Rand
  ==========================

  Rechts steht genau eine Spalte, und alles, was dorthin gehört, steht in ihr:
  die Tagesspalte des Kalenders ebenso wie jede Erfassungsmaske. Vorher waren
  das zwei Einrichtungen mit je eigener Breite, eigenem Reiter und eigenem
  Gedächtnis — offen nebeneinander nahmen sie zwei Spalten weg und drückten den
  Inhalt in die Mitte. Eine Ablage kennt dieses Problem nicht: mehrere Flächen
  teilen sich die Höhe, nicht die Breite.

  Jede Fläche kann drei Dinge sein:

  • in der Reihe  — sie steht in der Spalte, untereinander mit den anderen;
  • eingeklappt   — sie liegt als Reiter am äußersten Rand und ist mit einem
                    Klick zurück, ihr Inhalt bleibt dabei unangetastet stehen;
  • gelöst        — sie schwebt als Fenster über der Seite und zählt für die
                    Spalte nicht mehr mit.

  Wie breit die Spalte ist, entscheidet allein das Stylesheet anhand zweier
  Attribute am Dokument. So bleibt der Rahmen eine Sache des Layouts, und ein
  Skript im Kopf kann sie vor dem ersten Anstrich richtig setzen.

  Am Telefon steht die Ablage nicht rechts, sondern unten — als Blatt über die
  volle Breite. Eingeklappt heißt dort nicht „als Reiter am Rand“, sondern
  „hingelegt“: das Blatt guckt mit Griffleiste und Kopfzeile aus dem unteren
  Rand hervor und wird mit einem Wisch nach oben aufgezogen. Es sind dieselben
  drei Zustände, nur um eine Vierteldrehung versetzt.
*/

interface Placement {
  mode: DockMode;
  collapsed: boolean;
  /** Am Reiter von Hand gestellt — dann hat die Fläche nichts mehr zu raten. */
  pinned: boolean;
  spot: Spot | null;
  /** Wer zuletzt angefasst wurde, liegt oben. Nur für gelöste Flächen. */
  lift: number;
}

const RESTING: Placement = {
  mode: "drawer",
  collapsed: false,
  pinned: false,
  spot: null,
  lift: 0,
};

/** Versatz, mit dem eine zweite Fläche neben einer schon gelösten landet. */
const CASCADE = 28;

/*
  Bis zu dieser Breite liegt die Ablage unten als Blatt — dieselbe Schwelle wie
  im Stylesheet, und sie muß hier noch einmal stehen: das Ziehen zur Seite, mit
  dem sich eine Fläche am Rechner aus der Spalte löst, hat am Telefon keinen
  Sinn. Dort ist dieselbe Bewegung der Wisch nach oben und unten.
*/
const TELEFON = "(max-width: 560px)";
/** Bis hierher ist eine Bewegung noch ein Tippen und kein Wisch. */
const TIPP = 8;
/** Wie hoch das aufgezogene Blatt steht — dieselben 62vh wie im Stylesheet. */
const BLATT_HOCH = 0.62;
/** Wie lange es nach dem Loslassen an seinen Platz fällt. */
const SETZEN = 200;

/*
  Wie hoch das hingelegte Blatt steht: die Köpfe aller Flächen darin, jeder mit
  seiner Griffleiste, dazu die Haarlinien dazwischen. Gerechnet und nicht
  festgeschrieben, denn die Kopfzeile einer Erfassungsmaske ist höher als die
  der Tagesspalte, und zwei hingelegte Flächen sind zwei Spalte übereinander.

  Ist nichts zu messen — am Rechner steht die Reihe gar nicht da, wenn alles
  weggeklappt ist —, kommt 0 zurück und nicht die Summe der Haarlinien. Eine
  Handvoll Pixel wären eine Antwort, die falsch aussieht wie eine richtige.
*/
function spaltHoehe(blatt: HTMLElement): number {
  const flaechen = [...blatt.querySelectorAll(".dock-surface")];
  let hoch = 0;
  for (const flaeche of flaechen) {
    for (const teil of flaeche.querySelectorAll(".dock-griff, .dock-head")) {
      hoch += teil.getBoundingClientRect().height;
    }
  }
  return hoch > 0 ? hoch + Math.max(0, flaechen.length - 1) : 0;
}

/*
  Zwei Fenster genau übereinander sind eines: das obere verdeckt das untere
  vollständig, und wer das untere sucht, findet es nicht. Beim Lösen rückt die
  Fläche deshalb so weit weiter, bis ihr Kopf frei liegt — der Griff der
  darunterliegenden bleibt sichtbar und greifbar.
*/
function clearSpot(spot: Spot, id: string, places: Record<string, Placement>): Spot {
  const taken = Object.entries(places)
    .filter(([other, place]) => other !== id && place.mode === "window" && place.spot)
    .map(([, place]) => place.spot as Spot);

  let free = spot;
  for (let step = 0; step < 8; step += 1) {
    const busy = taken.some(
      (other) =>
        Math.abs(other.x - free.x) < CASCADE && Math.abs(other.y - free.y) < CASCADE,
    );
    if (!busy) break;
    free = { x: free.x + CASCADE, y: free.y + CASCADE };
  }
  return free;
}

/** Wo eine gelöste Fläche ohne eigene Erinnerung landet: oben rechts, frei. */
function restingSpot(): Spot {
  return {
    x: Math.max(24, window.innerWidth - 388),
    y: Math.max(24, Math.round(window.innerHeight * 0.14)),
  };
}

function topLift(places: Record<string, Placement>): number {
  let top = 0;
  for (const place of Object.values(places)) top = Math.max(top, place.lift);
  return top;
}

interface DockApi {
  /** Reihenfolge des Öffnens — sie bestimmt die Reihenfolge in der Spalte. */
  order: string[];
  open: (id: string) => void;
  close: (id: string) => void;
  placement: (id: string) => Placement;
  setMode: (id: string, mode: DockMode, spot?: Spot) => void;
  setSpot: (id: string, spot: Spot) => void;
  setCollapsed: (id: string, collapsed: boolean) => void;
  /**
   * Der ganze Reihenkasten auf einmal. Am Telefon ist die Ablage ein Blatt und
   * kein Stapel einzeln zu bedienender Flächen: der Wisch zieht auf, was darin
   * steht, und legt auch alles wieder hin. Zöge er nur die angefaßte Fläche,
   * bliebe neben der Tagesspalte eine halb ausgefüllte Erfassungsmaske als
   * Spalt liegen — und das aufgezogene Blatt stünde auf zwei Zuständen.
   */
  setCollapsedAll: (collapsed: boolean) => void;
  /**
   * Wie `setCollapsed`, aber ohne Gedächtnis: die Fläche klappt weg, weil sie
   * gerade nichts zu sagen hat, nicht weil jemand sie weggeklappt hat. Was der
   * Benutzer selbst gewählt hat, darf das nicht überschreiben.
   */
  suggestCollapsed: (id: string, collapsed: boolean) => void;
  /** Holt eine gelöste Fläche nach vorn. */
  raise: (id: string) => void;
  /** Wohin die Flächen und die Reiter gehängt werden. */
  stack: HTMLElement | null;
  rail: HTMLElement | null;
  setMounts: (mounts: { stack: HTMLElement | null; rail: HTMLElement | null }) => void;
}

const DockCtx = createContext<DockApi | null>(null);

function useDock(): DockApi {
  const api = useContext(DockCtx);
  if (!api) throw new Error("Die Ablage braucht einen DockProvider.");
  return api;
}

export function DockProvider({ children }: { children: React.ReactNode }) {
  const [order, setOrder] = useState<string[]>([]);
  const [places, setPlaces] = useState<Record<string, Placement>>({});
  const [mounts, setMounts] = useState<{
    stack: HTMLElement | null;
    rail: HTMLElement | null;
  }>({ stack: null, rail: null });

  /*
    Beim Öffnen holt die Fläche ihre zuletzt gewählte Lage zurück. Gelesen wird
    vor dem Setzen — der Setzer bekommt nur noch fertige Werte, sonst hinge eine
    Nebenwirkung in einem Aufruf, den React auch zweimal ausführen darf.
  */
  const open = useCallback((id: string) => {
    const saved = readSurface(id);
    setPlaces((was) => {
      if (was[id]) return was;
      const place: Placement = { ...RESTING, ...saved, spot: null };
      // Auch eine wiedergeöffnete Fläche bekommt ihren Platz zugeteilt, sonst
      // legte sie sich blind auf die, die schon da liegt.
      if (place.mode === "window") {
        place.spot = clearSpot(restingSpot(), id, was);
        place.lift = topLift(was) + 1;
      }
      return { ...was, [id]: place };
    });
    setOrder((was) => (was.includes(id) ? was : [...was, id]));
  }, []);

  const close = useCallback((id: string) => {
    setOrder((was) => was.filter((other) => other !== id));
  }, []);

  const move = useCallback((id: string, patch: Partial<Placement>) => {
    setPlaces((was) => ({ ...was, [id]: { ...(was[id] ?? RESTING), ...patch } }));
  }, []);

  /*
    Das Lösen braucht den Stand aller Flächen, nicht nur den der eigenen: wohin
    sie kommt, hängt davon ab, wo die anderen schon liegen. Deshalb rechnet es
    im Setzer selbst — dort steht der Stand, wie er im Augenblick des Griffs
    wirklich ist.
  */
  const setMode = useCallback((id: string, mode: DockMode, spot?: Spot) => {
    setPlaces((was) => {
      const place: Placement = { ...(was[id] ?? RESTING), mode };
      if (mode === "window") {
        if (spot) place.spot = clearSpot(spot, id, was);
        place.lift = topLift(was) + 1;
      } else if (spot) {
        place.spot = spot;
      }
      return { ...was, [id]: place };
    });
    saveSurface(id, { mode });
  }, []);

  const setSpot = useCallback((id: string, spot: Spot) => move(id, { spot }), [move]);

  const raise = useCallback((id: string) => {
    setPlaces((was) => {
      const place = was[id];
      if (!place || place.mode !== "window") return was;
      const top = topLift(was);
      if (place.lift === top) return was;
      return { ...was, [id]: { ...place, lift: top + 1 } };
    });
  }, []);

  /*
    Am Reiter gezogen hat immer der Benutzer — und ab da gilt seine Wahl. Die
    Fläche darf danach nicht mehr von selbst auf- oder zuklappen, sonst nähme
    ihre Vermutung dem Handgriff jedes Mal die Wirkung.
  */
  const setCollapsed = useCallback(
    (id: string, collapsed: boolean) => {
      move(id, { collapsed, pinned: true });
      saveSurface(id, { collapsed, pinned: true });
    },
    [move],
  );

  /*
    Welche Flächen es angeht, steht vor dem Setzen fest: gelöste schweben für
    sich und gehören nicht zum Blatt. Gerechnet wird außerhalb des Setzers, denn
    das Merken auf der Platte ist eine Nebenwirkung, und React darf einen Setzer
    zur Prüfung zweimal ausführen.
  */
  const setCollapsedAll = useCallback(
    (collapsed: boolean) => {
      const betroffen = order.filter((id) => (places[id] ?? RESTING).mode !== "window");
      if (betroffen.length === 0) return;
      setPlaces((was) => {
        const next = { ...was };
        for (const id of betroffen) {
          next[id] = { ...(was[id] ?? RESTING), collapsed, pinned: true };
        }
        return next;
      });
      for (const id of betroffen) saveSurface(id, { collapsed, pinned: true });
    },
    [order, places],
  );

  const suggestCollapsed = useCallback(
    (id: string, collapsed: boolean) => move(id, { collapsed }),
    [move],
  );

  /*
    Die Spalte verdeckt nichts: der Rahmen bekommt eine dritte Spalte in ihrer
    Breite, und der Inhalt rückt zusammen. Steht dort nur noch ein Reiter,
    schrumpft sie auf dessen Breite; ist die Ablage leer, verschwindet sie ganz.
  */
  useEffect(() => {
    const root = document.documentElement;
    let inRow = 0;
    let railed = 0;

    for (const id of order) {
      const place = places[id] ?? RESTING;
      if (place.mode === "window") continue;
      if (place.collapsed) railed += 1;
      else inRow += 1;
    }

    if (inRow) root.dataset.dock = "open";
    else if (railed) root.dataset.dock = "rail";
    else delete root.dataset.dock;

    if (railed) root.dataset.dockRail = "";
    else delete root.dataset.dockRail;

    return () => {
      delete root.dataset.dock;
      delete root.dataset.dockRail;
    };
  }, [order, places]);

  /*
    Wie weit das hingelegte Blatt am Telefon heraussteht, weiß nur das Blatt
    selbst: eine Kopfzeile mit Datum darunter ist höher als eine ohne, zwei
    hingelegte Flächen sind zwei Spalte übereinander, und auf einem schmalen
    Schirm bricht ein langer Titel um. Gemessen wird der Spalt und nicht die
    Höhe der Reihe — so steht der Wert auch dann richtig, wenn die Reihe gerade
    aufgezogen ist oder am Finger hängt. Er steht am Dokument, damit der Inhalt
    darüber genau so viel Platz freihält, wie unten wirklich weg ist.
  */
  useEffect(() => {
    const stack = mounts.stack;
    if (!stack) return;
    const root = document.documentElement;
    const messen = () => {
      // Am Finger ändert sich die Höhe in jedem Anstrich; der Spalt tut es nicht.
      if (stack.classList.contains("zieht")) return;
      const hoch = spaltHoehe(stack);
      // Nichts gemessen heißt nichts gesagt — dann gilt der Wert im Stylesheet.
      if (hoch > 0) root.style.setProperty("--blatt-spalt", `${Math.round(hoch)}px`);
      else root.style.removeProperty("--blatt-spalt");
    };

    messen();
    const auge = new ResizeObserver(messen);
    auge.observe(stack);
    return () => {
      auge.disconnect();
      root.style.removeProperty("--blatt-spalt");
    };
  }, [mounts.stack, order, places]);

  const api = useMemo<DockApi>(
    () => ({
      order,
      open,
      close,
      placement: (id: string) => places[id] ?? RESTING,
      setMode,
      setSpot,
      setCollapsed,
      setCollapsedAll,
      suggestCollapsed,
      raise,
      stack: mounts.stack,
      rail: mounts.rail,
      setMounts,
    }),
    [
      order,
      places,
      open,
      close,
      setMode,
      setSpot,
      setCollapsed,
      setCollapsedAll,
      suggestCollapsed,
      raise,
      mounts,
    ],
  );

  return <DockCtx.Provider value={api}>{children}</DockCtx.Provider>;
}

/**
 * Für Flächen, die auf Klick kommen und gehen. Beim erneuten Öffnen steht die
 * Fläche wieder so da, wie man sie verlassen hat — auch als Reiter am Rand.
 */
export function useDockOpen(id: string): { isOpen: boolean; toggle: () => void } {
  const { order, open, close, setCollapsed } = useDock();
  const isOpen = order.includes(id);

  return {
    isOpen,
    toggle: () => {
      if (!isOpen) {
        open(id);
        // Wer sie gerade angefordert hat, will sie sehen, nicht suchen.
        setCollapsed(id, false);
        return;
      }
      close(id);
    },
  };
}

/**
 * Der Ort der Ablage im Rahmen. Er steht einmal, ganz gleich wie viele Flächen
 * offen sind — die Flächen hängen sich hier ein, statt jede für sich am Rand
 * zu kleben.
 */
export function DockRegion() {
  const { setMounts } = useDock();
  const stack = useRef<HTMLDivElement | null>(null);
  const rail = useRef<HTMLDivElement | null>(null);

  // Erst wenn beide stehen, dürfen die Flächen hinein — sonst hinge die erste
  // im Nichts.
  useEffect(() => {
    setMounts({ stack: stack.current, rail: rail.current });
  }, [setMounts]);

  return (
    <div className="dock-col no-print">
      <div className="dock-stack" ref={stack} />
      <div className="dock-rail" ref={rail} />
    </div>
  );
}

/**
 * Eine Fläche in der Ablage. Ihr Inhalt gehört weiter der Seite, die sie
 * aufmacht — gezeigt wird er dort, wo die Ablage steht.
 *
 * `persistent` gilt für Flächen, die mit ihrer Seite kommen und gehen: die
 * Tagesspalte ist nichts, was man erledigt, sondern eine Ansicht. Sie bekommt
 * deshalb kein Kreuz, sondern nur den Reiter — weggeklappt statt geschlossen.
 *
 * `quiet` sagt, dass die Fläche gerade nichts zu zeigen hat. Sie klappt dann
 * von selbst an den Rand und gibt dem Inhalt die Breite zurück — eine Spalte,
 * in der „nichts gewählt“ steht, ist verschenkter Platz.
 */
export function DockSurface({
  id,
  title,
  hint,
  persistent,
  quiet = false,
  children,
}: {
  id: string;
  title: string;
  hint?: string;
  persistent?: boolean;
  quiet?: boolean;
  children: React.ReactNode;
}) {
  const dock = useDock();
  const { open, close, suggestCollapsed } = dock;
  const place = dock.placement(id);
  const shell = useRef<HTMLElement>(null);

  const grip = useGrip({
    node: shell,
    mode: place.mode,
    setMode: (mode, spot) => dock.setMode(id, mode, spot),
    setSpot: (spot) => dock.setSpot(id, spot),
  });

  /*
    Eine Fläche gehört der Seite, die sie aufmacht: wer die Seite verlässt,
    läßt auch die Fläche zurück. Vorher überlebte eine Maske den Seitenwechsel,
    weil nur die Tagesspalte sich beim Ausbau abmeldete — die Ablage hielt ihre
    Spalte dann weiter frei für etwas, das gar nicht mehr da war. Auf der Kuh-
    und der Bauernseite stand so ein breiter leerer Streifen neben der Tabelle,
    ohne Kopf, ohne Kreuz und ohne Reiter, mit dem man ihn wieder losgeworden
    wäre.

    Anmelden und Abmelden stehen deshalb in einer einzigen Wirkung. Für eine
    Maske ist das Anmelden nur eine Bestätigung — geöffnet hat sie der Knopf,
    sonst stünde hier gar nichts —, aber es muß dabeistehen: React führt eine
    Wirkung zur Prüfung zweimal aus, und ein Abmelden ohne Anmelden nähme die
    Fläche beim zweiten Durchgang gleich wieder weg.
  */
  useEffect(() => {
    open(id);
    return () => close(id);
  }, [id, open, close]);

  /*
    Nur der Wechsel zählt, nicht der Zustand: gewirkt wird in dem Augenblick, in
    dem die Fläche verstummt oder wieder etwas zu sagen hat. Wer den Reiter
    zwischendurch selbst aufklappt, behält ihn offen — der nächste Durchlauf
    sieht denselben `quiet` und tut nichts. Und zurückgeklappt wird nur, was
    hier auch weggeklappt wurde; eine von Hand geschlossene Fläche bleibt zu.
  */
  const wasQuiet = useRef(false);
  const byUs = useRef(false);
  useEffect(() => {
    if (quiet === wasQuiet.current) return;
    wasQuiet.current = quiet;
    // Wer den Reiter selbst gestellt hat, hat das letzte Wort.
    if (place.pinned) return;
    if (quiet) {
      byUs.current = !place.collapsed;
      if (byUs.current) suggestCollapsed(id, true);
    } else if (byUs.current) {
      byUs.current = false;
      suggestCollapsed(id, false);
    }
  }, [id, place.collapsed, place.pinned, quiet, suggestCollapsed]);

  useEffect(() => {
    if (persistent) return;
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(id);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [id, persistent, close]);

  /*
    Der Wisch am Telefon
    --------------------
    Dieselbe Stelle, zwei Bewegungen: am Rechner zieht der Kopf die Fläche aus
    der Spalte, am Telefon zieht er das Blatt auf und wieder hin. Welche gilt,
    entscheidet die Breite im Augenblick des Griffs — nicht ein Zustand, der
    beim ersten Anstrich schon feststehen müßte und dann auf dem Server anders
    hieße als im Browser.

    Das Blatt hängt dabei am Finger, es springt nicht auf eine Schwelle hin um:
    gezogen wird die Höhe der Reihe selbst, und weil die Reihe am unteren Rand
    klebt, wandert ihre Oberkante genau so weit wie der Daumen. Losgelassen
    entscheidet die Hälfte der Strecke, wohin es fällt — wer nur ein Stück
    aufzieht und wieder losläßt, hat es nicht aufziehen wollen.

    Erst beim Absetzen bekommt die Ablage den neuen Stand gesagt, und zwar in
    demselben Zug, in dem die Handhöhe wieder abgeräumt wird: stünde die Höhe
    schon wieder am Stylesheet, während der Zustand noch der alte ist, spränge
    das Blatt für einen Anstrich an die falsche Stelle.

    Ein kurzes Tippen zählt wie der Wisch: wer den Spalt trifft, will ihn
    aufhaben.
  */
  const wisch = useRef<(() => void) | null>(null);
  useEffect(() => () => wisch.current?.(), []);

  const grab = (event: React.PointerEvent<HTMLElement>) => {
    // Auf den Knöpfen im Kopf gilt der Klick, nicht der Griff.
    if ((event.target as HTMLElement).closest("button")) return;
    // Eine gelöste Fläche schwebt auch am Telefon — die wird geschoben.
    if (place.mode === "window" || !window.matchMedia(TELEFON).matches) {
      grip.grab(event);
      return;
    }
    if (event.button !== 0) return;
    // Ging ein Loslassen verloren, endet der alte Wisch hier.
    wisch.current?.();

    // Gezogen wird die ganze Reihe, nicht die einzelne Fläche darin.
    const blatt = shell.current?.parentElement;
    if (!blatt) return;

    // Auf 0 fiele das Blatt ganz aus dem Bild — dann lieber der Wert aus dem
    // Stylesheet, an dem noch eine Griffleiste zu fassen ist.
    const spalt = spaltHoehe(blatt) || 78;
    const ganz = Math.round(window.innerHeight * BLATT_HOCH);
    const vonX = event.clientX;
    const vonY = event.clientY;
    const vonH = blatt.getBoundingClientRect().height;
    let hoehe = vonH;

    /*
      Während des Zuges gilt die Hand: keine Bewegung des Stylesheets, die der
      Hand hinterherliefe, und der Körper der hingelegten Fläche steht schon da,
      sonst zöge man einen leeren Kasten auf.
    */
    blatt.classList.add("zieht");
    blatt.style.transition = "none";

    const move = (moved: PointerEvent) => {
      hoehe = Math.min(Math.max(vonH - (moved.clientY - vonY), spalt), ganz);
      blatt.style.height = `${hoehe}px`;
    };

    const up = (moved: PointerEvent) => {
      wisch.current?.();

      const dy = moved.clientY - vonY;
      const dx = moved.clientX - vonX;
      const getippt = Math.abs(dy) <= TIPP && Math.abs(dx) <= TIPP;
      const zu = getippt ? !place.collapsed : hoehe < (spalt + ganz) / 2;
      const ziel = zu ? spalt : ganz;

      let abgesetzt = false;
      const ablegen = () => {
        if (abgesetzt) return;
        abgesetzt = true;
        blatt.removeEventListener("transitionend", fertig);

        /*
          Der neue Stand zuerst und sofort, die Hand danach — beides in einem
          Anstrich. Ließe man React den Stand erst später verbuchen, stünde für
          einen Anstrich das Stylesheet des alten Zustands ohne die Höhe der
          Hand da: das Blatt spränge auf seine volle Höhe und im nächsten
          Anstrich wieder zurück. Genau das war das Zucken am Ende des Zuges.
        */
        flushSync(() => dock.setCollapsedAll(zu));
        blatt.classList.remove("zieht");
        blatt.style.transition = "";
        blatt.style.height = "";
      };

      /*
        `transitionend` steigt auf: auch eine Schaltfläche im Kopf, die gerade
        ihre Farbe wechselt, meldet sich hier. Nur das Ende der eigenen Höhe
        zählt, sonst setzte das Blatt mitten im Fallen ab.
      */
      const fertig = (ende: TransitionEvent) => {
        if (ende.target === blatt && ende.propertyName === "height") ablegen();
      };

      if (Math.abs(hoehe - ziel) < 1) {
        ablegen();
        return;
      }

      blatt.addEventListener("transitionend", fertig);
      /*
        Ohne Bewegung — abgeschaltet in den Systemeinstellungen — kommt kein
        Ende, auf das man warten könnte. Dann räumt der Wecker ab.
      */
      window.setTimeout(ablegen, SETZEN + 60);
      blatt.style.transition = `height ${SETZEN}ms cubic-bezier(0.22, 0.61, 0.36, 1)`;
      blatt.style.height = `${ziel}px`;
    };

    wisch.current = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      wisch.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  const floating = place.mode === "window";
  const target = floating ? document.body : dock.stack;
  if (!target) return null;

  /*
    Eingeklappt bleibt die Fläche stehen, sie wird nur nicht gezeigt. Würde sie
    ausgebaut, verlöre eine halb ausgefüllte Maske ihre Eingaben — und der
    Reiter wäre keine Ablage mehr, sondern ein Papierkorb.

    Am Telefon heißt „nicht gezeigt“ nur „nicht ganz gezeigt“: dort bleibt die
    Kopfzeile als Spalt stehen, das besorgt das Stylesheet.
  */
  const hidden = !floating && place.collapsed;
  const placed = floating
    ? {
        zIndex: 70 + place.lift,
        ...(place.spot ? { left: place.spot.x, top: place.spot.y } : null),
      }
    : null;
  const label = floating ? "In die Spalte einreihen" : "Als Fenster lösen";

  return (
    <>
      {createPortal(
        <>
          {/* Beim Ziehen zeigt ein Streifen, wo die Fläche wieder einrastet. */}
          {grip.docking ? <div className="dock-drop" /> : null}
          <section
            aria-label={title}
            className="dock-surface"
            data-hidden={hidden ? "" : undefined}
            data-mode={place.mode}
            /* Wer eine Fläche anfasst, meint sie — also kommt sie nach vorn. */
            onPointerDown={floating ? () => dock.raise(id) : undefined}
            ref={shell}
            role={persistent ? undefined : "dialog"}
            style={{ order: dock.order.indexOf(id), ...placed }}
          >
            {/* Die Griffleiste des Blattes; am Rechner steht sie nicht da. */}
            <div className="dock-griff" onPointerDown={grab} />
            <header className="dock-head" onPointerDown={grab}>
              <div className="dock-title">
                <h2>{title}</h2>
                {hint ? <p>{hint}</p> : null}
              </div>
              <button
                aria-label={label}
                className="dock-btn dock-btn-loesen"
                onClick={grip.flip}
                title={label}
                type="button"
              >
                <span aria-hidden>{floating ? "▤" : "▣"}</span>
              </button>
              {floating ? null : (
                <button
                  aria-label="An den Rand klappen"
                  className="dock-btn dock-btn-legen"
                  onClick={() => dock.setCollapsed(id, true)}
                  title="An den Rand klappen"
                  type="button"
                >
                  <span aria-hidden>›</span>
                </button>
              )}
              {persistent ? null : (
                <button
                  aria-label="Schließen"
                  className="dock-btn"
                  onClick={() => close(id)}
                  title="Schließen"
                  type="button"
                >
                  <span aria-hidden>✕</span>
                </button>
              )}
            </header>
            <div className="dock-body">{children}</div>
          </section>
        </>,
        target,
      )}

      {hidden && dock.rail
        ? createPortal(
            <button
              className="dock-tab"
              onClick={() => dock.setCollapsed(id, false)}
              style={{ order: dock.order.indexOf(id) }}
              title={`${title} einblenden`}
              type="button"
            >
              <span>‹ {title}</span>
            </button>,
            dock.rail,
          )
        : null}
    </>
  );
}
