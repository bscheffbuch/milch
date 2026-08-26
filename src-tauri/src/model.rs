//! Die Zeilenformen, wie die Oberfläche sie sieht.
//!
//! Jede Struktur wird als camelCase serialisiert und entspricht damit eins zu
//! eins den TypeScript-Schnittstellen in `lib/data/types.ts`. Wer hier ein Feld
//! ändert, ändert es dort mit.

use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Season {
    pub id: i64,
    pub name: String,
    pub start_date: String,
    pub end_date: String,
    pub is_active: i64,
    pub deduction_percent: f64,
    pub deduction_fixed_per_day: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Farmer {
    pub id: i64,
    pub name: String,
    pub contact: Option<String>,
    pub note: Option<String>,
    pub archived: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Cow {
    pub id: i64,
    pub farmer_id: i64,
    pub bell_number: String,
    pub name: String,
    pub note: Option<String>,
    pub archived: i64,
}

/// Kuh mit Bauern- und Saisondaten — die Form, die fast jede Ansicht braucht.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HerdCow {
    pub id: i64,
    pub farmer_id: i64,
    pub bell_number: String,
    pub name: String,
    pub note: Option<String>,
    pub archived: i64,
    pub farmer_name: String,
    pub cow_season_id: Option<i64>,
    pub arrival_date: Option<String>,
    pub arrival_slot: Option<String>,
    pub departure_date: Option<String>,
    pub departure_slot: Option<String>,
    pub dry_off_date: Option<String>,
    pub dry_off_slot: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CowSeason {
    pub id: i64,
    pub season_id: i64,
    pub cow_id: i64,
    pub farmer_id: i64,
    pub arrival_date: String,
    pub arrival_slot: String,
    pub departure_date: Option<String>,
    pub departure_slot: Option<String>,
    pub dry_off_date: Option<String>,
    pub dry_off_slot: Option<String>,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementRound {
    pub id: i64,
    pub season_id: i64,
    pub first_date: String,
    pub first_slot: String,
    pub note: Option<String>,
}

/// Messwert samt Datum seiner Messung — die Ansichten brauchen beides fast
/// immer zusammen, und der Verbund kostet in SQL nichts.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MeasurementValue {
    pub id: i64,
    pub round_id: i64,
    pub cow_id: i64,
    pub first_l: Option<f64>,
    pub second_l: Option<f64>,
    pub first_date: String,
    pub first_slot: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TreatmentType {
    pub id: i64,
    pub name: String,
    pub default_withhold_gemelke: i64,
    pub note: Option<String>,
    pub archived: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Treatment {
    pub id: i64,
    pub season_id: i64,
    pub cow_id: i64,
    pub type_id: Option<i64>,
    pub label: String,
    pub start_date: String,
    pub start_slot: String,
    /// Fehlt das Ende, läuft die Behandlung noch — sie sperrt bis auf Weiteres.
    pub end_date: Option<String>,
    pub end_slot: Option<String>,
    pub withhold_gemelke: i64,
    pub note: Option<String>,
}

/// Welche Kuh in welcher Saison stand — über alle Saisons hinweg, und nur die
/// beiden Kennungen. Der Schnappschuss führt sonst ausschließlich die aktive
/// Saison; wer Kühe aus der vorigen übernehmen will, muss aber wissen, wer
/// dort stand, und das sind zwei Zahlen je Kuh, keine ganze zweite Saison.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SeasonCow {
    pub season_id: i64,
    pub cow_id: i64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheeseProduction {
    pub id: i64,
    pub season_id: i64,
    pub date: String,
    pub kg: f64,
    pub note: Option<String>,
}

/// Käse, den die Alp selbst hergibt — ein Eintrag je Entnahme, ohne Datum.
///
/// Anders als eine Abholung gehört er keinem Bauern: er wird am Ende von dem
/// abgezogen, was zu verteilen ist, und damit von allen getragen.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AlpCheese {
    pub id: i64,
    pub season_id: i64,
    pub kg: f64,
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pickup {
    pub id: i64,
    pub season_id: i64,
    pub farmer_id: i64,
    pub date: String,
    pub kg: f64,
    pub wheels: Option<i64>,
    pub note: Option<String>,
}

/// Ein abgelegtes Backup, wie es im Backup-Ordner liegt.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BackupFile {
    pub name: String,
    pub path: String,
    pub bytes: i64,
    /// Ortszeit als 'YYYY-MM-DD HH:MM'.
    pub saved_at: String,
}

/// Der Zustand der Datei selbst — nicht ihres Inhalts.
///
/// Der Pfad steht daneben in [`Snapshot::db_path`] und nicht noch einmal hier:
/// wo die Datenbank liegt, ist eine Angabe, kein Zustand.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DbFile {
    pub bytes: i64,
    pub saved_at: String,
    pub backup_dir: String,
    /// Neueste zuerst.
    pub backups: Vec<BackupFile>,
    /// Ob vor größeren Änderungen von selbst gesichert wird.
    pub auto: bool,
    /// So viele selbsttätige Backups bleiben liegen.
    pub auto_keep: i64,
}

/// Alles, was die Oberfläche über die laufende Saison wissen muss, in einem
/// Stück.
///
/// Ein Alpsommer umfasst ein paar Dutzend Kühe und ein paar hundert Zeilen —
/// das passt mühelos in einen Zug. Dafür braucht die Oberfläche keine zweite
/// Abfrage: sie rechnet ihre gesamte Auswertung aus diesem einen Stand, und
/// nach jeder Änderung kommt der Stand vollständig neu.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Snapshot {
    pub db_path: String,
    pub db: DbFile,
    pub seasons: Vec<Season>,
    /// Aktive Saison, ersatzweise die neueste. Nur bei leerer Datenbank `None`.
    pub season: Option<Season>,
    pub farmers: Vec<Farmer>,
    pub cows: Vec<Cow>,
    pub herd: Vec<HerdCow>,
    pub cow_seasons: Vec<CowSeason>,
    /// Die Zugehörigkeit über alle Saisons — für die Übernahme in eine neue.
    pub season_cows: Vec<SeasonCow>,
    pub rounds: Vec<MeasurementRound>,
    pub values: Vec<MeasurementValue>,
    pub treatment_types: Vec<TreatmentType>,
    pub treatments: Vec<Treatment>,
    pub production: Vec<CheeseProduction>,
    pub alp_cheese: Vec<AlpCheese>,
    pub pickups: Vec<Pickup>,
}

/// Antwort einer Änderung: der frische Stand, dazu die Kennung eines neu
/// angelegten Eintrags, falls die Oberfläche gleich dorthin springen will.
///
/// `notice` bleibt leer, wo das Ergebnis schon auf dem Bildschirm steht. Wer
/// ein Backup schreibt, sieht davon aber nichts — dort steht dann, wohin.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CommandResult {
    pub snapshot: Snapshot,
    pub inserted_id: Option<i64>,
    pub notice: Option<String>,
}
