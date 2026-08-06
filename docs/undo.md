# Rückgängig und Wiederholen — plan

Goal: one `⌘Z` that means "put it back the way it was", covering data edits and
where you were when you made them, without a hand-written inverse for each of
the 23 commands.

## 1. Inventory: what "everything" is

| State | Lives in | Undoable? |
| --- | --- | --- |
| 23 write commands (`write::dispatch`) | SQLite | **yes**, automatically |
| Calendar month + day selection | URL `?m=&d=` | **yes**, as a *place* |
| Which detail page is open (`?id=`) | URL | **yes**, as a *place* |
| Which month the billing page shows | URL `?m=` | **yes**, as a *place* |
| Dock placement (docked / floating / collapsed) | `localStorage` | no — see §6 |
| Nav collapsed, theme | `localStorage` | no — see §6 |
| `exportDb` / `importDb` / `deleteBackup` / `reset` | the file itself | no — they **clear** the timeline (§5) |

## 2. The model: one timeline, two kinds of step

Two separate stacks (one for data, one for selection) would make `⌘Z` mean
different things depending on what you touched last. One stack, two kinds of
entry:

```ts
interface Step {
  /** Was für ein Schritt — "Käsemenge geändert", "Messung gelöscht". */
  label: string;
  /** Die Adresse vor dem Schritt: Pfad samt Abfrage. */
  before: string;
  /** Die Adresse danach. */
  after: string;
  /** Ob in der Datenbank etwas rückzunehmen ist. */
  data: boolean;
}
```

Rules:

- A **data step** (`data: true`) records the change *and* the address it
  happened at. Undoing it reverses the change and takes you back there — the
  same reason a code editor scrolls to the edit it just undid.
- A **view step** (`data: false`) records only the move.
- **Consecutive view steps collapse.** Only the oldest `before` and the newest
  `after` survive. So dragging across a week, then shift-extending it, then
  clicking a single day is *one* step, not three — and a data step is never
  more than one `⌘Z` away behind a pile of clicking around.

That gives the behaviour asked for: if the last thing you did was select days,
`⌘Z` undoes the selection; otherwise it undoes the last real change and puts
you back where you made it.

Redo is the same list read forwards, applying `after`.

## 3. The data half: an undo log in SQLite

Use the trigger-based undo log (SQLite's own documented recipe). A `TEMP` table
collects, for every row written, the single SQL statement that would put it
back:

```sql
CREATE TEMP TABLE undolog (seq INTEGER PRIMARY KEY, sql TEXT);
```

Per table, three `TEMP` triggers:

- `AFTER INSERT` → log a `DELETE FROM t WHERE rowid = <new.rowid>`
- `AFTER DELETE` → log an `INSERT INTO t(rowid, …) VALUES(…)` with `quote(old.…)`
- `AFTER UPDATE` → log an `UPDATE t SET … WHERE rowid = <old.rowid>`

Ten tables get triggers — `seasons`, `farmers`, `cows`, `cow_seasons`,
`measurement_rounds`, `measurement_values`, `treatment_types`, `treatments`,
`cheese_production`, `pickups`. `meta` stays out; the schema version is not
something a user edits.

Three things make this the right shape for this codebase:

- **The trigger bodies are generated, not typed.** Build them in Rust from
  `PRAGMA table_info(t)`, so a new column can never quietly fall out of the
  log. Roughly 80 lines, once, in a new `src-tauri/src/undo.rs`.
- **It covers all 23 commands and every future one for free.** Nothing in
  `write::dispatch` changes. The log sits underneath the commands, at the row
  level, where there is nothing left to forget.
- **Undo and redo are the same code.** Replaying an undo range fires the
  triggers again, and the statements that produces *are* the redo range. One
  function, called twice.

Around each command, `Store::run` brackets the write:

```rust
let first = undo::next_seq(&conn)?;   // vor dem Schreiben
let inserted = write::dispatch(&conn, name, payload)?;
undo::mark(&conn, name, first)?;      // schiebt (first..=last) auf den Stapel
```

`undo::mark` drops the step entirely when the range is empty — a command that
changed nothing leaves no step behind.

Two new commands in `Store::run`, alongside `exportDb`/`importDb`:
`"undo"` and `"redo"`. Each returns the fresh snapshot as everything else does,
plus a `notice` naming what was reversed.

`Snapshot` gains the state the buttons need:

```ts
export interface UndoState {
  canUndo: boolean;
  canRedo: boolean;
  /** Was das nächste ⌘Z zurücknähme — null, wenn nichts. */
  undoLabel: string | null;
  redoLabel: string | null;
}
```

Labels come from a `label_for(command_name)` table in Rust — 23 German strings,
the one piece of per-command work this design needs, and a harmless one.

### Two details that must be got right

- **`PRAGMA recursive_triggers = ON`** in `db::open`. Without it, rows removed
  by `ON DELETE CASCADE` do not fire the child table's delete trigger, and
  deleting a Bauer would be undone as an empty Bauer with no cows. The
  round-trip test in §7 is what proves this, not the pragma being present.
- **The log is `TEMP`.** It dies with the connection, so undo history is
  per-session and never persists to the file. That is the right scope: nobody
  expects to reopen the app and undo last week.

### Alternatives, and why not

- **A hand-written inverse per command** — 23 more code paths that can be
  wrong, and `deleteRound` (cascading) and `reset` are the awkward ones.
- **The `sqlite3session` extension** (record a changeset, `invert`, apply) is
  purpose-built and needs no triggers, but wants `SQLITE_ENABLE_SESSION` and
  `SQLITE_ENABLE_PREUPDATE_HOOK` at build time. The project currently builds
  `rusqlite 0.32` with plain `bundled`; trading that for build-flag risk buys
  nothing the triggers do not already give.
- **A copy of the whole file per change**, reusing the verified
  `backup::export` — simple, but writes the entire database on every keystroke
  save. Kept in mind as the fallback if the triggers ever prove leaky.

## 4. The view half: places

Selection already lives in the URL and is written with `router.replace`, so
none of it reaches browser history — deliberately, since a drag would otherwise
write a history entry per mouse move. Keep `replace`; the timeline is ours.

A small `useTrail()` hook in the timeline provider watches
`pathname + searchParams`. Every change that was *not* caused by the timeline
itself becomes a view step, collapsed per §2 and debounced so a drag lands as
one entry. Applying a step is one `router.replace(step.before)`.

Consequence worth stating: the trackpad back-swipe in the macOS WebView still
walks whatever history exists and knows nothing about the timeline. Either
suppress it in the Tauri window config or accept it as a separate gesture.

## 5. What clears the timeline

`importDb` replaces the file underneath the connection, so both the log and its
triggers vanish with the old connection — correct, and already the behaviour
that falls out of `Store::import_db` reopening. Make it explicit anyway.
`deleteBackup` and `exportDb` do not touch content and leave the timeline
alone. `reset` writes a safety copy and clears — a log entry per deleted row is
technically fine, but "undo the wipe" should be a restore, not a replay.

## 6. Deliberately not undoable

Dock placement, nav collapse, theme. These are preferences, not edits: undoing a
window position after a data change is a surprise, and each is one click to
reverse. `⌘Z` should never move furniture.

## 7. Surface

- **`⌘Z` / `⌘⇧Z`**, plus `Ctrl+Z` / `Ctrl+Y` for the Windows build. The handler
  must stand down when the focus is in an `input`, `textarea`, or
  `contenteditable` — the browser's own text undo owns that field, and stealing
  it mid-typing is worse than having no shortcut at all.
- **A visible quiet pair** in `Shell.tsx`, next to the flash region, disabled
  when empty. A keyboard-only feature is invisible to the person this app is
  for. Accessible name carries the label: `Rückgängig: Käsemenge geändert`.
- **The flash says what happened** — reuse the existing `notice` channel, no
  new hue (it reports an action, not a state).

## 8. Verification

The centrepiece is one generic Rust test, not 23 specific ones:

> For each of the 23 commands: hash the full contents of all tables, run the
> command, hash again, `undo`, assert the hash equals the *before* hash, `redo`,
> assert it equals the *after* hash.

That single loop proves trigger coverage across every table and every column,
and it fails loudly the day someone adds a table and forgets the triggers.
Add a `cargo test` target for it — the crate has none today.

On the TS side, extend `test/` with the step-collapsing rule: a run of view
steps must reduce to one, and a data step must never be swallowed by it.

## 9. Phases

1. **`src-tauri/src/undo.rs`** — log table, generated triggers, `next_seq`,
   `mark`, `apply`. `db::open` gains `recursive_triggers`. `Store::run` gains
   the bracket and the two commands. `model::Snapshot` gains `undo: UndoState`.
   Ship with the round-trip test; at this point `⌘Z` already works for data.
2. **`lib/data/undo.tsx`** — the timeline provider, the two buttons in
   `Shell.tsx`, the key handler. Data steps only, places recorded and restored.
3. **View steps** — `useTrail()`, collapsing, debounce. Selection becomes
   undoable.
4. **Polish** — merge consecutive same-target saves within ~2 s into one step
   (rapid `saveProduction` day edits), hover text on the buttons.

## 10. Left for you to decide

- Should `⌘Z` with an empty timeline stay silent, or say
  "Nichts rückgängig zu machen"? Silence is the convention; a farmer pressing
  it twice and seeing nothing may not trust it.
- How deep should the timeline go? Unbounded is fine for a season's data;
  a cap of ~200 steps costs nothing and bounds the temp table.
