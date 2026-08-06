import type { Metadata } from "next";

import { InlineScript } from "@/components/InlineScript";
import Shell from "@/components/Shell";
import { COLLAPSE_INIT_SCRIPT } from "@/lib/collapse";

import "./globals.css";

export const metadata: Metadata = {
  title: "Alpabrechnung",
  description: "Milchmessung und Käseverteilung für die Alpsaison",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    /* Das Skript im Kopf setzt die `data-`Attribute der eingeklappten Bereiche
       am Dokument — davon weiß React nichts. */
    <html lang="de" suppressHydrationWarning>
      <head>
        <InlineScript html={COLLAPSE_INIT_SCRIPT} />
      </head>
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
