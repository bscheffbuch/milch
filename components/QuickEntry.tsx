"use client";

import { useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";

import Dropdown from "@/components/Dropdown";
import { useActions } from "@/lib/data/commands";
import { liter } from "@/lib/format";
import { bellOrder } from "@/lib/view";

/*
  Eintippen statt Ausfüllen
  =========================

  Am Messblatt sitzt man und liest ab; im Melkstand steht man und tippt. Dort
  hat man die Kühe eines Hofs nacheinander vor sich, kennt die Glocke und die
  Menge und will dazwischen nichts anfassen müssen — keine Maus, kein Suchen
  der nächsten Zeile in einer Tabelle mit siebzig Zeilen.

  Also: erst den Bauern, dann immer dasselbe — Glocke, Eingabetaste, Menge,
  Eingabetaste. Danach steht der Schreibstrich wieder in der Glocke, und
  daneben steht, was eben gespeichert wurde. Wer sich vertippt, sieht es in der
  Liste darunter: sie führt die Kühe des Hofs mit dem, was für sie schon
  eingetragen ist.

  Gespeichert wird sofort und je Kuh — dieselbe Anweisung wie beim Blatt, nur
  mit einer einzigen Kuh darin. Das andere Gemelk muss dabei mitgeschickt
  werden: die Anweisung schreibt beide Werte einer Kuh, und was nicht
  mitkommt, gilt als nicht gemessen.
*/

export interface QuickCow {
  id: number;
  name: string;
  bellNumber: string;
  farmerId: number;
  farmerName: string;
}

export interface QuickValue {
  firstL: number | null;
  secondL: number | null;
}

/** Was in ein Eingabefeld gehört: 11.3 steht dort als „11,3“. */
function editable(value: number | null): string {
  return value === null ? "" : String(value).replace(".", ",");
}

export default function QuickEntry({
  cows,
  first,
  roundId,
  second,
  values,
}: {
  cows: QuickCow[];
  /** Beschriftung des ersten Gemelks, etwa „morgens 10.06.“. */
  first: string;
  roundId: number;
  second: string;
  values: Map<number, QuickValue>;
}) {
  const { saveRoundValues } = useActions();

  const farmers = useMemo(() => {
    const byId = new Map<number, string>();
    for (const cow of cows) byId.set(cow.farmerId, cow.farmerName);
    return [...byId]
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name, "de"));
  }, [cows]);

  const [farmerId, setFarmerId] = useState(
    farmers.length === 1 ? String(farmers[0].id) : "",
  );
  const [slot, setSlot] = useState<"first" | "second">("first");
  const [bell, setBell] = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<string | null>(null);

  const bellField = useRef<HTMLInputElement>(null);
  const amountField = useRef<HTMLInputElement>(null);

  const mine = cows
    .filter((cow) => String(cow.farmerId) === farmerId)
    .sort((a, b) => bellOrder(a) - bellOrder(b));

  /*
    Die Glocke wird beim Tippen gelesen, nicht erst bei der Eingabetaste: wer
    die 7 eines Hofs mit einstelligen Glocken tippt, soll den Namen schon
    sehen. Genau getroffen zählt vor Anfang eines längeren — sonst käme man bei
    einer Herde mit 7 und 70 nie an die 7.
  */
  const cow =
    mine.find((entry) => entry.bellNumber === bell.trim()) ??
    (bell.trim() === ""
      ? undefined
      : ((matches) => (matches.length === 1 ? matches[0] : undefined))(
          mine.filter((entry) => entry.bellNumber.startsWith(bell.trim())),
        ));

  const current = cow ? (values.get(cow.id) ?? { firstL: null, secondL: null }) : null;
  const other = slot === "first" ? "second" : "first";

  /*
    Von der Glocke zur Menge — mit dem, was dort schon steht, und zwar
    markiert: wer die Kuh noch einmal misst, tippt einfach die neue Zahl
    darüber; wer nur nachsieht, geht mit der Eingabetaste weiter.

    Markiert werden kann aber erst, was auch dasteht. React schreibt den neuen
    Wert sonst erst nach diesem Aufruf ins Feld, und markiert wäre dann ein
    leeres Feld — die neue Zahl hinge hinter der alten. Darum wird der Wert
    hier ausnahmsweise sofort durchgeschrieben.
  */
  const toAmount = () => {
    if (!cow || !current) return;
    flushSync(() => {
      setAmount(editable(slot === "first" ? current.firstL : current.secondL));
    });
    const field = amountField.current;
    if (field) {
      field.focus();
      field.select();
    }
  };

  const save = async (data: FormData) => {
    const written = cow ? `${cow.name} ${cow.bellNumber}` : "";
    await saveRoundValues(data);
    setDone(written === "" ? null : `${written}: ${amount.replace(".", ",")} l`);
    setBell("");
    setAmount("");
    bellField.current?.focus();
  };

  const filled = mine.filter((entry) => {
    const value = values.get(entry.id);
    return (slot === "first" ? value?.firstL : value?.secondL) != null;
  }).length;

  return (
    <form
      action={save}
      className="stack-sm no-print"
      // Wie bei der Kuh-Maske: das selbsttätige Zurücksetzen nach der Aktion
      // würde Bauer und Gemelk mitnehmen, und die sollen stehen bleiben.
      onReset={(event) => event.preventDefault()}
    >
      <input type="hidden" name="roundId" value={roundId} />

      <div className="form-grid">
        {farmers.length > 1 ? (
          <div className="field">
            <label htmlFor="q-farmer">Bauer</label>
            <Dropdown
              id="q-farmer"
              onChange={(next) => {
                setFarmerId(next);
                setBell("");
                setAmount("");
                setDone(null);
              }}
              options={farmers.map((farmer) => ({
                label: farmer.name,
                value: String(farmer.id),
              }))}
              value={farmerId}
            />
          </div>
        ) : null}

        <div className="field">
          <label id="q-slot">Gemelk</label>
          <div aria-labelledby="q-slot" className="wahl" role="group">
            {(["first", "second"] as const).map((which) => (
              <button
                aria-pressed={slot === which}
                key={which}
                onClick={() => {
                  setSlot(which);
                  setAmount("");
                  setDone(null);
                }}
                type="button"
              >
                {which === "first" ? first : second}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="form-grid">
        <div className="field">
          <label htmlFor="q-bell">Glocke</label>
          <input
            autoComplete="off"
            className="num"
            disabled={farmerId === ""}
            id="q-bell"
            inputMode="numeric"
            onChange={(event) => setBell(event.target.value.replace(/\D/g, ""))}
            onKeyDown={(event) => {
              // Die Eingabetaste geht hier weiter und schickt nicht ab —
              // abgeschickt wird erst hinter der Menge.
              if (event.key !== "Enter") return;
              event.preventDefault();
              toAmount();
            }}
            placeholder={farmerId === "" ? "erst den Bauern" : "Nummer"}
            ref={bellField}
            value={bell}
          />
          <p className="small faint" style={{ marginTop: 4 }}>
            {farmerId === ""
              ? " "
              : bell.trim() === ""
                ? `${filled} von ${mine.length} eingetragen`
                : cow
                  ? cow.name
                  : "keine Kuh mit dieser Glocke"}
          </p>
        </div>

        <div className="field">
          <label htmlFor="q-amount">Menge in Litern</label>
          <input
            autoComplete="off"
            className="num"
            disabled={!cow}
            id="q-amount"
            inputMode="decimal"
            name={cow ? `${slot}_${cow.id}` : "menge"}
            onChange={(event) => setAmount(event.target.value)}
            placeholder="z. B. 11,3"
            ref={amountField}
            required
            value={amount}
          />
          <p className="small faint" style={{ marginTop: 4 }}>
            {done ?? " "}
          </p>
        </div>
      </div>

      {cow && current ? (
        <>
          <input type="hidden" name="cowId" value={cow.id} />
          {/* Das andere Gemelk fährt unverändert mit — sonst gälte es als
              nicht gemessen und wäre nach dem Speichern fort. */}
          <input
            type="hidden"
            name={`${other}_${cow.id}`}
            value={editable(other === "first" ? current.firstL : current.secondL)}
          />
        </>
      ) : null}

      <div className="row row-between">
        <p className="small faint">
          Glocke, Eingabetaste, Menge, Eingabetaste — danach steht der Schreibstrich wieder
          in der Glocke. Komma und Punkt gelten gleich.
        </p>
        <button className="btn-primary" disabled={!cow} type="submit">
          Übernehmen
        </button>
      </div>

      {farmerId !== "" ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Kuh</th>
                <th className="t-num">{first}</th>
                <th className="t-num">{second}</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((entry) => {
                const value = values.get(entry.id);
                return (
                  <tr key={entry.id}>
                    <td className={cow?.id === entry.id ? undefined : "muted"}>
                      <span className="bell">{entry.bellNumber}</span> {entry.name}
                    </td>
                    <td className={slot === "first" ? "t-num" : "t-num faint"}>
                      {value?.firstL == null ? "—" : liter(value.firstL)}
                    </td>
                    <td className={slot === "second" ? "t-num" : "t-num faint"}>
                      {value?.secondL == null ? "—" : liter(value.secondL)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : null}
    </form>
  );
}
