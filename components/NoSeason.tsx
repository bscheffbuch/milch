"use client";

import Link from "next/link";

import { Panel } from "@/components/Panel";
import SeasonForm from "@/components/SeasonForm";

/*
  Der leere Anfang
  ================

  Vor der ersten Saison hat keine Seite etwas zu zeigen. Ein Satz, der auf die
  Einstellungen verweist, ist dann eine Sackgasse mit Wegbeschreibung: richtig,
  aber unhöflich. Stattdessen steht die Maske hier — ein Klick, und die Saison
  ist angelegt, ganz gleich, auf welcher Seite man gerade gelandet ist.
*/

export default function NoSeason({ what }: { what?: string }) {
  return (
    <div className="card empty-start">
      <h2>Es ist noch keine Saison angelegt.</h2>
      <p>
        {what
          ? `${what} gehört zu einer Saison — Alpauftrieb bis Alpabtrieb. Sobald die erste steht, geht es hier weiter.`
          : "Eine Saison umfasst alles von einem Alpauftrieb bis zum Abtrieb. Sobald die erste steht, füllt sich die Alpabrechnung."}
      </p>
      <div className="row">
        <Panel
          hint="Eine neue Saison wird sofort aktiv."
          id="saison-neu"
          primary
          title="Neue Saison"
          trigger="Saison anlegen"
        >
          <SeasonForm />
        </Panel>
        <Link className="btn btn-quiet" href="/einstellungen/">
          Zu den Einstellungen
        </Link>
      </div>
    </div>
  );
}
