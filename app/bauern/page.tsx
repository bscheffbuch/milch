"use client";

import { useSearchParams } from "next/navigation";

import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { FarmerLink } from "@/components/Preview";
import { ordered, useSort } from "@/components/Sorter";
import { Empty, Ghost, MiniBar } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { kg, liter0, pct } from "@/lib/format";
import { formatDateShort } from "@/lib/gemelk";
import { idFrom } from "@/lib/routes";
import type { SeasonView } from "@/lib/view";

import FarmerDetail from "./detail";

/*
  Eine Adresse, zwei Ansichten: ohne Kennung die Liste aller Bauern, mit
  Kennung der einzelne Bauer. Die Kennung steht in der Abfrage, weil das
  fertige Programm seine Seiten als Dateien ausliefert.
*/

export default function Page() {
  const farmerId = idFrom(useSearchParams());
  // Der Schlüssel baut die Detailansicht beim Wechsel neu auf — sonst behielten
  // die Formularfelder die Werte des zuvor gezeigten Bauern.
  return farmerId === null ? (
    <FarmerList />
  ) : (
    <FarmerDetail farmerId={farmerId} key={farmerId} />
  );
}

/*
  Sortieren der Bauernliste
  =========================

  Dieselbe Bedienung wie bei den Kühen: die Spaltenköpfe sortieren. Die Frage
  ist hier fast immer eine des Vergleichs — wer die meiste Milch bringt, wem am
  meisten Käse zusteht, bei wem am meisten offen ist —, und genau das steht in
  den Spalten. „Anteil“ bekommt keinen eigenen Kopf: es ist die Milch in
  Prozent und ergäbe dieselbe Reihenfolge zweimal.
*/

type SortKey = "name" | "cows" | "milk" | "entitled" | "settled" | "open" | "pickup";

const NUMERIC: ReadonlySet<SortKey> = new Set([
  "cows",
  "milk",
  "entitled",
  "settled",
  "open",
  "pickup",
]);

/** Eine Zeile mit allem schon Herausgesuchten — sonst suchte der Vergleich. */
interface Row {
  farmer: SeasonView["farmers"][number];
  cows: number;
  milk: number;
  entitled: number;
  settled: number;
  ghost: number;
  open: number;
  pickup: string | null;
}

function FarmerList() {
  const view = useSeasonView();
  const { createFarmer } = useActions();
  const { head, sort } = useSort<SortKey>("name", NUMERIC);
  if (!view) return <NoSeason what="Die Bauern" />;

  const { balances, totals } = view;
  const byId = new Map(balances.map((balance) => [balance.farmerId, balance]));
  const maxEntitled = Math.max(...balances.map((b) => b.entitledKg), 1);

  const rows: Row[] = view.farmers.map((farmer) => {
    const balance = byId.get(farmer.id);
    return {
      farmer,
      cows: balance?.cowCount ?? 0,
      milk: balance?.usableL ?? 0,
      entitled: balance?.entitledKg ?? 0,
      settled: balance?.settledKg ?? 0,
      ghost: balance?.ghostKg ?? 0,
      open: balance?.settledOutstandingKg ?? 0,
      pickup: balance?.lastPickupDate ?? null,
    };
  });

  const shown = ordered(rows, sort, compare, (a, b) =>
    a.farmer.name.localeCompare(b.farmer.name, "de"),
  );

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Bauern</h1>
          <p>
            {view.farmers.length} Bauern mit {view.activeHerd.length} Kühen auf der Alp
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Kontakt und Notiz lassen sich später ergänzen."
            id="bauer-neu"
            primary
            title="Bauer hinzufügen"
            trigger="Bauer hinzufügen"
          >
            <form action={createFarmer} className="stack-sm">
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="name">Name</label>
                  <input
                    id="name"
                    name="name"
                    required
                    placeholder="Nachname oder Hofname"
                  />
                </div>
                <div className="field">
                  <label htmlFor="contact">Kontakt</label>
                  <input id="contact" name="contact" placeholder="Adresse oder Telefon" />
                </div>
                <div className="field">
                  <label htmlFor="note">Notiz</label>
                  <input id="note" name="note" />
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn-primary" type="submit">
                  Hinzufügen
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      <div className="card">
        {view.farmers.length === 0 ? (
          <Empty>Noch kein Bauer angelegt.</Empty>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {head("name", "Name")}
                  <th>Kontakt</th>
                  {head("cows", "Kühe", true)}
                  {head("milk", "Milch", true)}
                  <th className="t-num">Anteil</th>
                  {head("entitled", "Anspruch")}
                  {head("settled", "abgerechnet", true)}
                  {head("open", "offen", true)}
                  {head("pickup", "letzte Abholung", true)}
                </tr>
              </thead>
              <tbody>
                {shown.map((row) => (
                  <tr className="linked" key={row.farmer.id}>
                    <td>
                      <FarmerLink farmerId={row.farmer.id}>{row.farmer.name}</FarmerLink>
                    </td>
                    <td className="muted">{row.farmer.contact ?? "—"}</td>
                    <td className="t-num">{row.cows}</td>
                    <td className="t-num">{liter0(row.milk)}</td>
                    <td className="t-num">
                      {pct(totals.usableMilkL > 0 ? row.milk / totals.usableMilkL : 0)}
                    </td>
                    <td style={{ width: "16%" }}>
                      <MiniBar value={row.entitled} max={maxEntitled} />
                    </td>
                    <td className="t-num">
                      {kg(row.settled)}
                      <Ghost block value={row.ghost} />
                    </td>
                    <td className="t-num">{kg(row.open)}</td>
                    <td className="t-num faint">
                      {row.pickup ? formatDateShort(row.pickup) : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

/** Aufsteigend. Die Richtung dreht der Aufrufer, nicht der Vergleich. */
function compare(a: Row, b: Row, key: SortKey): number {
  switch (key) {
    case "name":
      return a.farmer.name.localeCompare(b.farmer.name, "de");
    case "cows":
      return a.cows - b.cows;
    case "milk":
      return a.milk - b.milk;
    case "entitled":
      return a.entitled - b.entitled;
    case "settled":
      return a.settled - b.settled;
    case "open":
      return a.open - b.open;
    // Wer noch nie abgeholt hat, steht am unteren Ende — nicht mittendrin.
    case "pickup":
      return (a.pickup ?? "").localeCompare(b.pickup ?? "");
  }
}
