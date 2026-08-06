"use client";

import { useEffect, useRef } from "react";

/**
 * Waagrechter Ausschnitt für eine durchgehende Zeitachse. Beim Öffnen wird
 * der Stichtag in die Mitte gerückt — sonst landet man am Alpauftrieb und
 * müsste sich erst durch die halbe Saison scrollen.
 */
export default function ScrollStrip({
  focus,
  children,
}: {
  /** Position des Stichtags auf der Achse, 0 bis 1. */
  focus: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || el.scrollWidth <= el.clientWidth) return;
    el.scrollLeft = Math.max(0, el.scrollWidth * focus - el.clientWidth / 2);
  }, [focus]);

  return (
    <div className="strip-scroll" ref={ref}>
      {children}
    </div>
  );
}
