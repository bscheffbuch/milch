"use client";

import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { FarmerLink } from "@/components/Preview";
import { Empty, Stat } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { kg, kg0, pct } from "@/lib/format";
import { formatDateDe } from "@/lib/gemelk";
import type { SeasonView } from "@/lib/view";

/*
  Der Käse, den die Alp selbst hergibt.

  Zweierlei steht hier: was in der Hütte gegessen wird, und was Helfer als Lohn
  mitnehmen dürfen. Beides wird nicht abgeholt im Sinne der Abrechnung — eine
  Abholung nimmt vom Konto eines Bauern, was ihm ohnehin zusteht; der Alpkäse
  gehört keinem und wird deshalb von allen getragen, jeder im Verhältnis dessen,
  was ihm zusteht.

  Hier steht bewusst kein Datum. Wer im Herbst einen Laib mitnimmt, kann nicht
  sagen, aus welchem Kessel er stammt, und die Alp führt darüber kein Buch. Ein
  erfundener Tag wäre schlechter als gar keiner: er würde eine Genauigkeit
  vortäuschen, die es nicht gibt, und die Tagesabrechnung verschieben. Also wird
  der Alpkäse nicht Tag für Tag verrechnet, sondern am Ende von dem abgezogen,
  was zu verteilen ist — der Stand von heute, ohne Zeitrechnung.
*/

export default function Page() {
  const view = useSeasonView();
  const { createAlpCheese, deleteAlpCheese } = useActions();
  if (!view) return <NoSeason what="Der Alpkäse" />;

  const borne = bornePerFarmer(view);
  const totalKg = view.totals.alpKg;
  const borneKg = borne.reduce((sum, row) => sum + row.kg, 0);
  /*
    Eingetragen und getragen ist fast immer dasselbe. Auseinander geht es nur,
    solange niemand einen Anspruch hat, auf den sich der Alpkäse verteilen
    ließe — das ist keine Rechenlücke, sondern eine fehlende Käsemenge, und
    darauf muss die Seite hinweisen statt die Zahl stillschweigend kleiner zu
    zeigen.

    Die Schwelle ist nötig, weil beim Aufteilen auf mehrere Bauern
    Rundungsreste von Bruchteilen eines Gramms bleiben. Unter fünfzig Gramm ist
    nichts liegen geblieben, sondern nur gerechnet worden.
  */
  const rest = totalKg - borneKg;
  const notYetBorneKg = rest > 0.05 ? rest : 0;
  const shareOfProduction =
    view.totals.producedKg > 0 ? totalKg / view.totals.producedKg : 0;

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Alpkäse</h1>
          <p>Stand {formatDateDe(view.asOf)}</p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Was in der Hütte gegessen wird oder was Helfer mitnehmen dürfen. Es wird am Ende von dem abgezogen, was zu verteilen ist, und von allen Bauern getragen. Ein Datum braucht es dafür nicht."
            id="alpkaese-neu"
            primary
            title="Alpkäse eintragen"
            trigger="Alpkäse eintragen"
          >
            <form action={createAlpCheese} className="stack-sm">
              <input type="hidden" name="seasonId" value={view.season.id} />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="kg">kg</label>
                  <input id="kg" name="kg" type="number" step="0.1" min="0" required />
                </div>
                <div className="field">
                  <label htmlFor="note">Notiz</label>
                  <input id="note" name="note" placeholder="optional" />
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn-primary" type="submit">
                  Eintragen
                </button>
              </div>
            </form>
          </Panel>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid-3">
          <Stat
            label="Verbraucht und abgegeben"
            value={kg(totalKg)}
            unit="kg"
            note={
              notYetBorneKg > 0
                ? `${kg(notYetBorneKg)} kg warten auf einen Anspruch`
                : view.alpCheese.length === 1
                  ? "1 Eintrag"
                  : `${view.alpCheese.length} Einträge`
            }
          />
          <Stat
            label="Anteil an der Produktion"
            value={pct(shareOfProduction)}
            note={`von ${kg0(view.totals.producedKg)} kg produziert`}
          />
          <Stat
            label="Bleibt zu verteilen"
            value={kg0(view.totals.distributableKg)}
            unit="kg"
            note={
              view.totals.deductionKg > 0
                ? `nach Alpkäse und ${kg(view.totals.deductionKg)} kg Abzug`
                : "nach dem Alpkäse"
            }
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Wer wieviel davon trägt</h2>
            <p>im Verhältnis dessen, was jedem zusteht — Stand {formatDateDe(view.asOf)}</p>
          </div>
          {borne.length === 0 ? (
            <Empty>
              Noch kein Alpkäse eingetragen — oder es steht noch niemandem Käse zu, von dem
              er getragen werden könnte.
            </Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bauer</th>
                    <th className="t-num">trägt</th>
                    <th className="t-num">Anteil</th>
                  </tr>
                </thead>
                <tbody>
                  {borne.map((row) => (
                    <tr key={row.farmerId}>
                      <td>
                        <FarmerLink farmerId={row.farmerId}>
                          {view.farmerNames.get(row.farmerId) ?? "—"}
                        </FarmerLink>
                      </td>
                      <td className="t-num">{kg(row.kg)}</td>
                      <td className="t-num faint">
                        {pct(totalKg > 0 ? row.kg / totalKg : 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Alle Einträge</h2>
            <p className="num">
              {view.alpCheese.length} {view.alpCheese.length === 1 ? "Eintrag" : "Einträge"}{" "}
              — {kg(totalKg)} kg
            </p>
          </div>
          {view.alpCheese.length === 0 ? (
            <Empty>Noch nichts eingetragen.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th className="t-num">kg</th>
                    <th>Notiz</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {view.alpCheese.map((entry) => (
                    <tr key={entry.id}>
                      <td className="t-num">{kg(entry.kg)}</td>
                      <td className="muted small">{entry.note ?? ""}</td>
                      <td className="t-num no-print">
                        <form action={deleteAlpCheese}>
                          <input type="hidden" name="id" value={entry.id} />
                          <button
                            className="btn-quiet btn-danger btn-sm zeilen-tat"
                            type="submit"
                          >
                            Löschen
                          </button>
                        </form>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Wie gerechnet wird</h2>
          </div>
          <ul className="prose small">
            <li>
              Der Alpkäse hat kein Datum und geht deshalb in keinen einzelnen Tag und in
              keinen einzelnen Monat ein. Die Tagesabrechnung und die Monatsabschlüsse
              bleiben so, wie sie ohne ihn wären.
            </li>
            <li>
              Abgezogen wird er ganz am Ende, von dem, was noch offen ist. Niemand bekommt
              ihn abgezogen, weil er ihn abgeholt hätte — es kommt schlicht bei allen
              weniger an.
            </li>
            <li>
              Getragen wird er im Verhältnis dessen, was jedem Bauern über die Saison
              zusteht. Wer mehr Milch gegeben hat, hat einen größeren Anspruch und trägt
              deshalb mehr davon.
            </li>
            <li>
              Solange noch niemandem Käse zusteht, bleibt der Alpkäse liegen; er kommt zum
              Tragen, sobald die erste Käsemenge dasteht. Ein Eintrag lässt sich jederzeit
              nachtragen — er verschiebt keine bereits abgerechneten Monate, sondern nur
              den offenen Stand.
            </li>
          </ul>
        </div>
      </div>
    </>
  );
}

/**
 * Was jeder Bauer vom Alpkäse trägt. Gerechnet ist das schon — im Käsekonto,
 * wo der Alpkäse den offenen Stand mindert. Hier wird es nur herausgezogen und
 * nach Größe geordnet.
 */
function bornePerFarmer(view: SeasonView): Array<{ farmerId: number; kg: number }> {
  return view.balances
    .filter((balance) => balance.alpKg > 0)
    .map((balance) => ({ farmerId: balance.farmerId, kg: balance.alpKg }))
    .sort((a, b) => b.kg - a.kg);
}
