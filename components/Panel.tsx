"use client";

import { DockSurface, useDockOpen } from "@/components/Dock";

/*
  Erfassungsmasken stehen nicht dauerhaft in der Seite, sondern kommen auf
  Zuruf — ein Klick auf die Schaltfläche, und der Kalender behält seinen Platz.

  Wohin sie kommen, entscheidet die Ablage rechts; hier steht nur noch, was
  eine Maske von einer beliebigen anderen Fläche unterscheidet: sie hat einen
  Auslöser, und man kann sie schließen.
*/

/**
 * Eine Maske samt Auslöser. Der Inhalt darf auf dem Server entstehen — er wird
 * als `children` durchgereicht, Server-Aktionen inbegriffen.
 */
export function Panel({
  id,
  title,
  trigger,
  hint,
  primary,
  quiet,
  children,
}: {
  id: string;
  title: string;
  /**
   * Die Beschriftung trägt allein, was der Auslöser tut. Hier stand einmal ein
   * Pluszeichen davor, wo etwas angelegt wird — neben „Behandlung eintragen“
   * sagte es dasselbe zweimal, einmal als Zeichen und einmal als Wort.
   */
  trigger: string;
  hint?: string;
  /** Hebt den Auslöser hervor, wenn er die Haupthandlung der Seite ist. */
  primary?: boolean;
  /** Zurückhaltender Auslöser in Zeilengröße — für Masken mitten in Tabellen. */
  quiet?: boolean;
  children: React.ReactNode;
}) {
  const { isOpen, toggle } = useDockOpen(id);

  return (
    <>
      <button
        aria-expanded={isOpen}
        className={primary ? "btn btn-primary" : quiet ? "btn btn-quiet btn-sm" : "btn"}
        onClick={toggle}
        type="button"
      >
        {trigger}
      </button>
      {isOpen ? (
        <DockSurface hint={hint} id={id} title={title}>
          {children}
        </DockSurface>
      ) : null}
    </>
  );
}
