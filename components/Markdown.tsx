import { Fragment, type ReactNode } from "react";

/*
  Markdown, so viel wie eine Karte davon braucht
  ==============================================

  Der Text zu einer Version wird als Markdown geschrieben, weil er auf der
  Release-Seite bei GitHub landet. Dieselbe Zeichenkette steht aber auch in der
  `latest.json` und damit in der Karte unten links im Programm — und dort stand
  sie bisher, wie sie ist: mit Sternchen, Rauten und Schrägstrichen als
  Satzzeichen. Das liest niemand gern.

  Deshalb dieser kleine Übersetzer. Er kann nicht Markdown, er kann den Teil
  davon, der in einem Absatz Prosa vorkommt: Überschriften, Absätze, Striche
  als Aufzählung, fett, kursiv, Code. Alles andere — Tabellen, Zitate,
  Bilder — bleibt stehen, wie es dasteht. Das ist keine Lücke, sondern die
  Grenze: was eine Tabelle braucht, gehört nicht in eine Karte von vierhundert
  Pixeln Breite, sondern auf die Release-Seite.

  Zwei Dinge sind Absicht und keine Sparsamkeit:

  Es entsteht kein HTML aus dem Text, sondern React-Elemente. Der Text kommt
  von außen — aus einer Datei, die im Netz liegt — und ein `dangerouslySet…`
  wäre genau der Weg, auf dem daraus Programmcode würde.

  Und aus einem Verweis wird kein Verweis, sondern nur seine Beschriftung. Ein
  Klick darauf führte das Fenster aus dem Programm heraus, und ein Programm,
  das statt der Abrechnung plötzlich eine Webseite zeigt, ist kaputt. Wer die
  Einzelheiten sucht, findet sie auf der Release-Seite.
*/

/** Was aus dem Text herausgelesen wird, bevor daraus Elemente werden. */
type Block =
  | { art: "titel"; text: string }
  | { art: "absatz"; text: string }
  | { art: "liste"; punkte: string[] };

/**
 * Das Innere einer Zeile: fett, kursiv, Code, Verweis.
 *
 * Kursiv gilt nur für Sternchen. Der Unterstrich, den Markdown auch dafür
 * kennt, steht hier zu oft mitten in einem Dateinamen — `Milch_0.2.0_x64` wäre
 * sonst zur Hälfte kursiv.
 */
function zeile(text: string, schluessel: string): ReactNode[] {
  const muster =
    /\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`|\[([^\]]+)\]\([^)\s]*\)/g;

  const teile: ReactNode[] = [];
  let gelesen = 0;
  let nummer = 0;
  let treffer: RegExpExecArray | null;

  while ((treffer = muster.exec(text)) !== null) {
    if (treffer.index > gelesen)
      teile.push(text.slice(gelesen, treffer.index));

    const key = `${schluessel}.${nummer++}`;
    if (treffer[1] !== undefined) teile.push(<b key={key}>{treffer[1]}</b>);
    else if (treffer[2] !== undefined) teile.push(<i key={key}>{treffer[2]}</i>);
    else if (treffer[3] !== undefined)
      teile.push(<code key={key}>{treffer[3]}</code>);
    else teile.push(<Fragment key={key}>{treffer[4]}</Fragment>);

    gelesen = muster.lastIndex;
  }

  if (gelesen < text.length) teile.push(text.slice(gelesen));
  return teile;
}

/**
 * Der Text in Blöcke.
 *
 * Ein einzelner Zeilenumbruch trennt in Markdown nichts — er steht nur da,
 * weil die Datei bei achtzig Zeichen umbricht. Innerhalb eines Absatzes werden
 * die Zeilen deshalb wieder zusammengesetzt; erst die leere Zeile trennt.
 */
function bloecke(text: string): Block[] {
  const ergebnis: Block[] = [];
  let absatz: string[] = [];

  const absatzSchliessen = () => {
    if (absatz.length > 0) {
      ergebnis.push({ art: "absatz", text: absatz.join(" ") });
      absatz = [];
    }
  };

  for (const roh of text.replace(/\r\n/g, "\n").split("\n")) {
    const zeileText = roh.trim();

    if (zeileText === "") {
      absatzSchliessen();
      continue;
    }

    const titel = /^#{1,6}\s+(.*)$/.exec(zeileText);
    if (titel) {
      absatzSchliessen();
      ergebnis.push({ art: "titel", text: titel[1] });
      continue;
    }

    const punkt = /^[-*+]\s+(.*)$/.exec(zeileText);
    if (punkt) {
      absatzSchliessen();
      const letzter = ergebnis[ergebnis.length - 1];
      if (letzter?.art === "liste") letzter.punkte.push(punkt[1]);
      else ergebnis.push({ art: "liste", punkte: [punkt[1]] });
      continue;
    }

    // Eine Fortsetzung des Punkts darüber gehört zu ihm und nicht in einen
    // neuen Absatz: eingerückt weitergeschriebene Aufzählungen sind häufig.
    const letzter = ergebnis[ergebnis.length - 1];
    if (absatz.length === 0 && letzter?.art === "liste" && /^\s/.test(roh)) {
      letzter.punkte[letzter.punkte.length - 1] += ` ${zeileText}`;
      continue;
    }

    absatz.push(zeileText);
  }

  absatzSchliessen();
  return ergebnis;
}

/** Markdown als Elemente. `className` kommt zusätzlich zu `md` dazu. */
export default function Markdown({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const teile = bloecke(text.trim());
  if (teile.length === 0) return null;

  return (
    <div className={className ? `md ${className}` : "md"}>
      {teile.map((block, i) => {
        if (block.art === "titel")
          return (
            <p className="md-titel" key={i}>
              {zeile(block.text, `t${i}`)}
            </p>
          );

        if (block.art === "liste")
          return (
            <ul key={i}>
              {block.punkte.map((punkt, j) => (
                <li key={j}>{zeile(punkt, `l${i}.${j}`)}</li>
              ))}
            </ul>
          );

        return <p key={i}>{zeile(block.text, `a${i}`)}</p>;
      })}
    </div>
  );
}
