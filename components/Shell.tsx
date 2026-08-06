"use client";

import { Suspense } from "react";

import Aktualisierung from "@/components/Aktualisierung";
import { DockProvider, DockRegion } from "@/components/Dock";
import Nav, { type NavGroup } from "@/components/Nav";
import { blockedCowsOn, daysSince } from "@/lib/calc/report";
import { DataProvider, useData } from "@/lib/data/store";
import { formatDateShort } from "@/lib/gemelk";

/*
  Der Rahmen um alle Seiten. Er hängt am Stand der Datenschicht, deshalb ist er
  eine Client-Komponente: die Abzeichen in der Navigation kommen aus derselben
  Auswertung wie die Seiten selbst und ändern sich mit jeder Eingabe mit.

  Die Suspense-Grenze steht hier, weil die Detailseiten ihre Kennung aus der
  Adresse lesen. Beim Vorabrendern des statischen Exports ist die noch nicht
  bekannt — die Grenze gibt dem Bau etwas zum Anzeigen, bis der Browser sie hat.
*/

export default function Shell({ children }: { children: React.ReactNode }) {
  return (
    <DockProvider>
      <DataProvider>
        <Frame>{children}</Frame>
      </DataProvider>
    </DockProvider>
  );
}

function Frame({ children }: { children: React.ReactNode }) {
  const { view, busy, error, clearError, notice, clearNotice } = useData();

  // Abzeichen nur, wenn wirklich etwas ansteht — ein normal laufender Betrieb
  // braucht keine Anzeige.
  const overdueDays = view ? daysSince(view.lastRoundDate, view.asOf) : null;
  const messungBadge =
    overdueDays !== null && overdueDays >= 8 ? `${overdueDays} T` : undefined;
  const blockedNow = view ? blockedCowsOn(view.result, view.asOf).length : 0;

  const groups: NavGroup[] = [
    {
      label: "Alltag",
      items: [
        { href: "/", label: "Übersicht", icon: "uebersicht" },
        { href: "/kalender/", label: "Kalender", icon: "kalender" },
        {
          href: "/messung/",
          label: "Messungen",
          icon: "messung",
          badge: messungBadge,
        },
        {
          href: "/behandlungen/",
          label: "Behandlungen",
          icon: "behandlung",
          badge: blockedNow > 0 ? String(blockedNow) : undefined,
        },
        { href: "/abholungen/", label: "Abholungen", icon: "abholung" },
      ],
    },
    {
      label: "Auswertung",
      items: [
        { href: "/abrechnung/", label: "Abrechnung", icon: "abrechnung" },
        { href: "/herde/", label: "Herdenverlauf", icon: "herde" },
      ],
    },
    {
      label: "Stammdaten",
      items: [
        {
          href: "/bauern/",
          label: "Bauern",
          icon: "bauern",
          badge: view ? String(view.farmers.length) : undefined,
        },
        {
          href: "/kuehe/",
          label: "Kühe",
          icon: "kuehe",
          badge: view ? String(view.activeHerd.length) : undefined,
        },
        { href: "/einstellungen/", label: "Einstellungen", icon: "einstellungen" },
      ],
    },
  ];

  return (
    <div className="app" data-busy={busy > 0 ? "" : undefined}>
      <Nav
        seasonName={view?.season.name ?? "Keine Saison"}
        seasonRange={
          view
            ? `${formatDateShort(view.season.startDate)} – ${formatDateShort(view.season.endDate)}`
            : "noch nicht angelegt"
        }
        seasonShort={view ? view.season.startDate.slice(0, 4) : "—"}
        groups={groups}
      />
      <main className="main">
        <Suspense fallback={null}>{children}</Suspense>
      </main>
      <DockRegion />

      {/*
        Die Ecke unten links. Ein fehlgeschlagener Auftrag darf nicht stumm
        bleiben — und ein gelungener auch nicht, wenn sein Ergebnis in einer
        Datei liegt und nicht auf dem Bildschirm. Von diesen beiden gibt es nie
        zwei zugleich, weil jeder Auftrag genau eines von beidem hinterlässt.

        Die Aktualisierung ist die Ausnahme: sie hängt an keinem Auftrag,
        sondern kommt beim Start von sich aus. Sie kann also neben einer der
        beiden Meldungen stehen, und darum stapelt die Ecke jetzt, statt jedem
        Stück eine feste Stelle zu geben. Übereinanderliegende Karten wären der
        einzige andere Ausgang gewesen.
      */}
      <div className="meldungen">
        {error ? (
          <div className="flash no-print" role="alert">
            <span>{error}</span>
            <button className="btn-quiet btn-sm" onClick={clearError} type="button">
              Schließen
            </button>
          </div>
        ) : notice ? (
          <div className="flash no-print" data-tone="done" role="status">
            <span>{notice}</span>
            <button className="btn-quiet btn-sm" onClick={clearNotice} type="button">
              Schließen
            </button>
          </div>
        ) : null}
        <Aktualisierung />
      </div>
    </div>
  );
}
