"use client";

import { useRouter } from "next/navigation";
import { useMemo } from "react";

import { dayRange, isoFromDayIndex, type Slot } from "@/lib/gemelk";
import { roundHref } from "@/lib/routes";
import { parseSelection } from "@/lib/selection";

import { useData } from "./store";

/*
  Die Aufträge hinter den Masken
  ==============================

  Jede Maske schickt ihr Formular hierher. Was hier passiert, ist Auslegung:
  Kommas werden zu Punkten, leere Felder zu "nicht angegeben", Tage zu
  Gemelken. Was danach in die Datenbank geht, entscheidet die Rust-Schicht —
  sie bekommt fertige Werte und keine Formulare.

  Die Namen sind dieselben geblieben, die die Seiten schon kannten.
*/

/* ------------------------------------------------------------------ Helfer */

function str(data: FormData, key: string): string {
  return String(data.get(key) ?? "").trim();
}

function optStr(data: FormData, key: string): string | null {
  const value = str(data, key);
  return value === "" ? null : value;
}

function num(data: FormData, key: string, fallback = 0): number {
  const raw = str(data, key).replace(",", ".");
  if (raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
}

function optNum(data: FormData, key: string): number | null {
  const raw = str(data, key).replace(",", ".");
  if (raw === "") return null;
  const value = Number(raw);
  return Number.isFinite(value) ? value : null;
}

function int(data: FormData, key: string, fallback = 0): number {
  return Math.round(num(data, key, fallback));
}

function slot(data: FormData, key: string, fallback: Slot = "AM"): Slot {
  return str(data, key) === "PM" ? "PM" : str(data, key) === "AM" ? "AM" : fallback;
}

/** Die Wartezeit wird in Gemelken geführt; eingegeben werden darf beides. */
function withholdGemelke(data: FormData, fallback = 0): number {
  const gemelke =
    str(data, "unit") === "days"
      ? Math.round(num(data, "withhold") * 2)
      : int(data, "withhold", fallback);
  return Math.max(0, gemelke);
}

export type Action = (data: FormData) => Promise<void>;

export function useActions() {
  const { run, view } = useData();
  const router = useRouter();

  return useMemo(() => {
    /* ---------------------------------------------------------- Bauern */

    const createFarmer: Action = async (data) => {
      const name = str(data, "name");
      if (!name) return;
      await run("createFarmer", {
        name,
        contact: optStr(data, "contact"),
        note: optStr(data, "note"),
      });
    };

    const updateFarmer: Action = async (data) => {
      const id = int(data, "id");
      const name = str(data, "name");
      if (!id || !name) return;
      await run("updateFarmer", {
        id,
        name,
        contact: optStr(data, "contact"),
        note: optStr(data, "note"),
      });
    };

    const setFarmerArchived: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("setFarmerArchived", {
        id,
        archived: str(data, "archived") === "1" ? 1 : 0,
      });
    };

    /* ------------------------------------------------------------ Kühe */

    const createCow: Action = async (data) => {
      const farmerId = int(data, "farmerId");
      const bellNumber = str(data, "bellNumber");
      const name = str(data, "name");
      if (!farmerId || !bellNumber || !name) return;

      // Eine neu angelegte Kuh nimmt normalerweise sofort an der Saison teil.
      await run("createCow", {
        farmerId,
        bellNumber,
        name,
        note: optStr(data, "note"),
        seasonId: int(data, "seasonId") || null,
        arrivalDate: optStr(data, "arrivalDate"),
        arrivalSlot: slot(data, "arrivalSlot"),
      });
    };

    const updateCow: Action = async (data) => {
      const id = int(data, "id");
      const farmerId = int(data, "farmerId");
      if (!id || !farmerId) return;
      await run("updateCow", {
        id,
        farmerId,
        bellNumber: str(data, "bellNumber"),
        name: str(data, "name"),
        note: optStr(data, "note"),
      });
    };

    const setCowArchived: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("setCowArchived", {
        id,
        archived: str(data, "archived") === "1" ? 1 : 0,
      });
    };

    /**
     * Teilnahme einer Kuh an der Saison: Auftrieb, Abtrieb, Trockenstellen.
     * Ohne Auftriebsdatum wird der Saisoneintrag entfernt — die Kuh war dann
     * schlicht nicht auf der Alp.
     */
    const saveCowSeason: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const cowId = int(data, "cowId");
      if (!seasonId || !cowId) return;

      const departureDate = optStr(data, "departureDate");
      const dryOffDate = optStr(data, "dryOffDate");

      await run("saveCowSeason", {
        seasonId,
        cowId,
        farmerId: int(data, "farmerId"),
        arrivalDate: optStr(data, "arrivalDate"),
        arrivalSlot: slot(data, "arrivalSlot"),
        departureDate,
        departureSlot: departureDate ? slot(data, "departureSlot", "PM") : null,
        dryOffDate,
        dryOffSlot: dryOffDate ? slot(data, "dryOffSlot", "PM") : null,
        note: optStr(data, "note"),
      });
    };

    /* ------------------------------------------------------- Messungen */

    const createRound: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const firstDate = str(data, "firstDate");
      if (!seasonId || !firstDate) return;

      const id = await run("createRound", {
        seasonId,
        firstDate,
        firstSlot: slot(data, "firstSlot"),
        note: optStr(data, "note"),
      });
      if (id) router.push(roundHref(id));
    };

    const updateRound: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("updateRound", {
        id,
        firstDate: str(data, "firstDate"),
        firstSlot: slot(data, "firstSlot"),
        note: optStr(data, "note"),
      });
    };

    /**
     * Speichert alle Messwerte einer Messung in einem Zug. Leere Felder
     * bedeuten "nicht gemessen" und werden entfernt, nicht als 0 abgelegt.
     */
    const saveRoundValues: Action = async (data) => {
      const roundId = int(data, "roundId");
      if (!roundId) return;

      const values = data
        .getAll("cowId")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0)
        .map((cowId) => ({
          cowId,
          firstL: optNum(data, `first_${cowId}`),
          secondL: optNum(data, `second_${cowId}`),
        }));

      await run("saveRoundValues", { roundId, values });
    };

    const deleteRound: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("deleteRound", { id });
      router.push("/messung/");
    };

    /* ----------------------------------------------------- Behandlungen */

    const createTreatment: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const cowId = int(data, "cowId");
      const startDate = str(data, "startDate");
      if (!seasonId || !cowId || !startDate) return;

      const typeId = int(data, "typeId") || null;
      const type = view?.treatmentTypes.find((entry) => entry.id === typeId);

      /*
        Drei Fälle, ein Feld: „einmalig“ endet auf demselben Gemelk, „mehrere“
        auf dem angegebenen, und „läuft noch“ endet vorerst gar nicht — dort
        bleibt das Ende leer, bis die Behandlung tatsächlich abgeschlossen ist.
      */
      const mode = str(data, "mode");
      const endDate = optStr(data, "endDate");
      const open = mode === "open";

      await run("createTreatment", {
        seasonId,
        cowId,
        typeId,
        label: str(data, "label") || type?.name || "Behandlung",
        startDate,
        startSlot: slot(data, "startSlot"),
        endDate: open ? null : (endDate ?? startDate),
        endSlot: open
          ? null
          : endDate
            ? slot(data, "endSlot", "PM")
            : slot(data, "startSlot"),
        withholdGemelke: withholdGemelke(data, type?.defaultWithholdGemelke ?? 0),
        note: optStr(data, "note"),
      });
    };

    /** Setzt das Ende einer laufenden Behandlung — ab hier zählt die Wartezeit. */
    const endTreatment: Action = async (data) => {
      const id = int(data, "id");
      const endDate = str(data, "endDate");
      if (!id || !endDate) return;
      await run("endTreatment", {
        id,
        endDate,
        endSlot: slot(data, "endSlot", "PM"),
      });
    };

    const deleteTreatment: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("deleteTreatment", { id });
    };

    const saveTreatmentType: Action = async (data) => {
      const name = str(data, "name");
      if (!name) return;
      await run("saveTreatmentType", {
        id: int(data, "id") || null,
        name,
        withholdGemelke: withholdGemelke(data),
        note: optStr(data, "note"),
      });
    };

    const setTreatmentTypeArchived: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("setTreatmentTypeArchived", {
        id,
        archived: str(data, "archived") === "1" ? 1 : 0,
      });
    };

    /* --------------------------------------------------- Käseproduktion */

    const saveProduction: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const date = str(data, "date");
      if (!seasonId || !date) return;
      await run("saveProduction", {
        seasonId,
        date,
        kg: optNum(data, "kg"),
        note: optStr(data, "note"),
      });
    };

    /**
     * Derselbe Wert für die im Kalender ausgewählten Tage. Die Tage stehen in
     * derselben Kurzschreibweise wie in der Adresse — `von..bis` für
     * zusammenhängende Abschnitte, sonst durch Komma getrennt.
     */
    const saveProductionDays: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const dates = parseSelection(str(data, "dates"));
      const kg = optNum(data, "kg");
      if (!seasonId || dates.length === 0 || kg === null) return;

      await run("saveProductionDays", { seasonId, dates, kg });
    };

    /** Trägt für eine ganze Woche denselben Wert ein — spart Tipparbeit. */
    const saveProductionRange: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const fromDate = str(data, "fromDate");
      const toDate = str(data, "toDate");
      const kg = optNum(data, "kg");
      if (!seasonId || !fromDate || !toDate || kg === null || toDate < fromDate) return;

      await run("saveProductionDays", {
        seasonId,
        dates: dayRange(fromDate, toDate).map(isoFromDayIndex),
        kg,
      });
    };

    /* ------------------------------------------------------- Abholungen */

    const createPickup: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const farmerId = int(data, "farmerId");
      const date = str(data, "date");
      const kg = optNum(data, "kg");
      if (!seasonId || !farmerId || !date || kg === null) return;

      await run("createPickup", {
        seasonId,
        farmerId,
        date,
        kg,
        wheels: optNum(data, "wheels"),
        note: optStr(data, "note"),
      });
    };

    const deletePickup: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("deletePickup", { id });
    };

    /* ----------------------------------------------------------- Saison */

    const updateSeason: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("updateSeason", {
        id,
        name: str(data, "name"),
        startDate: str(data, "startDate"),
        endDate: str(data, "endDate"),
        // Im Formular steht ein Prozentwert, gerechnet wird mit dem Anteil.
        deductionPercent: num(data, "deductionPercent") / 100,
        deductionFixedPerDay: num(data, "deductionFixedPerDay"),
      });
    };

    const createSeason: Action = async (data) => {
      const name = str(data, "name");
      const startDate = str(data, "startDate");
      const endDate = str(data, "endDate");
      if (!name || !startDate || !endDate) return;
      await run("createSeason", { name, startDate, endDate });
    };

    const activateSeason: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("activateSeason", { id });
    };

    const deleteSeason: Action = async (data) => {
      const id = int(data, "id");
      if (!id) return;
      await run("deleteSeason", { id });
    };

    /**
     * Übernimmt ausgewählte Kühe aus einer früheren Saison. Die Stammdaten
     * bleiben dieselbe Kuh — übernommen wird nur die Teilnahme, mit dem Auftrieb
     * als frühestem Datum der neuen Saison.
     */
    const carryOverCows: Action = async (data) => {
      const seasonId = int(data, "seasonId");
      const fromSeasonId = int(data, "fromSeasonId");
      const cowIds = data
        .getAll("cowId")
        .map((value) => Number(value))
        .filter((value) => Number.isInteger(value) && value > 0);
      if (!seasonId || !fromSeasonId || cowIds.length === 0) return;

      await run("carryOverCows", {
        seasonId,
        fromSeasonId,
        cowIds,
        arrivalDate: optStr(data, "arrivalDate"),
        arrivalSlot: slot(data, "arrivalSlot", "AM"),
      });
    };

    /* ------------------------------------------------------------- Datei */

    /*
      Die Aufträge, die die Datei anfassen und nicht ihren Inhalt. Sie geben
      Pfade weiter, keine Dateien: die Datenschicht liegt auf demselben
      Rechner, und ein Pfad überlebt beide Wege dorthin — Tauris IPC im
      fertigen Programm und den kleinen Dienst während der Entwicklung.
    */

    /** Ohne Ziel entsteht ein Backup im Ordner neben der Datenbank. */
    const exportDb: Action = async (data) => {
      await run("exportDb", { target: optStr(data, "target") });
    };

    const importDb: Action = async (data) => {
      const source = str(data, "source");
      if (!source) return;
      await run("importDb", { source });
    };

    const deleteBackup: Action = async (data) => {
      const path = str(data, "path");
      if (!path) return;
      await run("deleteBackup", { path });
    };

    /*
      Den Ordner öffnet das Betriebssystem, nicht die Oberfläche: eine WebView
      darf das nicht, und soll es auch nicht. Die Datenschicht lässt dabei nur
      die Datenbank und ihren Backup-Ordner zu.
    */
    const revealPath: Action = async (data) => {
      const path = str(data, "path");
      if (!path) return;
      await run("revealPath", { path });
    };

    const setAutoBackup: Action = async (data) => {
      await run("setAutoBackup", { on: str(data, "on") === "1" });
    };

    return {
      createFarmer,
      updateFarmer,
      setFarmerArchived,
      createCow,
      updateCow,
      setCowArchived,
      saveCowSeason,
      createRound,
      updateRound,
      saveRoundValues,
      deleteRound,
      createTreatment,
      endTreatment,
      deleteTreatment,
      saveTreatmentType,
      setTreatmentTypeArchived,
      saveProduction,
      saveProductionDays,
      saveProductionRange,
      createPickup,
      deletePickup,
      updateSeason,
      createSeason,
      activateSeason,
      deleteSeason,
      carryOverCows,
      exportDb,
      importDb,
      deleteBackup,
      revealPath,
      setAutoBackup,
    };
  }, [router, run, view]);
}
