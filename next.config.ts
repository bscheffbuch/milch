import type { NextConfig } from "next";

/*
  Die Oberfläche wird zu reinen Dateien gebaut und von Tauri aus dem Programm
  heraus ausgeliefert — es gibt keinen Server, der zur Laufzeit etwas rechnet.
  Alle Daten kommen aus der Rust-Schicht.

  `trailingSlash` legt jede Seite als eigenen Ordner mit `index.html` ab. Ohne
  das entstünde `bauern.html`, was ein Dateiprotokoll ohne Umschreiberegeln
  nicht findet; Adressen wie `/bauern/` funktionieren dagegen überall.
*/
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
