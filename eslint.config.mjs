import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Baugut von Rust. Darin liegt unter anderem die eingebackene Oberfläche
    // noch einmal als Datei — geprüft wäre sie ein zweites Mal dieselbe, und
    // die Prüfung stolperte über das, was der Bau daraus gemacht hat.
    "src-tauri/target/**",
  ]),
]);

export default eslintConfig;
