"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import CowForm from "@/components/CowForm";
import NavIcon from "@/components/NavIcon";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { CowLink, FarmerLink } from "@/components/Preview";
import { ordered, useSort } from "@/components/Sorter";
import { Empty } from "@/components/ui";
import { useSeasonView } from "@/lib/data/store";
import { liter, liter0 } from "@/lib/format";
import { formatDateShort, slotLabel } from "@/lib/gemelk";
import { idFrom } from "@/lib/routes";
import { bellOrder, type SeasonView } from "@/lib/view";

import CowDetail from "./detail";

export default function Page() {
  const cowId = idFrom(useSearchParams());
  // Der Schlüssel baut die Detailansicht beim Wechsel neu auf — sonst behielten
  // die Formularfelder die Werte der zuvor gezeigten Kuh.
  return cowId === null ? <CowList /> : <CowDetail cowId={cowId} key={cowId} />;
}

/*
  Suchen, Sortieren und Filtern der Herde
  =======================================

  Drei Fragen an dieselbe Liste, und sie greifen ineinander: gesucht wird im
  Namen und in der Glocke, gefiltert nach Bauer, sortiert nach jeder Spalte.
  Die Zeile über der Tabelle sagt anschließend, wie viele Kühe von wie vielen
  übrig sind — sonst wüsste man nicht, ob eine kurze Liste an der Herde liegt
  oder an dem, was man eingestellt hat.

  Die Suche steht offen, der Filter liegt hinter dem Trichter. Suchen tut man
  ständig, filtern selten; und stünden alle Bauern als Marken immer da, wäre
  die Zeile über der Tabelle bei zehn Höfen länger als die Tabelle selbst.
*/

type SortKey =
  "bell" | "name" | "farmer" | "arrival" | "milk" | "perDay" | "blocked" | "rounds";

const NUMERIC: ReadonlySet<SortKey> = new Set(["milk", "perDay", "blocked", "rounds"]);

/** Eine Zeile mit allem schon Ausgerechneten — sonst rechnete der Vergleich. */
interface Row {
  cow: SeasonView["herd"][number];
  farmerName: string;
  milk: number;
  perDay: number;
  blocked: number;
  rounds: number;
  endLabel: string;
}

function CowList() {
  const view = useSeasonView();
  const { head, sort } = useSort<SortKey>("bell", NUMERIC);
  const [query, setQuery] = useState("");
  const [only, setOnly] = useState<number | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);
  if (!view) return <NoSeason what="Die Kühe" />;

  const timelines = new Map(view.result.timelines.map((t) => [t.cowId, t]));
  const needle = query.trim().toLowerCase();
  /*
    Gesucht wird über Name, Glocke und Bauer zugleich. Wer „Berta“ tippt, meint
    die Kuh; wer „12“ tippt, meint die Glocke; wer den Hofnamen tippt, meint
    alle Kühe des Hofs — und niemand will vorher sagen, welches davon es war.
  */
  const hit = (cow: { bellNumber: string; farmerId: number; name: string }) =>
    needle === "" ||
    cow.name.toLowerCase().includes(needle) ||
    cow.bellNumber.toLowerCase().includes(needle) ||
    (view.farmerNames.get(cow.farmerId) ?? "").toLowerCase().includes(needle);

  const matches = (cow: { bellNumber: string; farmerId: number; name: string }) =>
    (only === null || cow.farmerId === only) && hit(cow);
  const inSeason = view.herd.filter((cow) => cow.cowSeasonId !== null);
  const outside = view.herd.filter((cow) => cow.cowSeasonId === null).filter(matches);

  const rows: Row[] = inSeason.filter(matches).map((cow) => {
    const timeline = timelines.get(cow.id);
    const usableL = timeline?.totalUsableL ?? 0;
    // Der Schnitt geht über die Tage, an denen die Kuh wirklich gemolken wurde,
    // nicht über die ganze Saison — sonst stünde eine spät aufgetriebene Kuh
    // schlechter da, als sie gibt.
    const dayCount = timeline?.days.length ?? 0;
    return {
      cow,
      farmerName: view.farmerNames.get(cow.farmerId) ?? "",
      milk: usableL,
      perDay: dayCount > 0 ? usableL / dayCount : 0,
      blocked: timeline?.totalBlockedL ?? 0,
      rounds: timeline?.spans.length ?? 0,
      endLabel: cow.dryOffDate
        ? `trocken ${formatDateShort(cow.dryOffDate)} ${slotLabel(cow.dryOffSlot ?? "PM")}`
        : cow.departureDate
          ? `ab ${formatDateShort(cow.departureDate)}`
          : "—",
    };
  });

  // Gleichstand entscheidet die Glocke, damit dieselbe Liste zweimal gleich
  // aussieht.
  const shown = ordered(rows, sort, compare, (a, b) => bellOrder(a.cow) - bellOrder(b.cow));
  const narrowed = only !== null || needle !== "";

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Kühe</h1>
          <p>
            {narrowed
              ? `${rows.length} von ${inSeason.length} auf der Alp`
              : `${inSeason.length} auf der Alp`}
            {outside.length > 0 ? `, ${outside.length} nicht in dieser Saison` : ""}
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint={
              view.farmers.length === 0
                ? "Zuerst muss es einen Bauern geben."
                : "Glocke und Name stehen später auf jedem Ausdruck."
            }
            id="kuh-neu"
            primary
            title="Kuh hinzufügen"
            trigger="Kuh hinzufügen"
          >
            <CowForm
              endDate={view.season.endDate}
              farmers={view.farmers}
              seasonId={view.season.id}
              startDate={view.season.startDate}
            />
          </Panel>
        </div>
      </div>

      <div className="list-tools no-print">
        <div className="search">
          <NavIcon className="search-icon" name="suche" />
          <input
            aria-label="Kühe durchsuchen"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Name, Glocke oder Bauer"
            type="search"
            value={query}
          />
        </div>
        {view.farmers.length > 1 ? (
          /*
            Der Trichter sagt schon zu, dass etwas gefiltert ist — mit dem Namen
            des Bauern daneben. Sonst müsste man ihn aufklappen, um zu sehen,
            warum die Liste kurz ist.
          */
          <button
            aria-expanded={filtersOpen}
            className={only === null ? "btn-quiet btn-tool" : "btn-quiet btn-tool is-on"}
            onClick={() => setFiltersOpen((open) => !open)}
            type="button"
          >
            <NavIcon className="nav-icon" name="filter" />
            {only === null
              ? "Filter"
              : (view.farmerNames.get(only) ?? `${rows.length} Kühe`)}
          </button>
        ) : null}
      </div>

      {filtersOpen && view.farmers.length > 1 ? (
        <div className="wahl wahl-breit no-print filter-row">
          <button aria-pressed={only === null} onClick={() => setOnly(null)} type="button">
            Alle
          </button>
          {view.farmers.map((farmer) => (
            <button
              aria-pressed={only === farmer.id}
              key={farmer.id}
              // Noch einmal derselbe Bauer hebt den Filter wieder auf — der
              // Weg zurück ist derselbe Knopf, den man hingeklickt hat.
              onClick={() =>
                setOnly((current) => (current === farmer.id ? null : farmer.id))
              }
              type="button"
            >
              {farmer.name}
              <span className="faint">{view.cowCountByFarmer.get(farmer.id) ?? 0}</span>
            </button>
          ))}
        </div>
      ) : null}

      <div className="stack">
        <div className="card">
          {shown.length === 0 ? (
            <Empty>
              {inSeason.length === 0
                ? "Noch keine Kuh in dieser Saison."
                : needle !== ""
                  ? `Keine Kuh passt zu „${query.trim()}“.`
                  : "Von diesem Bauern ist keine Kuh auf der Alp."}
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    {head("bell", "Glocke")}
                    {head("name", "Name")}
                    {head("farmer", "Bauer")}
                    {head("arrival", "Auftrieb")}
                    <th>Ende</th>
                    {head("milk", "Milch", true)}
                    {head("perDay", "Ø je Tag", true)}
                    {head("blocked", "gesperrt", true)}
                    {head("rounds", "Messungen", true)}
                  </tr>
                </thead>
                <tbody>
                  {shown.map((row) => (
                    <tr className="linked" key={row.cow.id}>
                      <td>
                        <span className="bell">{row.cow.bellNumber}</span>
                      </td>
                      {/*
                        Die Zeile sagt über die Kuh schon alles, was eine
                        Vorschau sagen würde — beim Bauern dagegen steht hier
                        nur der Name.
                      */}
                      <td>
                        <CowLink cowId={row.cow.id}>{row.cow.name}</CowLink>
                      </td>
                      <td className="muted">
                        <FarmerLink farmerId={row.cow.farmerId}>
                          {row.cow.farmerName}
                        </FarmerLink>
                      </td>
                      {/*
                        Ob eine Kuh morgens oder abends kam, entscheidet über
                        ein ganzes Gemelk — es gehört neben den Tag und nicht
                        nur in die Detailansicht.
                      */}
                      <td className="num small">
                        {row.cow.arrivalDate ? (
                          <>
                            {formatDateShort(row.cow.arrivalDate)}{" "}
                            <span className="faint">
                              {slotLabel(row.cow.arrivalSlot ?? "AM")}
                            </span>
                          </>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="num small muted">{row.endLabel}</td>
                      <td className="t-num">{liter0(row.milk)}</td>
                      <td className="t-num">{liter(row.perDay)}</td>
                      <td className="t-num">
                        {row.blocked > 0 ? (
                          <span className="blocked-text">{liter(row.blocked)}</span>
                        ) : (
                          <span className="faint">—</span>
                        )}
                      </td>
                      <td className="t-num faint">{row.rounds}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {outside.length > 0 ? (
          <div className="card">
            <div className="card-head">
              <h2>Nicht in dieser Saison</h2>
              <p>ohne Auftrieb — zählen nicht mit</p>
            </div>
            <div className="row">
              {outside.map((cow) => (
                <CowLink className="chip" cowId={cow.id} key={cow.id}>
                  {cow.name} <span className="bell">{cow.bellNumber}</span>
                </CowLink>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}

/** Aufsteigend. Die Richtung dreht der Aufrufer, nicht der Vergleich. */
function compare(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "bell":
      return bellOrder(a.cow) - bellOrder(b.cow);
    case "name":
      return a.cow.name.localeCompare(b.cow.name, "de");
    case "farmer":
      return a.farmerName.localeCompare(b.farmerName, "de");
    case "arrival":
      return (a.cow.arrivalDate ?? "").localeCompare(b.cow.arrivalDate ?? "");
    case "milk":
      return a.milk - b.milk;
    case "perDay":
      return a.perDay - b.perDay;
    case "blocked":
      return a.blocked - b.blocked;
    case "rounds":
      return a.rounds - b.rounds;
  }
}
