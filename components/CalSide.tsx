"use client";

import { DockSurface } from "@/components/Dock";

/*
  Die Tagesspalte des Kalenders ist keine eigene Einrichtung mehr, sondern eine
  Fläche in der Ablage rechts wie jede andere: dieselbe Spalte, derselbe Griff
  zum Lösen, derselbe Reiter zum Wegklappen. Vorher hatte sie ihre eigene Kante,
  ihr eigenes Gedächtnis und ihren eigenen Reiter — offen neben einer
  Erfassungsmaske standen dann zwei Spalten nebeneinander und der Kalender
  dazwischen wurde schmal.

  Sie kommt und geht mit dem Kalender, deshalb `persistent`: geschlossen wird
  sie nicht, nur weggeklappt.

  Ist kein Tag gewählt, hat sie nichts zu zeigen — dann klappt sie an den Rand
  und der Kalender bekommt die Breite. Der Reiter bleibt stehen, wer trotzdem
  hineinsehen will, klappt ihn auf und behält ihn offen.

  Das Datum steht in der Kopfzeile und nur dort. Sie bleibt stehen, wenn der
  Inhalt rollt, und am Telefon ist sie alles, was vom hingelegten Blatt zu sehen
  ist — dort soll man am Spalt ablesen können, welcher Tag darunter liegt, ohne
  ihn aufzuziehen. Eine zweite Überschrift gleich darunter im Inhalt sagte
  dasselbe ein zweites Mal und schob den ersten Eingabeplatz nach unten.
*/
export default function CalSide({
  empty,
  hint,
  title,
  children,
}: {
  empty: boolean;
  hint?: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <DockSurface hint={hint} id="tag" persistent quiet={empty} title={title}>
      {children}
    </DockSurface>
  );
}
