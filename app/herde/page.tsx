"use client";

import Link from "next/link";
import { Fragment } from "react";

import NoSeason from "@/components/NoSeason";
import { CowLink } from "@/components/Preview";
import { Empty } from "@/components/ui";
import { useSeasonView } from "@/lib/data/store";
import type { HerdCow } from "@/lib/data/types";
import { liter0 } from "@/lib/format";
import {
  dayIndex,
  formatDateShort,
  formatGemelk,
  formatMonth,
  gemelkIndex,
  monthsBetween,
} from "@/lib/gemelk";

export default function Page() {
  const view = useSeasonView();
  if (!view) return <NoSeason what="Die Herdenübersicht" />;

  const { season, result } = view;
  const startIdx = gemelkIndex(season.startDate, "AM");
  const totalGemelke = (dayIndex(season.endDate) - dayIndex(season.startDate) + 1) * 2;
  const at = (idx: number) =>
    Math.max(0, Math.min(100, ((idx - startIdx) / totalGemelke) * 100));
  const width = (from: number, to: number) => ((to - from + 1) / totalGemelke) * 100;

  const timelines = new Map(result.timelines.map((timeline) => [timeline.cowId, timeline]));
  const months = monthsBetween(season.startDate, season.endDate);
  const nowLeft = at(gemelkIndex(view.asOf, "PM"));

  // Nach Bauer gruppiert — so ist die Herde tatsächlich organisiert.
  const byFarmer = new Map<number, HerdCow[]>();
  for (const cow of view.activeHerd) {
    const bucket = byFarmer.get(cow.farmerId);
    if (bucket) bucket.push(cow);
    else byFarmer.set(cow.farmerId, [cow]);
  }

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Herdenverlauf</h1>
          <p>
            {view.activeHerd.length} Kühe von {formatDateShort(season.startDate)} bis{" "}
            {formatDateShort(season.endDate)}
          </p>
        </div>
      </div>

      {view.activeHerd.length === 0 ? (
        <div className="card">
          <Empty>
            Für diese Saison ist noch keine Kuh eingetragen.{" "}
            <Link href="/kuehe/">Kühe verwalten</Link>
          </Empty>
        </div>
      ) : (
        <div className="card">
          <div className="tl">
            <div />
            <div className="tl-head">
              {months.map((month) => (
                <span
                  key={month}
                  style={{ left: `${at(gemelkIndex(`${month}-01`, "AM"))}%` }}
                >
                  {formatMonth(month).split(" ")[0]}
                </span>
              ))}
            </div>
            <div />

            {[...byFarmer.entries()].map(([farmerId, cows]) => (
              <Fragment key={farmerId}>
                <h3 className="tl-section">{view.farmerNames.get(farmerId) ?? "—"}</h3>

                {cows.map((cow) => {
                  const timeline = timelines.get(cow.id);
                  return (
                    <Fragment key={cow.id}>
                      <div className="tl-name">
                        <CowLink cowId={cow.id}>{cow.name}</CowLink>
                        <span className="bell">{cow.bellNumber}</span>
                      </div>

                      <div className="tl-track">
                        {timeline ? (
                          <>
                            <div
                              className="tl-milking"
                              style={{
                                left: `${at(timeline.fromIdx)}%`,
                                width: `${width(timeline.fromIdx, timeline.toIdx)}%`,
                              }}
                              title={`gemolken ${formatGemelk(timeline.fromIdx)} bis ${formatGemelk(timeline.toIdx)}`}
                            />
                            {timeline.spans.map((span) => (
                              <div
                                className="tl-tick"
                                key={span.roundId}
                                style={{ left: `${at(span.anchor)}%` }}
                                title={`Messung ${formatGemelk(span.anchor)}`}
                              />
                            ))}
                            {timeline.blocked.map((span) => (
                              <div
                                className="tl-blocked"
                                key={`${span.fromIdx}-${span.toIdx}`}
                                style={{
                                  left: `${at(span.fromIdx)}%`,
                                  width: `${width(span.fromIdx, span.toIdx)}%`,
                                }}
                                title={`${span.labels.join(", ")}: ${formatGemelk(span.fromIdx)} bis ${formatGemelk(span.toIdx)}`}
                              />
                            ))}
                            {cow.dryOffDate || cow.departureDate ? (
                              <div
                                className="tl-dry"
                                style={{ left: `${at(timeline.toIdx)}%` }}
                                title={
                                  cow.dryOffDate
                                    ? `trockengestellt ${formatGemelk(timeline.toIdx)}`
                                    : `abgetrieben ${formatGemelk(timeline.toIdx)}`
                                }
                              />
                            ) : null}
                          </>
                        ) : null}
                        <div className="tl-now" style={{ left: `${nowLeft}%` }} />
                      </div>

                      <div className="t-num small">
                        {timeline ? `${liter0(timeline.totalUsableL)} l` : "–"}
                      </div>
                    </Fragment>
                  );
                })}
              </Fragment>
            ))}
          </div>

          <div className="divider" style={{ margin: "16px 0 12px" }} />
          <div className="legend">
            <span>
              <Swatch background="var(--surface-3)" border />
              Melkzeitraum
            </span>
            <span>
              <Swatch background="var(--blocked)" />
              Milch gesperrt
            </span>
            <span>
              <Swatch background="var(--text-faint)" round />
              Messung
            </span>
            <span>
              <Swatch background="var(--text)" narrow />
              trockengestellt oder abgetrieben
            </span>
          </div>
        </div>
      )}
    </>
  );
}

function Swatch({
  background,
  border,
  round,
  narrow,
}: {
  background: string;
  border?: boolean;
  round?: boolean;
  narrow?: boolean;
}) {
  return (
    <i
      aria-hidden
      style={{
        display: "inline-block",
        width: round ? 4 : narrow ? 2 : 18,
        height: round ? 4 : narrow ? 11 : 9,
        background,
        border: border ? "1px solid var(--border-strong)" : undefined,
        borderRadius: round ? "50%" : narrow ? 0 : 2,
      }}
    />
  );
}
