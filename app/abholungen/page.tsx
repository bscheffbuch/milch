"use client";

import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { FarmerLink } from "@/components/Preview";
import { Empty, Ghost, Stat } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { kg, kg0 } from "@/lib/format";
import { formatDateDe, formatMonth } from "@/lib/gemelk";

export default function Page() {
  const view = useSeasonView();
  const { createPickup, deletePickup } = useActions();
  if (!view) return <NoSeason what="Abholungen" />;

  /*
    Fällig ist, was aus abgeschlossenen Monaten offen steht. Der laufende Monat
    ist noch nicht abgerechnet — er läuft als Schatten mit, damit man sieht,
    wieviel am Monatsende dazukommt.
  */
  const outstandingTotal = view.balances.reduce(
    (sum, b) => sum + b.settledOutstandingKg,
    0,
  );
  const settledTotal = view.balances.reduce((sum, b) => sum + b.settledKg, 0);
  const ghostTotal = view.balances.reduce((sum, b) => sum + b.ghostKg, 0);
  const openMonth = view.balances[0]?.openMonth ?? null;
  const owed = view.balances.filter((b) => b.settledOutstandingKg > 0.05);
  const over = view.balances.filter((b) => b.settledOutstandingKg < -0.05);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Abholungen</h1>
          <p>Stand {formatDateDe(view.asOf)}</p>
        </div>
        <div className="row no-print">
          <Panel
            hint="Die Laibe sind freiwillig — gerechnet wird mit den Kilo."
            id="abholung-neu"
            primary
            title="Abholung eintragen"
            trigger="Abholung eintragen"
          >
            <form action={createPickup} className="stack-sm">
              <input type="hidden" name="seasonId" value={view.season.id} />
              <div className="form-grid">
                <div className="field">
                  <label htmlFor="farmerId">Bauer</label>
                  <Dropdown
                    id="farmerId"
                    name="farmerId"
                    options={view.farmers.map((farmer) => ({
                      label: farmer.name,
                      value: String(farmer.id),
                    }))}
                    required
                  />
                </div>
                <DateField
                  defaultValue={view.asOf}
                  id="date"
                  label="Datum"
                  name="date"
                  required
                />
                <div className="field">
                  <label htmlFor="kg">kg</label>
                  <input id="kg" name="kg" type="number" step="0.1" min="0" required />
                </div>
                <div className="field">
                  <label htmlFor="wheels">Laibe</label>
                  <input id="wheels" name="wheels" type="number" step="1" min="0" />
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
            label="Abgerechnet"
            value={kg0(settledTotal)}
            unit="kg"
            note={
              openMonth
                ? `${kg0(ghostTotal)} kg im ${formatMonth(openMonth).replace(/ \d{4}$/, "")} noch nicht abgerechnet`
                : undefined
            }
          />
          <Stat label="Abgeholt" value={kg0(view.totals.pickedUpKg)} unit="kg" />
          <Stat
            label="Noch offen"
            value={kg0(outstandingTotal)}
            unit="kg"
            note={
              over.length > 0
                ? `${over.length} ${over.length === 1 ? "Bauer hat" : "Bauern haben"} zu viel abgeholt`
                : undefined
            }
          />
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Was den Bauern noch zusteht</h2>
            <p>
              abgerechnete Monate abzüglich der bereits abgeholten Menge
              {openMonth
                ? ` — der ${formatMonth(openMonth).replace(/ \d{4}$/, "")} kommt am Monatsende dazu`
                : ""}
            </p>
          </div>
          {view.balances.length === 0 ? (
            <Empty>Noch keine Zuteilung — es fehlen Messwerte oder Käsemengen.</Empty>
          ) : (
            <div className="stack-sm">
              {view.balances.map((balance) => {
                const share =
                  balance.settledKg > 0
                    ? Math.min(1, balance.pickedUpKg / balance.settledKg)
                    : 0;
                return (
                  <div className="claim" key={balance.farmerId}>
                    <div className="claim-head">
                      <FarmerLink farmerId={balance.farmerId}>
                        {view.farmerNames.get(balance.farmerId) ?? "—"}
                      </FarmerLink>
                      <span className="num">
                        {balance.settledOutstandingKg < -0.05 ? (
                          <span className="blocked-text">
                            {kg(-balance.settledOutstandingKg)} kg zu viel
                          </span>
                        ) : (
                          <>
                            <b>{kg(balance.settledOutstandingKg)}</b> kg offen
                          </>
                        )}
                      </span>
                    </div>
                    <div
                      className="bar"
                      role="img"
                      aria-label={`${Math.round(share * 100)} % abgeholt`}
                    >
                      <div className="bar-fill" style={{ width: `${share * 100}%` }} />
                    </div>
                    <div className="claim-foot small faint">
                      <span className="num">
                        {kg(balance.pickedUpKg)} von {kg(balance.settledKg)} kg abgeholt
                        {balance.ghostKg > 0.05 ? (
                          <>
                            {" · "}
                            <Ghost
                              title={`im laufenden Monat dazugekommen, Stand ${formatDateDe(view.asOf)}`}
                              value={balance.ghostKg}
                            />
                          </>
                        ) : null}
                      </span>
                      <span className="num">
                        {balance.lastPickupDate
                          ? `zuletzt ${formatDateDe(balance.lastPickupDate)}`
                          : "noch nichts abgeholt"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {owed.length === 0 && view.balances.length > 0 ? (
            <p className="small faint" style={{ marginTop: 10 }}>
              Es steht niemandem mehr etwas zu.
            </p>
          ) : null}
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Alle Abholungen</h2>
            <p className="num">
              {view.pickups.length} Einträge — {kg(view.totals.pickedUpKg)} kg
            </p>
          </div>
          {view.pickups.length === 0 ? (
            <Empty>Noch nichts abgeholt.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Datum</th>
                    <th>Bauer</th>
                    <th className="t-num">kg</th>
                    <th className="t-num">Laibe</th>
                    <th>Notiz</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {view.pickups.map((pickup) => (
                    <tr key={pickup.id}>
                      <td className="num">{formatDateDe(pickup.date)}</td>
                      <td>
                        <FarmerLink farmerId={pickup.farmerId}>
                          {view.farmerNames.get(pickup.farmerId) ?? "—"}
                        </FarmerLink>
                      </td>
                      <td className="t-num">{kg(pickup.kg)}</td>
                      <td className="t-num faint">{pickup.wheels ?? "—"}</td>
                      <td className="muted small">{pickup.note ?? ""}</td>
                      <td className="t-num no-print">
                        <form action={deletePickup}>
                          <input type="hidden" name="id" value={pickup.id} />
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
      </div>
    </>
  );
}
