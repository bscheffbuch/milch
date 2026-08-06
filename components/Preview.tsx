"use client";

import Link from "next/link";

import HoverCard from "@/components/HoverCard";
import { Ghost } from "@/components/ui";
import { useSeasonView } from "@/lib/data/store";
import { kg, liter, liter0, pct } from "@/lib/format";
import { formatDateShort, formatGemelk, slotLabel } from "@/lib/gemelk";
import { cowPreview, farmerPreview, roundPreview } from "@/lib/preview";
import { cowHref, farmerHref, roundHref } from "@/lib/routes";

/*
  Jede Kuh, jeder Bauer und jede Messung hat eine eigene Adresse — und zwei
  Darstellungen: beim Überfahren die Vorschau, beim Klicken die Seite.

  Die Vorschau steht fertig im Markup, weil die ganze Auswertung ohnehin im
  Fenster liegt. Damit erscheint sie ohne Nachladen, und beim Überfahren
  passiert nichts als Anzeigen — kein Zucken, kein Sprung.
*/

/** Kein Rechenkern greifbar (etwa vor der ersten Saison): dann eben nur ein Link. */
function Plain({
  className,
  href,
  children,
}: {
  className?: string;
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link className={className} href={href}>
      {children}
    </Link>
  );
}

export function CowLink({
  cowId,
  className,
  children,
}: {
  cowId: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const view = useSeasonView();
  const data = view ? cowPreview(view, cowId) : null;
  const href = cowHref(cowId);
  const label = children ?? data?.name ?? "Kuh";

  if (!data) {
    return (
      <Plain className={className} href={href}>
        {label}
      </Plain>
    );
  }

  return (
    <HoverCard
      card={
        <>
          <div className="hovercard-head">
            <b>{data.name}</b>
            <span className="bell">{data.bellNumber}</span>
            {data.blockedNow ? <span className="blocked-text">gesperrt</span> : null}
          </div>
          {data.offSeason ? (
            <p className="small muted">Nicht in dieser Saison aufgetrieben.</p>
          ) : (
            <dl className="hovercard-rows">
              <dt>Bauer</dt>
              <dd>{data.farmerName}</dd>
              <dt>Milch</dt>
              <dd>{liter0(data.usableL)} l</dd>
              {data.blockedL > 0 ? (
                <>
                  <dt>gesperrt</dt>
                  <dd className="blocked-text">{liter(data.blockedL)} l</dd>
                </>
              ) : null}
              <dt>Ø je Tag</dt>
              <dd>{liter(data.perDayL)} l</dd>
              <dt>Messungen</dt>
              <dd>{data.roundCount}</dd>
              {data.fromIdx !== null && data.toIdx !== null ? (
                <>
                  <dt>gemolken</dt>
                  <dd>
                    {formatGemelk(data.fromIdx)} – {formatGemelk(data.toIdx)}
                  </dd>
                </>
              ) : null}
            </dl>
          )}
        </>
      }
      className={className}
      href={href}
    >
      {label}
    </HoverCard>
  );
}

export function FarmerLink({
  farmerId,
  className,
  children,
}: {
  farmerId: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const view = useSeasonView();
  const data = view ? farmerPreview(view, farmerId) : null;
  const href = farmerHref(farmerId);
  const label = children ?? data?.name ?? "Bauer";

  if (!data) {
    return (
      <Plain className={className} href={href}>
        {label}
      </Plain>
    );
  }

  return (
    <HoverCard
      card={
        <>
          <div className="hovercard-head">
            <b>{data.name}</b>
            {data.contact ? <span className="faint">{data.contact}</span> : null}
          </div>
          <dl className="hovercard-rows">
            <dt>Kühe</dt>
            <dd>{data.cowCount}</dd>
            <dt>Milch</dt>
            <dd>
              {liter0(data.usableL)} l — {pct(data.share)}
            </dd>
            {data.blockedL > 0 ? (
              <>
                <dt>gesperrt</dt>
                <dd className="blocked-text">{liter(data.blockedL)} l</dd>
              </>
            ) : null}
            <dt>abgerechnet</dt>
            <dd>{kg(data.entitledKg)} kg</dd>
            <dt>offen</dt>
            <dd>{kg(data.outstandingKg)} kg</dd>
            {data.ghostKg > 0.05 ? (
              <>
                <dt>laufender Monat</dt>
                <dd>
                  <Ghost value={data.ghostKg} />
                </dd>
              </>
            ) : null}
            <dt>letzte Abholung</dt>
            <dd>
              {data.lastPickupDate ? (
                formatDateShort(data.lastPickupDate)
              ) : (
                <span className="faint">keine</span>
              )}
            </dd>
          </dl>
        </>
      }
      className={className}
      href={href}
    >
      {label}
    </HoverCard>
  );
}

export function RoundLink({
  roundId,
  className,
  children,
}: {
  roundId: number;
  className?: string;
  children?: React.ReactNode;
}) {
  const view = useSeasonView();
  const data = view ? roundPreview(view, roundId) : null;
  const href = roundHref(roundId);
  const label =
    children ??
    (data ? `${formatDateShort(data.firstDate)} ${slotLabel(data.firstSlot)}` : "Messung");

  if (!data) {
    return (
      <Plain className={className} href={href}>
        {label}
      </Plain>
    );
  }

  return (
    <HoverCard
      card={
        <>
          <div className="hovercard-head">
            <b>
              Messung {formatDateShort(data.firstDate)} {slotLabel(data.firstSlot)}
            </b>
          </div>
          <dl className="hovercard-rows">
            <dt>Gemelke</dt>
            <dd>
              {formatGemelk(data.firstIdx)} + {formatGemelk(data.firstIdx + 1)}
            </dd>
            <dt>gilt</dt>
            <dd>
              {formatGemelk(data.validFrom)} – {formatGemelk(data.validTo)}
            </dd>
            <dt>gemessen</dt>
            <dd>
              {data.cowsMeasured} von {data.cowsExpected} Kühen
            </dd>
            <dt>Tagesmenge</dt>
            <dd>{liter0(data.totalL)} l</dd>
          </dl>
          {data.note ? <p className="small faint">{data.note}</p> : null}
        </>
      }
      className={className}
      href={href}
    >
      {label}
    </HoverCard>
  );
}
