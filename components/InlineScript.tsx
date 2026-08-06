"use client";

/**
 * Ein Skript, das der Browser beim Auslesen des HTML sofort ausführt — vor dem
 * ersten Anstrich. So steht ein gespeicherter Zustand schon fest, bevor
 * überhaupt etwas zu sehen ist.
 *
 * Beim Nachrendern im Browser wird aus dem Typ `text/plain`: React führt
 * eingefügte Skripte ohnehin nicht aus und würde sonst nur warnen. Damit dieser
 * Unterschied überhaupt entstehen kann, muss der Baustein im Browser laufen —
 * ein reiner Serverbaustein kennt kein `window` und bliebe immer beim
 * ausführbaren Typ. `suppressHydrationWarning` deckt den Unterschied ab.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
