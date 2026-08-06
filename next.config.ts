import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Tauri lädt die Oberfläche im Produktionsbetrieb nicht von einem Server,
  // sondern direkt als Dateien aus dem App-Bundle. Deshalb muß Next.js hier
  // statisch exportieren: `next build` legt dann einen Ordner `out/` an, den
  // `src-tauri/tauri.conf.json` unter `build.frontendDist` einbindet.
  //
  // Der Preis dafür ist, daß alles wegfällt, was einen Node-Server bräuchte:
  // Server Actions, Route Handler mit Zugriff auf den Request, Cookies,
  // Rewrites, Redirects, Headers und ISR. Wer so etwas später braucht, muß
  // entweder auf einen externen Dienst ausweichen oder die Logik in Rust in
  // `src-tauri/` als Tauri-Command umziehen.
  output: "export",

  images: {
    // Die Bildoptimierung von Next.js läuft zur Laufzeit auf dem Server. Den
    // gibt es hier nicht, und ohne diese Zeile bricht `next build` deshalb mit
    // einer Fehlermeldung über den Standard-Loader ab. Die Bilder werden damit
    // einfach unverändert ausgeliefert — im Desktop-Bundle liegen sie ohnehin
    // schon lokal, es gibt also nichts zu sparen.
    unoptimized: true,
  },
};

export default nextConfig;
