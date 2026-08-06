"use client";

import { useState } from "react";

/*
  Eine Rückfrage, die an Ort und Stelle bleibt.

  Der erste Klick ersetzt die Schaltfläche durch die Frage, den zweiten trägt
  sie aus. Kein Fenster springt auf: ein Dialog, den man wegklickt, ohne ihn
  zu lesen, hat nichts geprüft — die Frage an derselben Stelle zwingt dazu,
  ein zweites Mal genau dorthin zu zielen.

  Ausgelöst wird ganz normal abgeschickt. Der bestätigende Knopf ist der
  Absendeknopf des umgebenden Formulars, damit dessen versteckte Felder
  mitgehen und die Wege sich nicht unterscheiden.

  Beide Zustände stehen deshalb dauerhaft im Baum und werden nur versteckt.
  Ausgetauscht wäre der bestätigende Knopf mitten im eigenen Klick aus der
  Seite verschwunden — und ein Knopf, der nicht mehr dasteht, schickt auch
  nichts mehr ab.
*/

export default function Confirm({
  label,
  question,
  confirm,
  danger,
}: {
  label: string;
  question: string;
  confirm: string;
  /** Was nicht rückgängig zu machen ist, trägt den roten Ton. */
  danger?: boolean;
}) {
  const [armed, setArmed] = useState(false);

  return (
    <>
      <button
        className={danger ? "btn-quiet btn-sm btn-danger" : "btn-quiet btn-sm"}
        hidden={armed}
        onClick={() => setArmed(true)}
        type="button"
      >
        {label}
      </button>
      <span className="confirm" hidden={!armed}>
        <span className="small muted">{question}</span>
        <button className="btn-quiet btn-sm" onClick={() => setArmed(false)} type="button">
          Abbrechen
        </button>
        <button
          className={danger ? "btn-sm btn-danger-solid" : "btn-sm btn-primary"}
          onClick={() => setArmed(false)}
          type="submit"
        >
          {confirm}
        </button>
      </span>
    </>
  );
}
