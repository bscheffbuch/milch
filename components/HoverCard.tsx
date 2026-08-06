"use client";

import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { FocusEvent, MouseEvent } from "react";
import { createPortal } from "react-dom";

const OPEN_DELAY = 140;
const CLOSE_DELAY = 90;
const GAP = 8;

interface Spot {
  left: number;
  top: number;
  above: boolean;
}

/**
 * Eine Vorschau, die beim Überfahren erscheint. Sie hängt am Körper des
 * Dokuments, nicht am ausgelösten Element — sonst schnitte sie jeder
 * Kalenderrahmen und jeder waagrechte Rollbereich ab.
 *
 * Das ausgelöste Element bewegt sich dabei nicht; es erscheint nur etwas
 * Zusätzliches daneben.
 *
 * Der Verweis wird hier selbst erzeugt und nicht von außen hereingereicht.
 * Ein fertiges Element von außen ließe sich nur mit `cloneElement` um die
 * Ereignisse ergänzen — und das liest den Typ des Elements sofort aus. Was vom
 * Server kommt, wird aber erst beim Rendern nachgeladen: auf langen Seiten ist
 * der Typ zu diesem Zeitpunkt noch nicht da, und das Rendern bricht ab.
 */
export default function HoverCard({
  card,
  className,
  href,
  style,
  children,
}: {
  card: React.ReactNode;
  className?: string;
  href: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const anchor = useRef<HTMLAnchorElement | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [spot, setSpot] = useState<Spot | null>(null);

  const clear = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }, []);

  const open = useCallback(
    (event: MouseEvent<HTMLAnchorElement> | FocusEvent<HTMLAnchorElement>) => {
      const node = event.currentTarget;
      anchor.current = node;
      clear();
      timer.current = setTimeout(() => {
        const box = node.getBoundingClientRect();
        // Erst grob über dem Element ansetzen — die genaue Höhe kennt erst das Layout.
        setSpot({ left: box.left + box.width / 2, top: box.top - GAP, above: true });
      }, OPEN_DELAY);
    },
    [clear],
  );

  const close = useCallback(() => {
    clear();
    timer.current = setTimeout(() => setSpot(null), CLOSE_DELAY);
  }, [clear]);

  // Nach dem Messen einrasten: waagrecht in den Bildschirm hinein, senkrecht
  // nach unten kippen, wenn oben kein Platz mehr ist.
  useLayoutEffect(() => {
    const node = anchor.current;
    const box = panel.current;
    if (!spot || !node || !box) return;

    const rect = box.getBoundingClientRect();
    const from = node.getBoundingClientRect();
    const above = from.top - GAP - rect.height > 4;
    const left = Math.min(
      Math.max(from.left + from.width / 2, rect.width / 2 + 8),
      window.innerWidth - rect.width / 2 - 8,
    );
    const top = above ? from.top - GAP : from.bottom + GAP;

    if (left !== spot.left || top !== spot.top || above !== spot.above) {
      setSpot({ left, top, above });
    }
  }, [spot]);

  useEffect(() => {
    if (!spot) return;
    const away = () => setSpot(null);
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSpot(null);
    };
    window.addEventListener("scroll", away, true);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("keydown", key);
    };
  }, [spot]);

  useEffect(() => clear, [clear]);

  return (
    <>
      <Link
        className={className}
        href={href}
        onBlur={close}
        onFocus={open}
        onMouseEnter={open}
        onMouseLeave={close}
        style={style}
      >
        {children}
      </Link>
      {spot
        ? createPortal(
            <div
              className="hovercard"
              onMouseEnter={clear}
              onMouseLeave={close}
              ref={panel}
              style={{
                left: spot.left,
                top: spot.top,
                transform: `translate(-50%, ${spot.above ? "-100%" : "0"})`,
              }}
            >
              {card}
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
