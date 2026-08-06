/**
 * Windows-Fassung vom Mac aus bauen.
 *
 *   npm run app:build:win
 *
 * `tauri build --runner cargo-xwin` allein genügt dafür nicht: auf diesem
 * Rechner stehen dem Bau drei Fallen im Weg, die alle nichts miteinander zu tun
 * haben und alle mit einer irreführenden Meldung enden. Dieses Skript räumt sie
 * aus dem Weg und ruft dann den gewöhnlichen Befehl auf.
 *
 *   1. Im Pfad steht das `rustc` von Homebrew vor dem von `rustup`. Jenes
 *      kennt nur das eigene Ziel — der Bau bricht mitten in den Abhängigkeiten
 *      mit `can't find crate for std` ab und rät, das Ziel zu installieren,
 *      obwohl es längst installiert ist, nur eben für die andere Werkzeugkette.
 *   2. Tauri ruft den NSIS-Übersetzer unter seinem Windows-Namen
 *      `makensis.exe` auf. Auf dem Mac heißt er `makensis`.
 *   3. Ohne gesetzte Spracheinstellung stürzt `makensis` beim Übersetzen ab —
 *      `std::bad_alloc`, an wechselnder Stelle, schon bei einem fünfzeiligen
 *      Skript. Ein alter Fehler in NSIS (Nr. 1165); die Homebrew-Formel setzt
 *      in ihrer eigenen Probe dagegen `LANG=en_GB.UTF-8`.
 *
 * Fehlt NSIS ganz, wird nur die Programmdatei gebaut und das gesagt — sie läuft
 * auch ohne Installationsprogramm.
 */
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync, rmSync, statSync, symlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const TARGET = "x86_64-pc-windows-msvc";
const ROOT = join(import.meta.dirname, "..");
const RELEASE = join(ROOT, "src-tauri", "target", TARGET, "release");
/** Liegt unter `target/`, ist also schon ignoriert und darf jederzeit weg. */
const SHIM_DIR = join(ROOT, "src-tauri", "target", "win-tools");

function fail(message: string): never {
  console.error(message);
  process.exit(1);
}

/** Der erste Treffer im Pfad, oder nichts. */
function which(command: string, path?: string): string | null {
  const found = spawnSync("which", [command], {
    encoding: "utf8",
    env: path ? { ...process.env, PATH: path } : process.env,
  });
  return found.status === 0 ? found.stdout.trim() : null;
}

// (1) Die Werkzeugkette von rustup nach vorn. `cargo-xwin` liegt ohnehin dort.
const cargoBin = join(homedir(), ".cargo", "bin");
if (!existsSync(join(cargoBin, "rustc"))) {
  fail(
    `Kein rustup gefunden (${cargoBin}/rustc fehlt).\n` +
      "Zu installieren über https://rustup.rs — das rustc von Homebrew genügt " +
      "nicht, es kann kein Windows bauen.",
  );
}
let path = `${cargoBin}:${process.env.PATH ?? ""}`;

// Das Ziel muss für genau diese Werkzeugkette installiert sein.
const sysroot = spawnSync("rustc", ["--print", "sysroot"], {
  encoding: "utf8",
  env: { ...process.env, PATH: path },
});
if (sysroot.status !== 0) fail("`rustc --print sysroot` ist fehlgeschlagen.");
if (!existsSync(join(sysroot.stdout.trim(), "lib", "rustlib", TARGET))) {
  fail(`Das Ziel fehlt. Einmalig: rustup target add ${TARGET}`);
}

if (!which("cargo-xwin", path)) {
  fail("`cargo-xwin` fehlt. Einmalig: cargo install cargo-xwin");
}

// (2) Der NSIS-Übersetzer unter dem Namen, unter dem Tauri ihn sucht.
const makensis = which("makensis", path);
if (makensis) {
  rmSync(SHIM_DIR, { recursive: true, force: true });
  mkdirSync(SHIM_DIR, { recursive: true });
  symlinkSync(makensis, join(SHIM_DIR, "makensis.exe"));
  path = `${SHIM_DIR}:${path}`;
} else {
  console.warn(
    "NSIS fehlt (brew install makensis) — es entsteht nur die Programmdatei,\n" +
      "kein Installationsprogramm.\n",
  );
}

// (3) Irgendeine UTF-8-Sprachumgebung, sonst stürzt makensis ab. Eine bereits
//     gesetzte wird nicht überschrieben.
const locale = process.env.LC_ALL || process.env.LANG || "";
const env = locale.toUpperCase().includes("UTF-8")
  ? { ...process.env, PATH: path }
  : { ...process.env, PATH: path, LANG: "en_GB.UTF-8", LC_ALL: "en_GB.UTF-8" };

const args = ["tauri", "build", "--runner", "cargo-xwin", "--target", TARGET];
if (!makensis) args.push("--no-bundle");
args.push(...process.argv.slice(2));

const build = spawnSync("npx", args, { cwd: ROOT, env, stdio: "inherit" });
if (build.status !== 0) process.exit(build.status ?? 1);

// Was dabei herausgekommen ist, mit Größe — sonst muss man danach suchen.
// Der Name des Installationsprogramms trägt die Fassungsnummer, also wird das
// Verzeichnis gelesen statt geraten.
const nsisDir = join(RELEASE, "bundle", "nsis");
const artifacts = [
  join(RELEASE, "milch.exe"),
  ...(existsSync(nsisDir) ? readdirSync(nsisDir).map((f) => join(nsisDir, f)) : []),
].filter(existsSync);
console.log("");
for (const file of artifacts) {
  const mb = (statSync(file).size / 1024 / 1024).toFixed(1);
  console.log(`${mb.padStart(6)} MB  ${file}`);
}
