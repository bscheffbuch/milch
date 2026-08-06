//! Schreiben: eine benannte Anweisung je Eingabemaske.
//!
//! Die Anweisungen sind absichtlich stumpf. Sie prüfen, was die Datenbank
//! zusammenhalten muss, und legen ab — was eine Wartezeit in Gemelken bedeutet
//! oder welcher Name einer Behandlung voreingestellt ist, entscheidet die
//! Maske, die es dem Benutzer auch zeigt.

use rusqlite::{params, Connection};
use serde::Deserialize;
use serde_json::Value;

type Cmd = Result<Option<i64>, String>;

fn parse<T: for<'de> Deserialize<'de>>(payload: Value) -> Result<T, String> {
    serde_json::from_value(payload).map_err(|error| error.to_string())
}

fn sql(result: rusqlite::Result<usize>) -> Cmd {
    result.map(|_| None).map_err(|error| error.to_string())
}

/* ------------------------------------------------------------------ Bauern */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct FarmerInput {
    #[serde(default)]
    id: Option<i64>,
    name: String,
    #[serde(default)]
    contact: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ArchiveInput {
    id: i64,
    archived: i64,
}

/* -------------------------------------------------------------------- Kühe */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CowInput {
    #[serde(default)]
    id: Option<i64>,
    farmer_id: i64,
    bell_number: String,
    name: String,
    #[serde(default)]
    note: Option<String>,
    /// Nur beim Anlegen: die Kuh nimmt sofort an der Saison teil.
    #[serde(default)]
    season_id: Option<i64>,
    #[serde(default)]
    arrival_date: Option<String>,
    #[serde(default)]
    arrival_slot: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CowSeasonInput {
    season_id: i64,
    cow_id: i64,
    farmer_id: i64,
    #[serde(default)]
    arrival_date: Option<String>,
    #[serde(default)]
    arrival_slot: Option<String>,
    #[serde(default)]
    departure_date: Option<String>,
    #[serde(default)]
    departure_slot: Option<String>,
    #[serde(default)]
    dry_off_date: Option<String>,
    #[serde(default)]
    dry_off_slot: Option<String>,
    #[serde(default)]
    note: Option<String>,
}

/* --------------------------------------------------------------- Messungen */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoundInput {
    #[serde(default)]
    id: Option<i64>,
    #[serde(default)]
    season_id: Option<i64>,
    first_date: String,
    first_slot: String,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoundValuesInput {
    round_id: i64,
    values: Vec<RoundValue>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RoundValue {
    cow_id: i64,
    #[serde(default)]
    first_l: Option<f64>,
    #[serde(default)]
    second_l: Option<f64>,
}

/* ------------------------------------------------------------ Behandlungen */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreatmentInput {
    season_id: i64,
    cow_id: i64,
    #[serde(default)]
    type_id: Option<i64>,
    label: String,
    start_date: String,
    start_slot: String,
    /// Fehlt das Ende, läuft die Behandlung noch.
    #[serde(default)]
    end_date: Option<String>,
    #[serde(default)]
    end_slot: Option<String>,
    withhold_gemelke: i64,
    #[serde(default)]
    note: Option<String>,
}

/// Eine laufende Behandlung abschließen — nur das Ende, alles andere steht.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreatmentEndInput {
    id: i64,
    end_date: String,
    #[serde(default)]
    end_slot: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct TreatmentTypeInput {
    #[serde(default)]
    id: Option<i64>,
    name: String,
    withhold_gemelke: i64,
    #[serde(default)]
    note: Option<String>,
}

/* ------------------------------------------- Käseproduktion und Abholungen */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductionInput {
    season_id: i64,
    date: String,
    /// Kein Wert bedeutet: an diesem Tag wurde nichts eingetragen.
    #[serde(default)]
    kg: Option<f64>,
    #[serde(default)]
    note: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProductionDaysInput {
    season_id: i64,
    dates: Vec<String>,
    kg: f64,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct PickupInput {
    season_id: i64,
    farmer_id: i64,
    date: String,
    kg: f64,
    #[serde(default)]
    wheels: Option<i64>,
    #[serde(default)]
    note: Option<String>,
}

/* ------------------------------------------------------------------ Saison */

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct CarryOverInput {
    season_id: i64,
    from_season_id: i64,
    cow_ids: Vec<i64>,
    #[serde(default)]
    arrival_date: Option<String>,
    #[serde(default)]
    arrival_slot: Option<String>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct SeasonInput {
    #[serde(default)]
    id: Option<i64>,
    name: String,
    start_date: String,
    end_date: String,
    #[serde(default)]
    deduction_percent: f64,
    #[serde(default)]
    deduction_fixed_per_day: f64,
}

#[derive(Deserialize)]
struct IdInput {
    id: i64,
}

/// Führt eine benannte Anweisung aus. Unbekannte Namen sind ein Fehler und
/// keine stille Nichtoperation — sonst verschwände ein Tippfehler spurlos.
pub fn dispatch(conn: &Connection, name: &str, payload: Value) -> Cmd {
    match name {
        "createFarmer" => {
            let input: FarmerInput = parse(payload)?;
            conn.execute(
                "INSERT INTO farmers (name, contact, note) VALUES (?1, ?2, ?3)",
                params![input.name, input.contact, input.note],
            )
            .map_err(|error| error.to_string())?;
            Ok(Some(conn.last_insert_rowid()))
        }

        "updateFarmer" => {
            let input: FarmerInput = parse(payload)?;
            let id = input.id.ok_or("Bauer ohne Kennung")?;
            sql(conn.execute(
                "UPDATE farmers SET name = ?1, contact = ?2, note = ?3 WHERE id = ?4",
                params![input.name, input.contact, input.note, id],
            ))
        }

        "setFarmerArchived" => {
            let input: ArchiveInput = parse(payload)?;
            sql(conn.execute(
                "UPDATE farmers SET archived = ?1 WHERE id = ?2",
                params![input.archived, input.id],
            ))
        }

        "createCow" => {
            let input: CowInput = parse(payload)?;
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            tx.execute(
                "INSERT INTO cows (farmer_id, bell_number, name, note) VALUES (?1, ?2, ?3, ?4)",
                params![input.farmer_id, input.bell_number, input.name, input.note],
            )
            .map_err(to_text)?;
            let cow_id = tx.last_insert_rowid();

            if let (Some(season_id), Some(arrival_date)) = (input.season_id, input.arrival_date) {
                tx.execute(
                    "INSERT INTO cow_seasons (season_id, cow_id, farmer_id, arrival_date, arrival_slot)
                     VALUES (?1, ?2, ?3, ?4, ?5)",
                    params![
                        season_id,
                        cow_id,
                        input.farmer_id,
                        arrival_date,
                        input.arrival_slot.as_deref().unwrap_or("AM")
                    ],
                )
                .map_err(to_text)?;
            }
            tx.commit().map_err(to_text)?;
            Ok(Some(cow_id))
        }

        "updateCow" => {
            let input: CowInput = parse(payload)?;
            let id = input.id.ok_or("Kuh ohne Kennung")?;
            sql(conn.execute(
                "UPDATE cows SET farmer_id = ?1, bell_number = ?2, name = ?3, note = ?4
                 WHERE id = ?5",
                params![
                    input.farmer_id,
                    input.bell_number,
                    input.name,
                    input.note,
                    id
                ],
            ))
        }

        "setCowArchived" => {
            let input: ArchiveInput = parse(payload)?;
            sql(conn.execute(
                "UPDATE cows SET archived = ?1 WHERE id = ?2",
                params![input.archived, input.id],
            ))
        }

        // Ohne Auftriebsdatum wird der Saisoneintrag entfernt — die Kuh war
        // dann schlicht nicht auf der Alp.
        "saveCowSeason" => {
            let input: CowSeasonInput = parse(payload)?;
            let Some(arrival_date) = input.arrival_date else {
                return sql(conn.execute(
                    "DELETE FROM cow_seasons WHERE season_id = ?1 AND cow_id = ?2",
                    params![input.season_id, input.cow_id],
                ));
            };
            sql(conn.execute(
                "INSERT INTO cow_seasons (season_id, cow_id, farmer_id, arrival_date, arrival_slot,
                                          departure_date, departure_slot, dry_off_date, dry_off_slot, note)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)
                 ON CONFLICT (season_id, cow_id) DO UPDATE SET
                   farmer_id = excluded.farmer_id,
                   arrival_date = excluded.arrival_date,
                   arrival_slot = excluded.arrival_slot,
                   departure_date = excluded.departure_date,
                   departure_slot = excluded.departure_slot,
                   dry_off_date = excluded.dry_off_date,
                   dry_off_slot = excluded.dry_off_slot,
                   note = excluded.note",
                params![
                    input.season_id,
                    input.cow_id,
                    input.farmer_id,
                    arrival_date,
                    input.arrival_slot.as_deref().unwrap_or("AM"),
                    input.departure_date,
                    input.departure_slot,
                    input.dry_off_date,
                    input.dry_off_slot,
                    input.note
                ],
            ))
        }

        "createRound" => {
            let input: RoundInput = parse(payload)?;
            let season_id = input.season_id.ok_or("Messung ohne Saison")?;
            conn.execute(
                "INSERT INTO measurement_rounds (season_id, first_date, first_slot, note)
                 VALUES (?1, ?2, ?3, ?4)",
                params![season_id, input.first_date, input.first_slot, input.note],
            )
            .map_err(to_text)?;
            Ok(Some(conn.last_insert_rowid()))
        }

        "updateRound" => {
            let input: RoundInput = parse(payload)?;
            let id = input.id.ok_or("Messung ohne Kennung")?;
            sql(conn.execute(
                "UPDATE measurement_rounds SET first_date = ?1, first_slot = ?2, note = ?3
                 WHERE id = ?4",
                params![input.first_date, input.first_slot, input.note, id],
            ))
        }

        // Leere Felder bedeuten "nicht gemessen" und werden entfernt, nicht als
        // 0 abgelegt.
        "saveRoundValues" => {
            let input: RoundValuesInput = parse(payload)?;
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            for value in &input.values {
                if value.first_l.is_none() && value.second_l.is_none() {
                    tx.execute(
                        "DELETE FROM measurement_values WHERE round_id = ?1 AND cow_id = ?2",
                        params![input.round_id, value.cow_id],
                    )
                    .map_err(to_text)?;
                } else {
                    tx.execute(
                        "INSERT INTO measurement_values (round_id, cow_id, first_l, second_l)
                         VALUES (?1, ?2, ?3, ?4)
                         ON CONFLICT (round_id, cow_id) DO UPDATE SET
                           first_l = excluded.first_l, second_l = excluded.second_l",
                        params![input.round_id, value.cow_id, value.first_l, value.second_l],
                    )
                    .map_err(to_text)?;
                }
            }
            tx.commit().map_err(to_text)?;
            Ok(None)
        }

        "deleteRound" => {
            let input: IdInput = parse(payload)?;
            sql(conn.execute("DELETE FROM measurement_rounds WHERE id = ?1", [input.id]))
        }

        "createTreatment" => {
            let input: TreatmentInput = parse(payload)?;
            conn.execute(
                "INSERT INTO treatments (season_id, cow_id, type_id, label, start_date, start_slot,
                                         end_date, end_slot, withhold_gemelke, note)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10)",
                params![
                    input.season_id,
                    input.cow_id,
                    input.type_id,
                    input.label,
                    input.start_date,
                    input.start_slot,
                    input.end_date,
                    input.end_slot,
                    input.withhold_gemelke.max(0),
                    input.note
                ],
            )
            .map_err(to_text)?;
            Ok(Some(conn.last_insert_rowid()))
        }

        // Nachtrag statt Neuanlage: die laufende Behandlung bekommt ihr Ende.
        // Die Wartezeit bleibt, wie sie war — sie zählt ab dem letzten
        // Behandlungsgemelk und rechnet sich damit von selbst neu aus.
        "endTreatment" => {
            let input: TreatmentEndInput = parse(payload)?;
            sql(conn.execute(
                "UPDATE treatments SET end_date = ?1, end_slot = ?2 WHERE id = ?3",
                params![
                    input.end_date,
                    input.end_slot.as_deref().unwrap_or("PM"),
                    input.id
                ],
            ))
        }

        "deleteTreatment" => {
            let input: IdInput = parse(payload)?;
            sql(conn.execute("DELETE FROM treatments WHERE id = ?1", [input.id]))
        }

        "saveTreatmentType" => {
            let input: TreatmentTypeInput = parse(payload)?;
            let gemelke = input.withhold_gemelke.max(0);
            match input.id {
                Some(id) => sql(conn.execute(
                    "UPDATE treatment_types SET name = ?1, default_withhold_gemelke = ?2, note = ?3
                     WHERE id = ?4",
                    params![input.name, gemelke, input.note, id],
                )),
                None => {
                    conn.execute(
                        "INSERT INTO treatment_types (name, default_withhold_gemelke, note)
                         VALUES (?1, ?2, ?3)",
                        params![input.name, gemelke, input.note],
                    )
                    .map_err(to_text)?;
                    Ok(Some(conn.last_insert_rowid()))
                }
            }
        }

        "setTreatmentTypeArchived" => {
            let input: ArchiveInput = parse(payload)?;
            sql(conn.execute(
                "UPDATE treatment_types SET archived = ?1 WHERE id = ?2",
                params![input.archived, input.id],
            ))
        }

        "saveProduction" => {
            let input: ProductionInput = parse(payload)?;
            match input.kg {
                None => sql(conn.execute(
                    "DELETE FROM cheese_production WHERE season_id = ?1 AND date = ?2",
                    params![input.season_id, input.date],
                )),
                Some(kg) => sql(conn.execute(
                    "INSERT INTO cheese_production (season_id, date, kg, note)
                     VALUES (?1, ?2, ?3, ?4)
                     ON CONFLICT (season_id, date) DO UPDATE SET
                       kg = excluded.kg, note = excluded.note",
                    params![input.season_id, input.date, kg.max(0.0), input.note],
                )),
            }
        }

        // Trägt für eine ganze Reihe von Tagen denselben Wert ein — spart
        // Tipparbeit. Welche Tage das sind, hat die Maske ausgerechnet.
        "saveProductionDays" => {
            let input: ProductionDaysInput = parse(payload)?;
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            for date in &input.dates {
                tx.execute(
                    "INSERT INTO cheese_production (season_id, date, kg) VALUES (?1, ?2, ?3)
                     ON CONFLICT (season_id, date) DO UPDATE SET kg = excluded.kg",
                    params![input.season_id, date, input.kg.max(0.0)],
                )
                .map_err(to_text)?;
            }
            tx.commit().map_err(to_text)?;
            Ok(None)
        }

        "createPickup" => {
            let input: PickupInput = parse(payload)?;
            conn.execute(
                "INSERT INTO pickups (season_id, farmer_id, date, kg, wheels, note)
                 VALUES (?1, ?2, ?3, ?4, ?5, ?6)",
                params![
                    input.season_id,
                    input.farmer_id,
                    input.date,
                    input.kg,
                    input.wheels,
                    input.note
                ],
            )
            .map_err(to_text)?;
            Ok(Some(conn.last_insert_rowid()))
        }

        "deletePickup" => {
            let input: IdInput = parse(payload)?;
            sql(conn.execute("DELETE FROM pickups WHERE id = ?1", [input.id]))
        }

        "updateSeason" => {
            let input: SeasonInput = parse(payload)?;
            let id = input.id.ok_or("Saison ohne Kennung")?;
            sql(conn.execute(
                "UPDATE seasons SET name = ?1, start_date = ?2, end_date = ?3,
                        deduction_percent = ?4, deduction_fixed_per_day = ?5
                 WHERE id = ?6",
                params![
                    input.name,
                    input.start_date,
                    input.end_date,
                    input.deduction_percent.clamp(0.0, 1.0),
                    input.deduction_fixed_per_day.max(0.0),
                    id
                ],
            ))
        }

        "createSeason" => {
            let input: SeasonInput = parse(payload)?;
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            tx.execute("UPDATE seasons SET is_active = 0", [])
                .map_err(to_text)?;
            tx.execute(
                "INSERT INTO seasons (name, start_date, end_date, is_active,
                                      deduction_percent, deduction_fixed_per_day)
                 VALUES (?1, ?2, ?3, 1, 0, 0)",
                params![input.name, input.start_date, input.end_date],
            )
            .map_err(to_text)?;
            let id = tx.last_insert_rowid();
            tx.commit().map_err(to_text)?;
            Ok(Some(id))
        }

        "activateSeason" => {
            let input: IdInput = parse(payload)?;
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            tx.execute("UPDATE seasons SET is_active = 0", [])
                .map_err(to_text)?;
            tx.execute("UPDATE seasons SET is_active = 1 WHERE id = ?1", [input.id])
                .map_err(to_text)?;
            tx.commit().map_err(to_text)?;
            Ok(None)
        }

        // Eine Saison mit allem, was an ihr hängt. Die Kühe selbst bleiben —
        // sie gehören dem Bauern, nicht der Saison; was verschwindet, ist ihre
        // Teilnahme. Die letzte Saison lässt sich nicht löschen, solange sie
        // die aktive ist: sonst stünde das Programm ohne Bezugsrahmen da und
        // jede Seite zeigte wieder nur den leeren Hinweis.
        "deleteSeason" => {
            let input: IdInput = parse(payload)?;
            let left: i64 = conn
                .query_row("SELECT COUNT(*) FROM seasons", [], |row| row.get(0))
                .map_err(to_text)?;
            if left <= 1 {
                return Err("Die letzte Saison lässt sich nicht löschen.".into());
            }

            let tx = conn.unchecked_transaction().map_err(to_text)?;
            let was_active: i64 = tx
                .query_row(
                    "SELECT is_active FROM seasons WHERE id = ?1",
                    [input.id],
                    |row| row.get(0),
                )
                .map_err(to_text)?;
            // ON DELETE CASCADE räumt Messungen, Behandlungen, Käse und
            // Abholungen mit ab — deshalb steht hier nur die eine Zeile.
            tx.execute("DELETE FROM seasons WHERE id = ?1", [input.id])
                .map_err(to_text)?;
            if was_active == 1 {
                tx.execute(
                    "UPDATE seasons SET is_active = 1
                     WHERE id = (SELECT id FROM seasons ORDER BY start_date DESC LIMIT 1)",
                    [],
                )
                .map_err(to_text)?;
            }
            tx.commit().map_err(to_text)?;
            Ok(None)
        }

        // Kühe aus einer früheren Saison übernehmen. Der Bauer kommt aus dem
        // Stammsatz und nicht aus der alten Teilnahme: hat die Kuh seither den
        // Besitzer gewechselt, gilt für die neue Saison der neue. Wer schon
        // eingetragen ist, bleibt unangetastet — die Übernahme darf ein von
        // Hand nachgetragenes Auftriebsdatum nicht überschreiben.
        "carryOverCows" => {
            let input: CarryOverInput = parse(payload)?;
            let arrival = match input.arrival_date {
                Some(date) if !date.is_empty() => date,
                _ => conn
                    .query_row(
                        "SELECT start_date FROM seasons WHERE id = ?1",
                        [input.season_id],
                        |row| row.get::<_, String>(0),
                    )
                    .map_err(to_text)?,
            };
            let slot = input.arrival_slot.as_deref().unwrap_or("AM").to_string();

            let tx = conn.unchecked_transaction().map_err(to_text)?;
            let mut taken = 0i64;
            for cow_id in &input.cow_ids {
                // Nur Kühe, die in der genannten Saison auch wirklich standen —
                // die Liste kommt aus der Oberfläche und wird nicht geglaubt.
                let stood: i64 = tx
                    .query_row(
                        "SELECT COUNT(*) FROM cow_seasons WHERE season_id = ?1 AND cow_id = ?2",
                        params![input.from_season_id, cow_id],
                        |row| row.get(0),
                    )
                    .map_err(to_text)?;
                if stood == 0 {
                    continue;
                }
                taken += tx
                    .execute(
                        "INSERT OR IGNORE INTO cow_seasons
                           (season_id, cow_id, farmer_id, arrival_date, arrival_slot)
                         SELECT ?1, id, farmer_id, ?2, ?3 FROM cows WHERE id = ?4",
                        params![input.season_id, arrival, slot, cow_id],
                    )
                    .map_err(to_text)? as i64;
            }
            tx.commit().map_err(to_text)?;
            Ok(Some(taken))
        }

        // Räumt alle Sachdaten ab. Die Behandlungsvorlagen bleiben stehen —
        // sie sind Voreinstellung, keine Saisondaten. Gebraucht wird das nur
        // vom Beispieldaten-Skript; die Oberfläche ruft es nirgends auf.
        "reset" => {
            let tx = conn.unchecked_transaction().map_err(to_text)?;
            // Die Reihenfolge ist die der Fremdschlüssel, nicht dem Zufall
            // überlassen: sonst hinge ein Löschen an einer noch belegten Kuh.
            tx.execute_batch(
                "DELETE FROM pickups;
                 DELETE FROM cheese_production;
                 DELETE FROM treatments;
                 DELETE FROM measurement_values;
                 DELETE FROM measurement_rounds;
                 DELETE FROM cow_seasons;
                 DELETE FROM cows;
                 DELETE FROM farmers;
                 DELETE FROM seasons;",
            )
            .map_err(to_text)?;
            tx.commit().map_err(to_text)?;
            Ok(None)
        }

        other => Err(format!("Unbekannte Anweisung: {other}")),
    }
}

fn to_text(error: rusqlite::Error) -> String {
    error.to_string()
}
