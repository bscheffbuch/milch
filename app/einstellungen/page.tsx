"use client";

import CarryOverForm from "@/components/CarryOverForm";
import Confirm from "@/components/Confirm";
import DateField from "@/components/DateField";
import Dropdown from "@/components/Dropdown";
import NoSeason from "@/components/NoSeason";
import { Panel } from "@/components/Panel";
import PathField from "@/components/PathField";
import SeasonForm from "@/components/SeasonForm";
import Sharing from "@/components/Sharing";
import { Empty } from "@/components/ui";
import { useActions } from "@/lib/data/commands";
import { useData } from "@/lib/data/store";
import { bytes, kg } from "@/lib/format";
import { formatDateDe, gemelkeToDays } from "@/lib/gemelk";

export default function Page() {
  // Diese Seite steht auch vor der ersten Saison offen — sie liest deshalb den
  // rohen Stand und nicht die Auswertung.
  const { snapshot, view } = useData();
  const {
    activateSeason,
    deleteBackup,
    deleteSeason,
    exportDb,
    importDb,
    revealPath,
    saveTreatmentType,
    setAutoBackup,
    setTreatmentTypeArchived,
    updateSeason,
  } = useActions();

  const seasons = snapshot.seasons;
  const db = snapshot.db;

  // Wie viele Kühe je Saison aufgetrieben wurden — die einzige Zahl, an der
  // sich eine leere von einer geführten Saison auf einen Blick unterscheidet.
  const cowsPerSeason = new Map<number, number>();
  for (const entry of snapshot.seasonCows) {
    cowsPerSeason.set(entry.seasonId, (cowsPerSeason.get(entry.seasonId) ?? 0) + 1);
  }

  const activeTypes = snapshot.treatmentTypes.filter((type) => type.archived === 0);
  const archivedTypes = snapshot.treatmentTypes.filter((type) => type.archived === 1);

  return (
    <>
      <div className="page-head">
        <div>
          <h1>Einstellungen</h1>
          <p>Saison, Abzüge und Behandlungs-Voreinstellungen</p>
        </div>
      </div>

      <div className="stack">
        {view ? (
          <form action={updateSeason} className="card stack-sm">
            <div className="card-head" style={{ marginBottom: 2 }}>
              <h2>Saison {view.season.name}</h2>
              <p>
                {formatDateDe(view.season.startDate)} – {formatDateDe(view.season.endDate)}
              </p>
            </div>
            <input type="hidden" name="id" value={view.season.id} />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="name">Name</label>
                <input id="name" name="name" defaultValue={view.season.name} required />
              </div>
              <DateField
                defaultValue={view.season.startDate}
                id="startDate"
                label="Alpauftrieb"
                name="startDate"
                required
              />
              <DateField
                defaultValue={view.season.endDate}
                id="endDate"
                label="Alpabtrieb"
                name="endDate"
                required
              />
              <div className="field">
                <label htmlFor="deductionPercent">Abzug in %</label>
                <input
                  id="deductionPercent"
                  name="deductionPercent"
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={(view.season.deductionPercent * 100).toFixed(1)}
                />
              </div>
              <div className="field">
                <label htmlFor="deductionFixedPerDay">Abzug in kg je Tag</label>
                <input
                  id="deductionFixedPerDay"
                  name="deductionFixedPerDay"
                  type="number"
                  step="0.1"
                  min="0"
                  defaultValue={view.season.deductionFixedPerDay}
                />
              </div>
              <button className="btn-primary" type="submit">
                Speichern
              </button>
            </div>
            <p className="small faint">
              Abzüge werden vor der Verteilung von der Tagesproduktion abgezogen — etwa für
              den Eigenbedarf der Sennerei. Beide Werte stehen auf 0, solange nichts
              abgezogen wird; in dieser Saison sind es bisher {kg(view.totals.deductionKg)}{" "}
              kg.
            </p>
          </form>
        ) : (
          <NoSeason />
        )}

        <div className="card">
          <div className="card-head card-head-action">
            <div>
              <h2>Behandlungs-Voreinstellungen</h2>
              <p>
                Auswahlvorschläge beim Eintragen einer Behandlung — die Wartezeit lässt sich
                dort jederzeit überschreiben.
              </p>
            </div>
            <Panel
              id="voreinstellung-neu"
              title="Neue Voreinstellung"
              trigger="Voreinstellung anlegen"
            >
              <form action={saveTreatmentType} className="stack-sm">
                <div className="form-grid">
                  <div className="field">
                    <label htmlFor="newName">Bezeichnung</label>
                    <input
                      id="newName"
                      name="name"
                      placeholder="z. B. Eutertube"
                      required
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="newWithhold">Wartezeit</label>
                    <input
                      id="newWithhold"
                      name="withhold"
                      type="number"
                      step="1"
                      min="0"
                      defaultValue={6}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="newUnit">Einheit</label>
                    <Dropdown
                      defaultValue="gemelke"
                      id="newUnit"
                      name="unit"
                      options={[
                        { label: "Gemelke", value: "gemelke" },
                        { label: "Tage", value: "days" },
                      ]}
                    />
                  </div>
                  <div className="field">
                    <label htmlFor="newNote">Notiz</label>
                    <input id="newNote" name="note" placeholder="optional" />
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

          {activeTypes.length === 0 ? (
            <Empty>Keine Voreinstellung angelegt.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Bezeichnung</th>
                    <th className="t-num" style={{ width: 130 }}>
                      Gemelke
                    </th>
                    <th className="t-num">entspricht</th>
                    <th>Notiz</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {activeTypes.map((type) => (
                    <tr key={type.id}>
                      <td>
                        <form
                          action={saveTreatmentType}
                          className="row"
                          id={`type-${type.id}`}
                        >
                          <input type="hidden" name="id" value={type.id} />
                          <input
                            aria-label="Bezeichnung"
                            name="name"
                            defaultValue={type.name}
                            required
                          />
                        </form>
                      </td>
                      <td className="t-num">
                        <input
                          aria-label="Wartezeit in Gemelken"
                          className="cell-input"
                          form={`type-${type.id}`}
                          name="withhold"
                          type="number"
                          step="1"
                          min="0"
                          defaultValue={type.defaultWithholdGemelke}
                        />
                      </td>
                      <td className="t-num faint">
                        {gemelkeToDays(type.defaultWithholdGemelke)} Tage
                      </td>
                      <td>
                        <input
                          aria-label="Notiz"
                          form={`type-${type.id}`}
                          name="note"
                          defaultValue={type.note ?? ""}
                        />
                      </td>
                      <td className="t-num no-print">
                        <div className="row">
                          <button className="btn-sm" form={`type-${type.id}`} type="submit">
                            Speichern
                          </button>
                          <form action={setTreatmentTypeArchived}>
                            <input type="hidden" name="id" value={type.id} />
                            <input type="hidden" name="archived" value="1" />
                            <button className="btn-quiet btn-sm" type="submit">
                              Ausblenden
                            </button>
                          </form>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {archivedTypes.length > 0 ? (
            <div className="stack-sm no-print" style={{ marginTop: 14 }}>
              <p className="small faint">Ausgeblendet</p>
              <div className="row">
                {archivedTypes.map((type) => (
                  <form action={setTreatmentTypeArchived} key={type.id}>
                    <input type="hidden" name="id" value={type.id} />
                    <input type="hidden" name="archived" value="0" />
                    <button className="btn btn-quiet btn-sm" type="submit">
                      {type.name} <span className="faint">einblenden</span>
                    </button>
                  </form>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="card">
          <div className="card-head card-head-action">
            <div>
              <h2>Saisons</h2>
              <p>Die aktive Saison bestimmt, was überall angezeigt wird.</p>
            </div>
            <div className="row" style={{ flex: "0 0 auto" }}>
              {view && seasons.length > 1 ? (
                <Panel
                  hint={`Die Kühe kommen in ${view.season.name} — mit Auftrieb, aber ohne die Messungen und Behandlungen des alten Sommers.`}
                  id="saison-uebernahme"
                  title="Kühe übernehmen"
                  trigger="Kühe übernehmen"
                >
                  <CarryOverForm />
                </Panel>
              ) : null}
              <Panel
                hint="Eine neue Saison wird sofort aktiv."
                id="saison-neu"
                title="Neue Saison"
                trigger="Saison anlegen"
              >
                <SeasonForm />
              </Panel>
            </div>
          </div>
          {seasons.length === 0 ? (
            <Empty>Noch keine Saison.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Saison</th>
                    <th>von</th>
                    <th>bis</th>
                    <th className="t-num">Kühe</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.id}>
                      <td>
                        {season.name}
                        {season.isActive === 1 ? (
                          <span className="chip chip-on" style={{ marginLeft: 6 }}>
                            aktiv
                          </span>
                        ) : null}
                      </td>
                      <td className="num small">{formatDateDe(season.startDate)}</td>
                      <td className="num small">{formatDateDe(season.endDate)}</td>
                      <td className="t-num">
                        {cowsPerSeason.get(season.id) ?? (
                          <span className="faint">keine</span>
                        )}
                      </td>
                      <td className="t-num no-print">
                        <div className="row row-end">
                          {season.isActive === 1 ? null : (
                            <form action={activateSeason}>
                              <input type="hidden" name="id" value={season.id} />
                              <button className="btn-quiet btn-sm" type="submit">
                                Aktivieren
                              </button>
                            </form>
                          )}
                          {seasons.length > 1 ? (
                            <form action={deleteSeason}>
                              <input type="hidden" name="id" value={season.id} />
                              <Confirm
                                confirm="Löschen"
                                danger
                                label="Löschen"
                                question={`${season.name} mit allen Messungen, Behandlungen und Abholungen entfernen?`}
                              />
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <p className="small faint" style={{ marginTop: 10 }}>
            Kühe und Bauern gehören keiner einzelnen Saison — sie bleiben bestehen und
            nehmen über den Auftrieb an einer Saison teil. Eine gelöschte Saison nimmt nur
            ihre eigenen Einträge mit; die Stammdaten bleiben stehen.
          </p>
        </div>

        <Sharing />

        <div className="card">
          <div className="card-head card-head-action">
            <div>
              <h2>Daten</h2>
              <p>
                Alles liegt in einer einzigen Datei. Ein Backup heißt: diese Datei kopieren.
              </p>
            </div>
            <form action={exportDb}>
              <button className="btn-primary" type="submit">
                Backup anlegen
              </button>
            </form>
          </div>

          <p className="num small" style={{ wordBreak: "break-all" }}>
            {snapshot.dbPath}
          </p>
          <div className="row" style={{ marginTop: 2 }}>
            <p className="small faint">
              {bytes(db.bytes)}
              {db.savedAt ? ` · zuletzt geändert ${db.savedAt}` : ""}
            </p>
            {/*
              Ein Pfad zum Lesen nützt wenig, wenn man die Datei auf einen Stick
              ziehen will. Der Knopf öffnet den Ordner und wählt sie an.
            */}
            <form action={revealPath} className="no-print">
              <input type="hidden" name="path" value={snapshot.dbPath} />
              <button className="btn-quiet btn-sm" type="submit">
                Im Ordner zeigen
              </button>
            </form>
          </div>

          <div className="divider" style={{ margin: "14px 0 12px" }} />

          <div className="card-head card-head-action" style={{ marginBottom: 8 }}>
            <div>
              <h3>Backups</h3>
              <p>
                Ein Backup überschreibt nie ein älteres. Wer sie außer Haus haben will,
                legt sie auf einen Stick — dieselbe Datei, ein anderer Pfad.
              </p>
            </div>
            <div className="row" style={{ flex: "0 0 auto" }}>
              {db.backups.length > 0 ? (
                <form action={revealPath}>
                  <input type="hidden" name="path" value={db.backupDir} />
                  <button className="btn-quiet btn-sm" type="submit">
                    Ordner öffnen
                  </button>
                </form>
              ) : null}
              <Panel
                hint="Ein vollständiger Pfad, etwa /Volumes/Stick/alp-2026.db. Eine vorhandene Datei wird nicht überschrieben."
                id="backup-ziel"
                title="Backup woanders ablegen"
                trigger="Woanders ablegen"
              >
                <form action={exportDb} className="stack-sm">
                  <PathField
                    defaultFileName={`alp-${snapshot.season?.name ?? "backup"}.db`}
                    id="exportTarget"
                    label="Ziel"
                    mode="save"
                    name="target"
                    placeholder="/Volumes/Stick/alp.db"
                  />
                  <div className="panel-foot">
                    <button className="btn-primary" type="submit">
                      Sichern
                    </button>
                  </div>
                </form>
              </Panel>
              <Panel
                hint="Der bisherige Stand wird vorher gesichert — zurück kommt man also immer."
                id="daten-einlesen"
                title="Aus Datei wiederherstellen"
                trigger="Aus Datei einlesen"
              >
                <form action={importDb} className="stack-sm">
                  <PathField
                    id="importSource"
                    label="Datei"
                    mode="open"
                    name="source"
                    placeholder="/Volumes/Stick/alp.db"
                  />
                  <p className="small faint">
                    Die Datei wird zuerst geprüft: ist es keine Alpabrechnung oder ist sie
                    beschädigt, bleibt alles stehen, wie es ist.
                  </p>
                  <div className="panel-foot">
                    <Confirm
                      confirm="Ersetzen"
                      danger
                      label="Alles ersetzen"
                      question="Der ganze Stand wird ersetzt."
                    />
                  </div>
                </form>
              </Panel>
            </div>
          </div>

          {/*
            Der Schalter für das Sichern von selbst. Er steht hier und nicht
            weiter oben, weil er dasselbe betrifft wie die Liste darunter: was
            von selbst entsteht, liegt in derselben Reihe wie das von Hand
            Angelegte und lässt sich genauso zurückholen.
          */}
          <form action={setAutoBackup} className="row" style={{ marginBottom: 12 }}>
            <input type="hidden" name="on" value={db.auto ? "0" : "1"} />
            <button aria-pressed={db.auto} className="btn btn-sm" type="submit">
              Von selbst sichern
            </button>
            <p className="small faint">
              {db.auto ? (
                <>
                  Vor der ersten Änderung an einer Messung und vor jedem Löschen entsteht
                  eine Kopie des Standes davor. Die jüngsten {db.autoKeep} bleiben liegen,
                  ältere räumt das Programm weg; von Hand angelegte Backups bleiben
                  unangetastet.
                </>
              ) : (
                "Gesichert wird nur auf Zuruf."
              )}
            </p>
          </form>

          {db.backups.length === 0 ? (
            <Empty>Noch kein Backup. Sie landen in {db.backupDir}.</Empty>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Backup</th>
                    <th>angelegt</th>
                    <th className="t-num">Größe</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {db.backups.map((file) => (
                    <tr key={file.path}>
                      <td className="num small">{file.name}</td>
                      <td className="num small" style={{ whiteSpace: "nowrap" }}>
                        {file.savedAt}
                      </td>
                      <td className="t-num num small">{bytes(file.bytes)}</td>
                      <td className="t-num no-print">
                        <div className="row">
                          <form action={revealPath}>
                            <input type="hidden" name="path" value={file.path} />
                            <button className="btn-quiet btn-sm" type="submit">
                              Zeigen
                            </button>
                          </form>
                          <form action={importDb}>
                            <input type="hidden" name="source" value={file.path} />
                            <Confirm
                              confirm="Ersetzen"
                              label="Zurückholen"
                              question="Der ganze Stand wird ersetzt."
                            />
                          </form>
                          <form action={deleteBackup}>
                            <input type="hidden" name="path" value={file.path} />
                            <Confirm
                              confirm="Löschen"
                              danger
                              label="Löschen"
                              question="Endgültig?"
                            />
                          </form>
                        </div>
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
