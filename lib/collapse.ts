/*
  Eingeklappte Bereiche
  =====================

  Ob die Navigation schmal ist und wie die Flächen rechts stehen, merkt sich das
  Programm über Sitzungen hinweg. Beides steht als Attribut am Dokument, nicht im
  Zustand einer Komponente: das Stylesheet allein entscheidet dann über die
  Breite, und ein Skript im Kopf setzt das Attribut, bevor überhaupt etwas
  gezeichnet wird. Sonst erschiene der Bereich erst breit und spränge danach
  zusammen.
*/

export interface Collapsible {
  /** Name im `dataset` des <html>-Elements. */
  attr: string;
  key: string;
}

export const NAV: Collapsible = { attr: "nav", key: "nav-collapsed" };

export function isCollapsed(area: Collapsible): boolean {
  return document.documentElement.dataset[area.attr] === "collapsed";
}

/** Umschalten und merken. Gibt zurück, ob danach eingeklappt ist. */
export function toggleCollapsed(area: Collapsible): boolean {
  const root = document.documentElement;
  const next = !isCollapsed(area);

  if (next) root.dataset[area.attr] = "collapsed";
  else delete root.dataset[area.attr];

  try {
    localStorage.setItem(area.key, next ? "1" : "0");
  } catch {
    // Ohne Speicher gilt die Wahl eben nur für diese Sitzung.
  }
  return next;
}

/*
  Die schmale Schiene gibt es nur am breiten Fenster. Am Telefon steht die
  Navigation nicht am Rand, sondern kommt auf Knopfdruck davor — eingeklappt
  heißt dort fort, nicht schmal. Dieselbe Grenze steht im Stylesheet.
*/
export const NARROW = "(max-width: 880px)";

/* ------------------------------------------------------------ Ablageflächen */

/*
  Jede Fläche in der rechten Ablage merkt sich ihre eigene Lage. Eine gemeinsame
  Einstellung wäre bequemer zu schreiben, träfe aber die Sache nicht: die
  Tagesspalte und eine Erfassungsmaske stehen aus verschiedenen Gründen dort, und
  wer die eine losgelöst über den Kalender legt, will deshalb noch lange nicht
  jedes Formular schweben haben.
*/

export type DockMode = "drawer" | "window";

export interface SurfacePlacement {
  mode: DockMode;
  collapsed: boolean;
  /**
   * Ob der Reiter zuletzt von Hand betätigt wurde. Dann gilt diese Wahl und
   * nicht mehr die Vermutung der Fläche: wer die Tagesspalte aufklappt, will
   * sie offen behalten, auch wenn gerade kein Tag gewählt ist.
   */
  pinned: boolean;
}

const surfaceKey = (id: string, what: string) => `dock:${id}:${what}`;

export function readSurface(id: string): SurfacePlacement {
  try {
    return {
      mode: localStorage.getItem(surfaceKey(id, "mode")) === "window" ? "window" : "drawer",
      collapsed: localStorage.getItem(surfaceKey(id, "collapsed")) === "1",
      pinned: localStorage.getItem(surfaceKey(id, "pinned")) === "1",
    };
  } catch {
    return { mode: "drawer", collapsed: false, pinned: false };
  }
}

export function saveSurface(id: string, placement: Partial<SurfacePlacement>): void {
  try {
    if (placement.mode) localStorage.setItem(surfaceKey(id, "mode"), placement.mode);
    if (placement.collapsed !== undefined) {
      localStorage.setItem(surfaceKey(id, "collapsed"), placement.collapsed ? "1" : "0");
    }
    if (placement.pinned !== undefined) {
      localStorage.setItem(surfaceKey(id, "pinned"), placement.pinned ? "1" : "0");
    }
  } catch {
    // Ohne Speicher gilt die Wahl eben nur für diese Sitzung.
  }
}

/*
  Nur Flächen, die mit ihrer Seite schon stehen, muss das Skript im Kopf
  vorbereiten — eine Erfassungsmaske öffnet sich erst auf Klick und kann keinen
  Sprung verursachen. Der Pfad entscheidet, welche das gerade ist.
*/
const BOOT_SURFACES: { id: string; path: string }[] = [{ id: "tag", path: "/kalender" }];

/** Läuft im Kopf der Seite, vor dem ersten Anstrich. */
export const COLLAPSE_INIT_SCRIPT = `try{
var d=document.documentElement.dataset;
if(localStorage.getItem(${JSON.stringify(NAV.key)})==="1")d[${JSON.stringify(NAV.attr)}]="collapsed";
var b=${JSON.stringify(BOOT_SURFACES.map((s) => [s.id, s.path]))},o=0,r=0,i=0;
for(;i<b.length;i++){
if(location.pathname.indexOf(b[i][1])!==0)continue;
if(localStorage.getItem("dock:"+b[i][0]+":mode")==="window")continue;
if(localStorage.getItem("dock:"+b[i][0]+":collapsed")==="1")r++;else o++;
}
if(o)d.dock="open";else if(r)d.dock="rail";
if(r)d.dockRail="";
}catch(e){}`;
