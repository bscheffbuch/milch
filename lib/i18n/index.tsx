"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useSyncExternalStore,
} from "react";

import {
  DEFAULT_LANGUAGE,
  DICTIONARIES,
  translator,
  type Language,
  type Translator,
} from "@/lib/i18n/text";

export {
  DEFAULT_LANGUAGE,
  LANGUAGE_NAMES,
  translate,
  translateCount,
  translator,
  type CountKey,
  type Dictionary,
  type Key,
  type Language,
  type Translator,
  type Values,
} from "@/lib/i18n/text";

/*
  Der Rahmen um die Sprache
  =========================

  Das Wörterbuch und das Einsetzen stehen nebenan in `text.ts` und kommen ohne
  React aus — deshalb lassen sie sich in `test/i18n.test.ts` geradeheraus prüfen.
  Hier steht nur, woher die laufende Sprache kommt und wie eine Ansicht an sie
  herankommt.
*/

interface Sprachlage {
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translator;
}

const Kontext = createContext<Sprachlage | null>(null);

const SPEICHER = "milch.language";

/*
  Die gewählte Sprache liegt im `localStorage` und damit außerhalb von React.
  Gelesen wird sie deshalb über `useSyncExternalStore` und nicht in einem
  Effekt, der danach den Zustand setzt: der statische Export bringt die
  Vorgabesprache mit, und React weiß bei diesem Weg selbst, dass der erste
  Anstrich im Browser noch der vom Bau ist und der gemerkte Wert erst danach
  gilt. Wer eine andere Sprache gewählt hat, sieht dadurch für einen Moment die
  Vorgabe — die Alternative wäre ein Skript im Kopf wie bei den eingeklappten
  Bereichen, aber das setzt dort ein Attribut und müsste hier die halbe
  Oberfläche kennen.
*/

const hoerer = new Set<() => void>();

function abonnieren(melden: () => void): () => void {
  hoerer.add(melden);
  // Dasselbe Programm kann in zwei Fenstern stehen; `storage` meldet die
  // Änderung aus dem anderen.
  window.addEventListener("storage", melden);
  return () => {
    hoerer.delete(melden);
    window.removeEventListener("storage", melden);
  };
}

function gemerkteSprache(): Language {
  try {
    const gespeichert = localStorage.getItem(SPEICHER);
    if (gespeichert && gespeichert in DICTIONARIES) return gespeichert as Language;
  } catch {
    // Ohne Speicher gilt die Vorgabe.
  }
  return DEFAULT_LANGUAGE;
}

/** Beim Bauen gibt es keinen Speicher — dort gilt die Vorgabe. */
function vorgabe(): Language {
  return DEFAULT_LANGUAGE;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const language = useSyncExternalStore(abonnieren, gemerkteSprache, vorgabe);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  const setLanguage = useCallback((next: Language) => {
    try {
      localStorage.setItem(SPEICHER, next);
    } catch {
      // Ohne Speicher bliebe die Wahl folgenlos — dann lieber gar nicht melden.
      return;
    }
    for (const melden of hoerer) melden();
  }, []);

  const wert = useMemo<Sprachlage>(
    () => ({ language, setLanguage, t: translator(DICTIONARIES[language]) }),
    [language, setLanguage],
  );

  return <Kontext.Provider value={wert}>{children}</Kontext.Provider>;
}

function useSprachlage(): Sprachlage {
  const gefunden = useContext(Kontext);
  if (gefunden) return gefunden;

  /*
    Ohne Provider bleibt es bei der Vorgabesprache, statt dass eine Ansicht mit
    einem Fehler abbricht. Ein fehlender Rahmen soll auffallen, aber nicht die
    ganze Oberfläche kosten — und in den Tests steht so kein Provider nur der
    Texte wegen herum.
  */
  return {
    language: DEFAULT_LANGUAGE,
    setLanguage: () => {},
    t: translator(DICTIONARIES[DEFAULT_LANGUAGE]),
  };
}

/** Der Text zu einem Schlüssel. Das übliche Werkzeug in einer Ansicht. */
export function useT(): Translator {
  return useSprachlage().t;
}

/** Welche Sprache läuft und wie sie sich wechseln lässt — für die Einstellungen. */
export function useLanguage(): Pick<Sprachlage, "language" | "setLanguage"> {
  const { language, setLanguage } = useSprachlage();
  return { language, setLanguage };
}
