//! Lesen: ein einziger Stand für die gesamte Oberfläche.
//!
//! Archivierte Bauern und Kühe kommen mit — mitsamt ihrem Kennzeichen. Was
//! angezeigt wird, entscheidet die Oberfläche; ein archivierter Name muss aber
//! auflösbar bleiben, sonst stünde in alten Abrechnungen ein Strich.

use rusqlite::{Connection, Row};

use crate::backup;
use crate::model::*;

fn season_from(row: &Row<'_>) -> rusqlite::Result<Season> {
    Ok(Season {
        id: row.get(0)?,
        name: row.get(1)?,
        start_date: row.get(2)?,
        end_date: row.get(3)?,
        is_active: row.get(4)?,
        deduction_percent: row.get(5)?,
        deduction_fixed_per_day: row.get(6)?,
    })
}

const SEASON_COLUMNS: &str = "id, name, start_date, end_date, is_active,
                              deduction_percent, deduction_fixed_per_day";

pub fn list_seasons(conn: &Connection) -> rusqlite::Result<Vec<Season>> {
    let sql = format!("SELECT {SEASON_COLUMNS} FROM seasons ORDER BY start_date DESC");
    let mut stmt = conn.prepare(&sql)?;
    let items = stmt.query_map([], season_from)?.collect::<Result<_, _>>()?;
    Ok(items)
}

/// Aktive Saison, ersatzweise die neueste.
fn active_season(conn: &Connection, seasons: &[Season]) -> Option<Season> {
    let _ = conn;
    seasons
        .iter()
        .find(|season| season.is_active == 1)
        .or_else(|| seasons.first())
        .cloned()
}

fn list_farmers(conn: &Connection) -> rusqlite::Result<Vec<Farmer>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, contact, note, archived FROM farmers ORDER BY name COLLATE NOCASE",
    )?;
    let items = stmt
        .query_map([], |row| {
            Ok(Farmer {
                id: row.get(0)?,
                name: row.get(1)?,
                contact: row.get(2)?,
                note: row.get(3)?,
                archived: row.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_cows(conn: &Connection) -> rusqlite::Result<Vec<Cow>> {
    let mut stmt = conn.prepare(
        "SELECT id, farmer_id, bell_number, name, note, archived
         FROM cows ORDER BY name COLLATE NOCASE",
    )?;
    let items = stmt
        .query_map([], |row| {
            Ok(Cow {
                id: row.get(0)?,
                farmer_id: row.get(1)?,
                bell_number: row.get(2)?,
                name: row.get(3)?,
                note: row.get(4)?,
                archived: row.get(5)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

/// Die Herde einer Saison: alle Kühe mit ihren Saisondaten, falls sie an dieser
/// Saison teilnehmen.
fn list_herd(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<HerdCow>> {
    let mut stmt = conn.prepare(
        "SELECT c.id, c.farmer_id, c.bell_number, c.name, c.note, c.archived,
                f.name AS farmer_name, cs.id AS cow_season_id,
                cs.arrival_date, cs.arrival_slot,
                cs.departure_date, cs.departure_slot,
                cs.dry_off_date, cs.dry_off_slot
         FROM cows c
         JOIN farmers f ON f.id = c.farmer_id
         LEFT JOIN cow_seasons cs ON cs.cow_id = c.id AND cs.season_id = ?1
         ORDER BY f.name COLLATE NOCASE, c.bell_number COLLATE NOCASE",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(HerdCow {
                id: row.get(0)?,
                farmer_id: row.get(1)?,
                bell_number: row.get(2)?,
                name: row.get(3)?,
                note: row.get(4)?,
                archived: row.get(5)?,
                farmer_name: row.get(6)?,
                cow_season_id: row.get(7)?,
                arrival_date: row.get(8)?,
                arrival_slot: row.get(9)?,
                departure_date: row.get(10)?,
                departure_slot: row.get(11)?,
                dry_off_date: row.get(12)?,
                dry_off_slot: row.get(13)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_cow_seasons(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<CowSeason>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, cow_id, farmer_id, arrival_date, arrival_slot,
                departure_date, departure_slot, dry_off_date, dry_off_slot, note
         FROM cow_seasons WHERE season_id = ?1",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(CowSeason {
                id: row.get(0)?,
                season_id: row.get(1)?,
                cow_id: row.get(2)?,
                farmer_id: row.get(3)?,
                arrival_date: row.get(4)?,
                arrival_slot: row.get(5)?,
                departure_date: row.get(6)?,
                departure_slot: row.get(7)?,
                dry_off_date: row.get(8)?,
                dry_off_slot: row.get(9)?,
                note: row.get(10)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

/// Über alle Saisons, nicht nur die aktive — deshalb ohne Filter.
fn list_season_cows(conn: &Connection) -> rusqlite::Result<Vec<SeasonCow>> {
    let mut stmt = conn.prepare("SELECT season_id, cow_id FROM cow_seasons")?;
    let items = stmt
        .query_map([], |row| {
            Ok(SeasonCow {
                season_id: row.get(0)?,
                cow_id: row.get(1)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_rounds(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<MeasurementRound>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, first_date, first_slot, note
         FROM measurement_rounds WHERE season_id = ?1
         ORDER BY first_date, first_slot",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(MeasurementRound {
                id: row.get(0)?,
                season_id: row.get(1)?,
                first_date: row.get(2)?,
                first_slot: row.get(3)?,
                note: row.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_values(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<MeasurementValue>> {
    let mut stmt = conn.prepare(
        "SELECT v.id, v.round_id, v.cow_id, v.first_l, v.second_l,
                r.first_date, r.first_slot
         FROM measurement_values v
         JOIN measurement_rounds r ON r.id = v.round_id
         WHERE r.season_id = ?1
         ORDER BY r.first_date, r.first_slot",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(MeasurementValue {
                id: row.get(0)?,
                round_id: row.get(1)?,
                cow_id: row.get(2)?,
                first_l: row.get(3)?,
                second_l: row.get(4)?,
                first_date: row.get(5)?,
                first_slot: row.get(6)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_treatment_types(conn: &Connection) -> rusqlite::Result<Vec<TreatmentType>> {
    let mut stmt = conn.prepare(
        "SELECT id, name, default_withhold_gemelke, note, archived
         FROM treatment_types ORDER BY name COLLATE NOCASE",
    )?;
    let items = stmt
        .query_map([], |row| {
            Ok(TreatmentType {
                id: row.get(0)?,
                name: row.get(1)?,
                default_withhold_gemelke: row.get(2)?,
                note: row.get(3)?,
                archived: row.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_treatments(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<Treatment>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, cow_id, type_id, label, start_date, start_slot,
                end_date, end_slot, withhold_gemelke, note
         FROM treatments WHERE season_id = ?1
         ORDER BY start_date, start_slot",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(Treatment {
                id: row.get(0)?,
                season_id: row.get(1)?,
                cow_id: row.get(2)?,
                type_id: row.get(3)?,
                label: row.get(4)?,
                start_date: row.get(5)?,
                start_slot: row.get(6)?,
                end_date: row.get(7)?,
                end_slot: row.get(8)?,
                withhold_gemelke: row.get(9)?,
                note: row.get(10)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_production(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<CheeseProduction>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, date, kg, note
         FROM cheese_production WHERE season_id = ?1 ORDER BY date",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(CheeseProduction {
                id: row.get(0)?,
                season_id: row.get(1)?,
                date: row.get(2)?,
                kg: row.get(3)?,
                note: row.get(4)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

/// Neueste zuerst — die Liste wird von oben gelesen und oben ergänzt.
fn list_alp_cheese(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<AlpCheese>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, kg, note
         FROM alp_cheese WHERE season_id = ?1 ORDER BY id DESC",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(AlpCheese {
                id: row.get(0)?,
                season_id: row.get(1)?,
                kg: row.get(2)?,
                note: row.get(3)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

fn list_pickups(conn: &Connection, season_id: i64) -> rusqlite::Result<Vec<Pickup>> {
    let mut stmt = conn.prepare(
        "SELECT id, season_id, farmer_id, date, kg, wheels, note
         FROM pickups WHERE season_id = ?1 ORDER BY date DESC, id DESC",
    )?;
    let items = stmt
        .query_map([season_id], |row| {
            Ok(Pickup {
                id: row.get(0)?,
                season_id: row.get(1)?,
                farmer_id: row.get(2)?,
                date: row.get(3)?,
                kg: row.get(4)?,
                wheels: row.get(5)?,
                note: row.get(6)?,
            })
        })?
        .collect::<Result<_, _>>()?;
    Ok(items)
}

pub fn snapshot(conn: &Connection, db_path: &str) -> rusqlite::Result<Snapshot> {
    let seasons = list_seasons(conn)?;
    let season = active_season(conn, &seasons);
    let farmers = list_farmers(conn)?;
    let cows = list_cows(conn)?;

    // Ohne Saison gibt es keine saisonbezogenen Zeilen; die Stammdaten stehen
    // trotzdem schon bereit, damit die erste Saison nicht im Leeren angelegt
    // werden muss.
    let season_id = season.as_ref().map(|s| s.id).unwrap_or(0);

    Ok(Snapshot {
        db_path: db_path.to_string(),
        db: backup::describe(conn, db_path),
        seasons,
        season,
        farmers,
        cows,
        herd: list_herd(conn, season_id)?,
        cow_seasons: list_cow_seasons(conn, season_id)?,
        season_cows: list_season_cows(conn)?,
        rounds: list_rounds(conn, season_id)?,
        values: list_values(conn, season_id)?,
        treatment_types: list_treatment_types(conn)?,
        treatments: list_treatments(conn, season_id)?,
        production: list_production(conn, season_id)?,
        alp_cheese: list_alp_cheese(conn, season_id)?,
        pickups: list_pickups(conn, season_id)?,
    })
}
