"use client";

import Link from "next/link";

import { Aenderbar } from "@/components/Aendern";
import DateField from "@/components/DateField";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import { CowLink } from "@/components/Preview";
import { Empty, Ghost, Sparkline, Stat } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useSeasonView } from "@/lib/data/store";
import { kg, liter, liter0, pct, signedKg } from "@/lib/format";
import { savedKey } from "@/lib/formular";
import {
  dayRange,
  formatDateDe,
  formatDateShort,
  formatMonth,
  isoFromDayIndex,
} from "@/lib/gemelk";

export default function FarmerDetail({ farmerId }: { farmerId: number }) {
  const view = useSeasonView();
  const { createPickup, deletePickup, updateFarmer } = useActions();

  if (!view) return <NoSeason what="Das Konto eines Bauern" />;

  const farmer = view.allFarmers.find((entry) => entry.id === farmerId);
  if (!farmer) {
    return (
      <p className="notice">
        Diesen Bauern gibt es nicht. <Link href="/bauern/">Zur Liste</Link>
      </p>
    );
  }

  const balance = view.balances.find((entry) => entry.farmerId === farmerId);
  const cows = view.activeHerd.filter((cow) => cow.farmerId === farmerId);
  const pickups = view.pickups.filter((pickup) => pickup.farmerId === farmerId);
  const timelines = new Map(view.result.timelines.map((t) => [t.cowId, t]));

  const days = dayRange(view.season.startDate, view.asOf).map((day) =>
    isoFromDayIndex(day),
  );
  const series = days.map((date) => {
    const alloc = view.result.byDay.get(date);
    if (!alloc) return null;
    return alloc.perFarmer.find((row) => row.farmerId === farmerId)?.cheeseKg ?? 0;
  });

  const monthRows = view.months.map((month) => ({
    month: month.month,
    row: month.perFarmer.find((entry) => entry.farmerId === farmerId),
  }));

  return (
    <>
      <div className="page-head">
        <div>
          <Link className="crumb" href="/bauern/">
            ‹ Bauern
          </Link>
          <h1>{farmer.name}</h1>
          <p>
            {cows.length} {cows.length === 1 ? "Kuh" : "Kühe"} auf der Alp
            {farmer.contact ? ` — ${farmer.contact}` : ""}
          </p>
        </div>
        <div className="row no-print">
          <Panel
            hint={`Offen: ${kg(balance?.outstandingKg ?? 0)} kg`}
            id="bauer-abholung"
            primary
            title="Abholung eintragen"
            trigger="Abholung"
          >
            <form action={createPickup} className="stack-sm">
              <input type="hidden" name="seasonId" value={view.season.id} />
              <input type="hidden" name="farmerId" value={farmerId} />
              <div className="form-grid">
                <DateField
                  defaultValue={view.asOf}
                  id="date"
                  label="Datum"
                  name="date"
                  required
                />
                <div className="field">
                  <label htmlFor="pkg">kg</label>
                  <input id="pkg" name="kg" type="number" step="0.1" min="0" required />
                </div>
                <div className="field">
                  <label htmlFor="wheels">Laibe</label>
                  <input id="wheels" name="wheels" type="number" step="1" min="0" />
                </div>
                <div className="field">
                  <label htmlFor="pnote">Notiz</label>
                  <input id="pnote" name="note" placeholder="optional" />
                </div>
              </div>
              <div className="panel-foot">
                <button className="btn-primary" type="submit">
                  Eintragen
                </button>
              </div>
            </form>
          </Panel>
          <Panel id="bauer-stamm" title="Stammdaten" trigger="Stammdaten">
            {/* Der Schlüssel hält die Maske am gespeicherten Stand und stellt
                den Schalter nach dem Speichern wieder zurück — siehe
                `lib/formular.ts` und `components/Aendern.tsx`. */}
            <Aenderbar
              key={savedKey(farmer.name, farmer.contact, farmer.note)}
              was="die Stammdaten"
            >
              <form action={updateFarmer} className="stack-sm">
                <input type="hidden" name="id" value={farmer.id} />
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="name">Name</label>
                    <input id="name" name="name" defaultValue={farmer.name} required />
                  </div>
                  <div className="field">
                    <label htmlFor="contact">Kontakt</label>
                    <input
                      id="contact"
                      name="contact"
                      defaultValue={farmer.contact ?? ""}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="note">Notiz</label>
                    <input id="note" name="note" defaultValue={farmer.note ?? ""} />
                  </div>
                </div>
                <div className="panel-foot">
                  <button className="btn-primary" type="submit">
                    Speichern
                  </button>
                </div>
              </form>
            </Aenderbar>
          </Panel>
        </div>
      </div>

      <div className="stack">
        <div className="grid grid-4">
          <Stat
            label="Abgerechnet"
            value={kg(balance?.settledKg ?? 0)}
            unit="kg"
            note={
              balance?.openMonth
                ? `${kg(balance.ghostKg)} kg im ${formatMonth(balance.openMonth).replace(/ \d{4}$/, "")} bis ${formatDateShort(view.asOf)}`
                : `Stand ${formatDateShort(view.asOf)}`
            }
          />
          <Stat label="Abgeholt" value={kg(balance?.pickedUpKg ?? 0)} unit="kg" />
          <Stat
            label="Noch offen"
            value={kg(balance?.settledOutstandingKg ?? 0)}
            unit="kg"
            note={
              balance && balance.settledOutstandingKg < 0
                ? "zu viel abgeholt"
                : "aus abgeschlossenen Monaten"
            }
          />
          <Stat
            label="Milchanteil"
            value={pct(
              view.totals.usableMilkL > 0
                ? (balance?.usableL ?? 0) / view.totals.usableMilkL
                : 0,
            )}
            note={`${liter0(balance?.usableL ?? 0)} l verwertbar`}
          />
        </div>

        {balance && balance.blockedL > 0 ? (
          <p className="notice notice-blocked">
            {liter(balance.blockedL)} l Milch fielen wegen Behandlungen aus und wurden nicht
            verteilt. Der Ausfall trägt sich hier selbst — die übrigen Bauern verlieren
            dadurch nichts.
          </p>
        ) : null}

        <div className="card chart-card">
          <div className="card-head">
            <h2>Käse je Tag</h2>
            <p>Zuteilung aus dem täglichen Kessel</p>
          </div>
          <div className="chart-body">
            <Sparkline dates={days} values={series} label={`Käse für ${farmer.name}`} />
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Monate</h2>
            <p>tagesgenau abgerechnet, Monatsschnitt als Vergleich</p>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Monat</th>
                  <th className="t-num">Milch</th>
                  <th className="t-num">Anteil</th>
                  <th className="t-num">Käse tagesgenau</th>
                  <th className="t-num">Monatsschnitt</th>
                  <th className="t-num">Differenz</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map(({ month, row }) => (
                  <tr key={month}>
                    <td>{formatMonth(month)}</td>
                    <td className="t-num">{liter0(row?.usableL ?? 0)}</td>
                    <td className="t-num">{pct(row?.sharePct ?? 0)}</td>
                    <td className="t-num">{kg(row?.cheeseDailyKg ?? 0)}</td>
                    <td className="t-num faint">{kg(row?.cheeseMonthlyKg ?? 0)}</td>
                    <td className="t-num faint">
                      {signedKg((row?.cheeseDailyKg ?? 0) - (row?.cheeseMonthlyKg ?? 0))}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Saison</td>
                  <td className="t-num">{liter0(balance?.usableL ?? 0)}</td>
                  <td className="t-num" />
                  <td className="t-num">{kg(balance?.entitledKg ?? 0)}</td>
                  <td className="t-num faint">
                    {kg(
                      monthRows.reduce((sum, m) => sum + (m.row?.cheeseMonthlyKg ?? 0), 0),
                    )}
                  </td>
                  <td className="t-num" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        <div className="card">
          <div className="card-head">
            <h2>Käsekonto</h2>
            <p>monatlich abgerechnet, offener Rest als Übertrag</p>
          </div>
          {!balance || balance.months.length === 0 ? (
            <Empty>Noch nichts abzurechnen.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Monat</th>
                    <th className="t-num">Übertrag</th>
                    <th className="t-num">Anspruch</th>
                    <th className="t-num">abgeholt</th>
                    <th className="t-num">Rest</th>
                  </tr>
                </thead>
                <tbody>
                  {balance.months.map((row) => (
                    <tr key={row.month}>
                      <td>
                        {formatMonth(row.month)}
                        {row.open ? (
                          <span className="faint small"> — läuft noch</span>
                        ) : null}
                      </td>
                      <td className="t-num faint">{kg(row.carryInKg)}</td>
                      <td className="t-num">
                        {row.open ? <Ghost value={row.entitledKg} /> : kg(row.entitledKg)}
                      </td>
                      <td className="t-num faint">{kg(row.pickedUpKg)}</td>
                      <td className="t-num">{kg(row.carryOutKg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {balance?.openMonth ? (
            <p className="small faint" style={{ marginTop: 10 }}>
              Der {formatMonth(balance.openMonth)} ist noch nicht abgerechnet — die
              gestrichelte Zahl ist der Stand von heute und wächst bis zum Monatsende.
            </p>
          ) : null}
        </div>

        <div className="grid grid-2">
          <div className="card">
            <div className="card-head">
              <h2>Kühe</h2>
            </div>
            {cows.length === 0 ? (
              <Empty>Keine Kuh dieses Bauern in der Saison.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Glocke</th>
                      <th className="t-num">Milch</th>
                      <th className="t-num">gesperrt</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cows.map((cow) => {
                      const timeline = timelines.get(cow.id);
                      return (
                        <tr className="linked" key={cow.id}>
                          <td>
                            <CowLink cowId={cow.id}>{cow.name}</CowLink>
                          </td>
                          <td>
                            <span className="bell">{cow.bellNumber}</span>
                          </td>
                          <td className="t-num">{liter0(timeline?.totalUsableL ?? 0)}</td>
                          <td className="t-num">
                            {timeline && timeline.totalBlockedL > 0 ? (
                              <span className="blocked-text">
                                {liter(timeline.totalBlockedL)}
                              </span>
                            ) : (
                              <span className="faint">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="card">
            <div className="card-head">
              <h2>Abholungen</h2>
              <p className="num">{kg(balance?.pickedUpKg ?? 0)} kg gesamt</p>
            </div>

            {pickups.length === 0 ? (
              <Empty>Noch nichts abgeholt.</Empty>
            ) : (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Datum</th>
                      <th className="t-num">kg</th>
                      <th className="t-num">Laibe</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {pickups.map((pickup) => (
                      <tr key={pickup.id}>
                        <td className="num">{formatDateDe(pickup.date)}</td>
                        <td className="t-num">{kg(pickup.kg)}</td>
                        <td className="t-num faint">{pickup.wheels ?? "—"}</td>
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
      </div>
    </>
  );
}
