// The two homes of area_stats (see src/lib/db/stores.ts): Supabase
// (DATABASE_URL) holds as much as fits under its plan's size cap, Neon
// (NEON_DATABASE_URL) the overflow. Each dataset's rows sit wholly in one,
// recorded in datasets.storage. This module routes importer writes,
// spills a dataset to Neon when Supabase is near its limit, moves datasets
// between the two (scripts/db-rebalance.mjs), and counts rows across both.
//
// Without NEON_DATABASE_URL everything is in one database (the local stack,
// which db:pull fills from both clouds).

import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import pg from "pg";

export const MB = 1024 * 1024;
// Supabase free plan: 500 MB, after which the project goes read-only.
// db-rebalance fills Supabase to the target; an import that would push it
// past the limit spills its dataset to Neon instead.
export const supabaseTargetBytes = () => Number(process.env.SUPABASE_TARGET_MB || 450) * MB;
export const supabaseLimitBytes = () => Number(process.env.SUPABASE_LIMIT_MB || 480) * MB;
// Roughly what one area_stats row costs on disk, indexes included.
export const BYTES_PER_ROW = 350;
// src/lib/db/stores.ts caches placements this long.
export const PLACEMENT_TTL_MS = 60_000;

const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata", "updated_at"];
const KEY = ["source", "metric", "geo_level", "geoid", "period"];

export const isLocalUrl = (url) => /@(localhost|127\.0\.0\.1|host\.docker\.internal)[:/]/.test(url ?? "");

let neonPool = null;
// A pool that lets the process exit once idle, so importers that only
// end their own Supabase client don't hang on it.
export function neon() {
  if (!process.env.NEON_DATABASE_URL) return null;
  neonPool ??= new pg.Pool({ connectionString: process.env.NEON_DATABASE_URL, max: 2, allowExitOnIdle: true });
  return neonPool;
}

export async function closeNeon() {
  const p = neonPool;
  neonPool = null;
  await p?.end();
}

// Creates Neon's area_stats if needed (supabase/sql/neon, same files
// scripts/migrate.mjs applies there).
export async function ensureNeonSchema(db) {
  const dir = "supabase/sql/neon";
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".sql")).sort()) {
    await db.query(readFileSync(path.join(dir, f), "utf8"));
  }
}

// slug -> "supabase" | "neon" for the given sources; unlisted sources (no
// datasets row) live in Supabase.
export async function placements(primary, sources) {
  const { rows } = await primary.query("select slug, storage from datasets where slug = any($1)", [sources]);
  return new Map(rows.map((r) => [r.slug, r.storage]));
}

async function setPlacement(primary, source, storage) {
  await primary.query("update datasets set storage = $2, updated_at = now() where slug = $1", [source, storage]);
}

// Groups area_stats rows by the database that should receive them:
// [[client, rows], ...]. A dataset still in Supabase whose write would take
// Supabase past its limit is moved to Neon first.
export async function routeAreaStats(primary, rows) {
  const bySource = new Map();
  for (const r of rows) bySource.set(r.source, [...(bySource.get(r.source) ?? []), r]);
  const place = await placements(primary, [...bySource.keys()]);
  const db = neon();
  const out = [];
  for (const [source, list] of bySource) {
    let storage = place.get(source) ?? "supabase";
    if (storage === "neon" && !db) {
      if (!isLocalUrl(process.env.DATABASE_URL)) {
        throw new Error(`area_stats source "${source}" is stored in Neon but NEON_DATABASE_URL is not set`);
      }
      storage = "supabase"; // local stack: one database holds everything
    }
    if (storage === "supabase" && db && place.has(source) && (await wouldOverflow(primary, source, list.length))) {
      console.log(`  Supabase is near its ${supabaseLimitBytes() / MB} MB limit: moving ${source} to Neon`);
      await moveSource(primary, source, "neon", { wait: false });
      storage = "neon";
    }
    out.push([storage === "neon" ? db : primary, list]);
  }
  return out;
}

async function wouldOverflow(primary, source, incoming) {
  const { rows } = await primary.query(
    `select pg_database_size(current_database())::float8 as size,
            exists (select 1 from area_stats where source = $1) as has_rows`,
    [source],
  );
  // Re-imports mostly update rows in place; a new dataset adds all of them.
  const growth = rows[0].has_rows ? 0 : incoming * BYTES_PER_ROW;
  return rows[0].size + growth > supabaseLimitBytes();
}

// Copies a dataset's rows into `to`, points datasets.storage at it, then
// deletes the old copy. Safe to re-run after a failure: the copy upserts
// and the old rows go only once the new home holds them all. With
// wait = false the old rows are deleted without waiting out the app's
// placement cache (importers; db-rebalance flips everything, waits once,
// then calls deleteSource).
export async function moveSource(primary, source, to, { wait = true, log = console.log } = {}) {
  await copySource(primary, source, to, { log });
  await setPlacement(primary, source, to);
  if (wait) await new Promise((r) => setTimeout(r, PLACEMENT_TTL_MS + 5000));
  await deleteSource(primary, source, to === "neon" ? "supabase" : "neon");
}

export async function copySource(primary, source, to, { batchSize = 4000, log = console.log } = {}) {
  const db = neon();
  if (!db) throw new Error("NEON_DATABASE_URL is not set");
  const [from, into] = to === "neon" ? [primary, db] : [db, primary];
  if (to === "neon") await ensureNeonSchema(db);
  const total = Number((await from.query("select count(*) from area_stats where source = $1", [source])).rows[0].count);
  let copied = 0;
  // Pages in primary-key order (source, metric, geo_level, geoid, period).
  let after = null;
  for (;;) {
    const { rows } = await from.query(
      `select ${COLUMNS.join(", ")} from area_stats
        where source = $1 ${after ? "and (metric, geo_level, geoid, period) > ($2, $3, $4, $5)" : ""}
        order by metric, geo_level, geoid, period limit ${batchSize}`,
      after ? [source, ...after] : [source],
    );
    if (!rows.length) break;
    await insertRows(into, rows);
    copied += rows.length;
    const last = rows.at(-1);
    after = [last.metric, last.geo_level, last.geoid, last.period];
    if (copied % (batchSize * 25) < batchSize || copied === total) log(`    ${source}: ${copied.toLocaleString()} / ${total.toLocaleString()}`);
  }
  const landed = Number((await into.query("select count(*) from area_stats where source = $1", [source])).rows[0].count);
  if (landed < total) throw new Error(`${source}: copied ${landed} of ${total} rows to ${to}; the original is untouched`);
  return total;
}

export async function deleteSource(primary, source, from) {
  const db = from === "neon" ? neon() : primary;
  const { rowCount } = await db.query("delete from area_stats where source = $1", [source]);
  return rowCount;
}

async function insertRows(db, rows) {
  const params = [];
  const values = rows.map((row) => `(${COLUMNS.map((c) => {
    const v = row[c];
    params.push(c === "metadata" && v !== null ? JSON.stringify(v) : v);
    return `$${params.length}`;
  }).join(", ")})`);
  const update = COLUMNS.filter((c) => !KEY.includes(c));
  const data = update.filter((c) => c !== "updated_at").map((c) => `"${c}"`);
  // Rows a re-run already copied are left alone rather than rewritten.
  await db.query(
    `insert into area_stats as t (${COLUMNS.map((c) => `"${c}"`).join(", ")}) values ${values.join(", ")}
     on conflict (${KEY.map((c) => `"${c}"`).join(", ")}) do update set ${update.map((c) => `"${c}" = excluded."${c}"`).join(", ")}
     where (${data.map((c) => `t.${c}`).join(", ")}) is distinct from (${data.map((c) => `excluded.${c}`).join(", ")})`,
    params,
  );
}

// source -> { supabase, neon } row counts across both databases.
export async function sourceCounts(primary) {
  const counts = new Map();
  const add = (rows, store) => {
    for (const r of rows) counts.set(r.source, { supabase: 0, neon: 0, ...counts.get(r.source), [store]: Number(r.n) });
  };
  const q = "select source, count(*) as n from area_stats group by source";
  add((await primary.query(q)).rows, "supabase");
  const db = neon();
  // Neon gets its table on the first move (or migrate).
  if (db && (await db.query("select to_regclass('public.area_stats') is not null as ok")).rows[0].ok) {
    add((await db.query(q)).rows, "neon");
  }
  return counts;
}
