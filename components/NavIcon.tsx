/*
  Zeichen für die Navigation. Eingeklappt ist die Leiste 62 Pixel schmal — dort
  stand vorher ein auf drei Buchstaben gestutztes Wort, und „Abr“ neben „Abh“
  unterscheidet niemand. Ein Bild trägt die Kennung besser als ein Wortrest.

  Alle Zeichen liegen im selben Raster (16 × 16), zeichnen nur Striche und
  erben die Farbe vom Verweis — so folgen sie jedem Zustand von selbst.
*/

export type NavIconName =
  | "uebersicht"
  | "kalender"
  | "messung"
  | "behandlung"
  | "abholung"
  | "abrechnung"
  | "herde"
  | "bauern"
  | "kuehe"
  | "einstellungen"
  | "suche"
  | "filter"
  | "pfeil"
  | "menu";

const SHAPES: Record<NavIconName, React.ReactNode> = {
  // Vier Felder — die Übersicht zeigt mehrere Kennzahlen nebeneinander.
  uebersicht: (
    <>
      <rect x="2.2" y="2.2" width="5" height="5" rx="1.2" />
      <rect x="8.8" y="2.2" width="5" height="5" rx="1.2" />
      <rect x="2.2" y="8.8" width="5" height="5" rx="1.2" />
      <rect x="8.8" y="8.8" width="5" height="5" rx="1.2" />
    </>
  ),
  kalender: (
    <>
      <rect x="2.2" y="3.4" width="11.6" height="10.4" rx="1.6" />
      <path d="M2.2 6.6h11.6" />
      <path d="M5.4 2.2v2.4M10.6 2.2v2.4" />
    </>
  ),
  // Eine Skala mit Zeiger: gemessen wird, was der Melkstand hergibt.
  messung: (
    <>
      <path d="M2.6 12.4a5.4 5.4 0 0 1 10.8 0" />
      <path d="M2.6 12.4h10.8" />
      <path d="M8 12.4 11 8.3" />
    </>
  ),
  // Eine Kapsel — die Behandlung ist der Eingriff, nicht die Sperre danach.
  behandlung: (
    <>
      <rect
        x="1.9"
        y="5.6"
        width="12.2"
        height="4.8"
        rx="2.4"
        transform="rotate(-45 8 8)"
      />
      <path d="M6.3 6.3 9.7 9.7" />
    </>
  ),
  // Der Käse verlässt die Alp: ein Pfeil aus der Wanne heraus.
  abholung: (
    <>
      <path d="M3 9.6v2.6a1.6 1.6 0 0 0 1.6 1.6h6.8a1.6 1.6 0 0 0 1.6-1.6V9.6" />
      <path d="M8 10.4V2.6" />
      <path d="M5.2 5.4 8 2.6l2.8 2.8" />
    </>
  ),
  abrechnung: (
    <>
      <path d="M3.6 2.4h8.8v11.2l-2.2-1.3-2.2 1.3-2.2-1.3-2.2 1.3z" />
      <path d="M6 5.8h4M6 8.6h4" />
    </>
  ),
  herde: (
    <>
      <path d="M2.4 2.6v10.4a.6.6 0 0 0 .6.6h10.6" />
      <path d="m4.6 10.8 2.6-3.2 2.4 2 3.2-4.4" />
    </>
  ),
  bauern: (
    <>
      <circle cx="8" cy="5.6" r="2.6" />
      <path d="M3 13.6a5 5 0 0 1 10 0" />
    </>
  ),
  /*
    Der Kuhkopf von vorn — nach `docs/assets/kuh-vorlage.svg`, dort aber als
    Fläche gezeichnet und darum hier neu aufgebaut: nur Striche, alles auf dem
    16er-Raster, nichts unter zwei Einheiten Abstand, damit bei 16 Pixeln nichts
    zuläuft.

    Vier Merkmale tragen die Erkennbarkeit, und keines davon darf weg: die
    Hörner über der Stirn, die abstehenden Ohren daneben, der zum Maul hin
    schmaler werdende Kopf und das Maul selbst mit den beiden Nüstern. Eine
    Glocke stand hier vorher — die aber ist das Programmzeichen und meint die
    Alp, nicht das Tier.

    Die Vorlage ist selbst schon eine Strichzeichnung, nur als Fläche gesetzt:
    zwei Umrisse im Abstand einer knappen Einheit. Hier läuft daher die Mitte
    zwischen beiden, und das Ganze ist auf 0,89 verkleinert, damit es im selben
    Feld steht wie die übrigen Zeichen — mit dem Strich von 1,4 reicht es dann
    von 1,56 bis 14,44 in der Höhe, genau wie Kalender und Übersicht.

    Vier Merkmale trägt die Vorlage, und keines davon darf weg: die stumpfen
    Hörner, die flach abstehenden Ohren, der schmale Kopf und das breite Maul
    mit den weit auseinanderliegenden Nüstern. Hörner und Ohren enden dort, wo
    der Kopfbogen verläuft, und gehen unter dessen Strich in ihn über.
  */
  kuehe: (
    <>
      <path d="M3.84 2.26V3.35a.9.9 0 0 0 .9.9h1.03" />
      <path d="M12.16 2.26V3.35a.9.9 0 0 1-.9.9h-1.03" />
      <path d="M4.5 5.45H1.9a1.74 1.74 0 0 0 1.13 2.19h1.1" />
      <path d="M11.5 5.45h2.6a1.74 1.74 0 0 1-1.13 2.19h-1.1" />
      <path d="M4.13 9.69V7.51a3.87 3.87 0 0 1 7.74 0v2.18" />
      <rect x="3.75" y="9.69" width="8.5" height="4.05" rx="1.7" />
      <path d="M5.79 11.5v.4M10.21 11.5v.4" />
    </>
  ),
  /*
    Das Zahnrad. Zwei Regler standen hier vorher, die sahen aber neben den
    übrigen Zeichen wie zwei Zeilen einer Liste aus. Sechs Zähne, keine acht:
    bei sechzehn Bildpunkten und einem Strich von 1,4 liefen mehr Zähne
    ineinander. Gerechnet mit Körper 4,0 und Spitze 5,65 um die Mitte 8/8, die
    Flanken gerade, die Bögen dazwischen echte Kreisbögen.
  */
  einstellungen: (
    <>
      <path d="M6.83 4.17L7.02 2.44A5.65 5.65 0 0 1 8.98 2.44L9.17 4.17A4 4 0 0 1 10.73 5.07L12.33 4.37A5.65 5.65 0 0 1 13.31 6.07L11.90 7.10A4 4 0 0 1 11.90 8.90L13.31 9.93A5.65 5.65 0 0 1 12.33 11.63L10.73 10.93A4 4 0 0 1 9.17 11.83L8.98 13.56A5.65 5.65 0 0 1 7.02 13.56L6.83 11.83A4 4 0 0 1 5.27 10.93L3.67 11.63A5.65 5.65 0 0 1 2.69 9.93L4.10 8.90A4 4 0 0 1 4.10 7.10L2.69 6.07A5.65 5.65 0 0 1 3.67 4.37L5.27 5.07A4 4 0 0 1 6.83 4.17Z" />
      <circle cx="8" cy="8" r="1.75" />
    </>
  ),
  // Diese beiden stehen nicht in der Leiste, sondern über den Listen.
  suche: (
    <>
      <circle cx="7.1" cy="7.1" r="4.3" />
      <path d="m10.3 10.3 3 3" />
    </>
  ),
  // Der Trichter: aus vielem wird weniger.
  filter: <path d="M2.6 3.2h10.8L9.3 8.1v4.4l-2.6 1.3V8.1z" />,
  /*
    Die Spitze nach unten: hier klappt etwas auf. Nur ein Winkel, kein
    Doppelpfeil — aufgeklappt wird nach unten, zugeklappt wird derselbe Winkel
    gedreht, und zwei Spitzen übereinander sagten nichts, was der Zustand des
    Knopfes nicht schon zeigt.
  */
  pfeil: <path d="m4.4 6.4 3.6 3.6 3.6-3.6" />,
  // Drei Striche — am Telefon der Knopf, der die Leiste hervorholt.
  menu: <path d="M2.6 4.4h10.8M2.6 8h10.8M2.6 11.6h10.8" />,
};

/**
 * Dieselben Zeichen dienen auch außerhalb der Leiste — im Kalender etwa steht
 * die Waage für die Messung. Über `className` bekommen sie dort ihre eigene
 * Größe; gezeichnet wird immer dieselbe Form.
 */
export default function NavIcon({
  name,
  className = "nav-icon",
}: {
  name: NavIconName;
  className?: string;
}) {
  return (
    <svg aria-hidden className={className} viewBox="0 0 16 16">
      {SHAPES[name]}
    </svg>
  );
}
