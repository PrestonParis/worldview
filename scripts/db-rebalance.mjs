// Keeps Supabase just under its plan's size cap with the overflow in Neon:
// plans which datasets' area_stats rows live where (datasets.storage), moves
// them, and compacts Supabase so the freed space counts. See
// scripts/lib/stores.mjs and src/lib/db/stores.ts.
//
// Usage:
//   ENV_FILE=.env.cloud node scripts/db-rebalance.mjs              # show the plan
//   ENV_FILE=.env.cloud node scripts/db-rebalance.mjs --apply      # carry it out
//     --target=450      Supabase size to fill up to, in MB (SUPABASE_TARGET_MB)
//     --no-compact      skip rebuilding area_stats after moving rows out
//   ENV_FILE=.env.cloud node scripts/db-rebalance.mjs --compact    # only reclaim dead space, in both
//
// The plan is sticky: datasets stay put unless Supabase is over the target
// (then the dataset that best covers the excess moves to Neon, or the
// largest if none does alone), or there is room to bring Neon datasets back
// (smallest first). Moves copy, switch datasets.storage, wait out the app's
// placement cache, then delete the old rows.
//
// Deleted rows only shrink Supabase after the table is rewritten. On a
// nearly full disk there's no room to rewrite it with its indexes, so the
// compaction drops area_stats' indexes, rewrites the table (VACUUM FULL),
// and recreates them; pages read from Supabase more slowly for those few
// minutes, and no import should run meanwhile.

import { arg, connectPg, flag, loadEnv } from "./lib/bulk.mjs";
import {
  MB,
  PLACEMENT_TTL_MS,
  closeNeon,
  copySource,
  deleteSource,
  ensureNeonSchema,
  neon,
  sourceCounts,
  supabaseTargetBytes,
} from "./lib/stores.mjs";

loadEnv();
const apply = flag("apply");
const target = arg("target") ? Number(arg("target")) * MB : supabaseTargetBytes();
const fmt = (b) => `${Math.round(b / MB)} MB`;

const primary = await connectPg();
const db = neon();
if (!db) throw new Error("NEON_DATABASE_URL is not set (use ENV_FILE=.env.cloud)");
try {
  if (flag("compact")) {
    await primary.query("set session characteristics as transaction read write");
    await compact(primary, "Supabase", { lowDisk: true });
    await compact(db, "Neon");
  } else {
    await rebalance();
  }
} finally {
  await primary.end();
  await closeNeon();
}

// Rewrites area_stats (VACUUM FULL) so deleted rows and dropped columns
// stop counting toward the database's size. With lowDisk (Supabase) the
// indexes are dropped first and rebuilt after, since a nearly full disk
// can't hold a second copy of them.
async function compact(client, label, { lowDisk = false } = {}) {
  const { rows: [before] } = await client.query("select pg_total_relation_size('area_stats')::float8 as b");
  console.log(`\nCompacting ${label} area_stats (${fmt(before.b)})`);
  const { rows: indexes } = lowDisk
    ? await client.query(
        `select i.indexname, i.indexdef, c.contype, pg_get_constraintdef(c.oid) as condef
           from pg_indexes i
           left join pg_constraint c on c.conname = i.indexname and c.conrelid = 'public.area_stats'::regclass
          where i.schemaname = 'public' and i.tablename = 'area_stats'`,
      )
    : { rows: [] };
  // Printed first so they can be recreated by hand if the run dies midway.
  for (const i of indexes) {
    console.log(`  ${i.condef ? `ALTER TABLE area_stats ADD CONSTRAINT "${i.indexname}" ${i.condef}` : i.indexdef};`);
  }
  for (const i of indexes) {
    await client.query(i.condef ? `alter table area_stats drop constraint "${i.indexname}"` : `drop index "${i.indexname}"`);
  }
  await client.query("vacuum full area_stats");
  for (const i of indexes) {
    await client.query(i.condef ? `alter table area_stats add constraint "${i.indexname}" ${i.condef}` : i.indexdef);
  }
  await client.query("analyze area_stats");
  const { rows: [after] } = await client.query("select pg_total_relation_size('area_stats')::float8 as b");
  console.log(`  ${label} area_stats is now ${fmt(after.b)}`);
}

async function rebalance() {
  if (apply) {
    // A Supabase project over its cap is read-only by default; freeing
    // space is allowed per session.
    await primary.query("set session characteristics as transaction read write");
    await primary.query(`alter table datasets add column if not exists storage text default 'supabase' not null`);
    await ensureNeonSchema(db);
  }

  const counts = await sourceCounts(primary);
  const { rows: [size] } = await primary.query(
    `select pg_database_size(current_database())::float8 as db,
            pg_total_relation_size('area_stats')::float8 as stats,
            (select count(*) from area_stats)::float8 as n`,
  );
  const perRow = size.n ? size.stats / size.n : 350;
  const fixed = size.db - size.stats; // everything in Supabase but area_stats
  const budget = target - fixed;

  // A dry run before the first --apply: no storage column yet.
  const { rows: [hasColumn] } = await primary.query(
    "select exists (select 1 from information_schema.columns where table_name = 'datasets' and column_name = 'storage') as ok",
  );
  const { rows: placed } = await primary.query(`select slug, ${hasColumn.ok ? "storage" : "'supabase' as storage"} from datasets`);
  const storage = new Map(placed.map((r) => [r.slug, r.storage]));
  const bytes = (s) => {
    const c = counts.get(s);
    return (c.supabase + c.neon) * perRow;
  };
  const home = new Map([...counts.keys()].map((s) => [s, storage.get(s) ?? "supabase"]));
  const inSupabase = () => [...home].filter(([, h]) => h === "supabase").map(([s]) => s);
  const used = () => inSupabase().reduce((t, s) => t + bytes(s), 0);
  const moves = [];

  while (used() > budget) {
    const excess = used() - budget;
    // Rows without a datasets row can't be placed in Neon.
    const candidates = inSupabase().filter((s) => storage.has(s)).sort((a, b) => bytes(a) - bytes(b));
    const pick = candidates.find((s) => bytes(s) >= excess) ?? candidates.at(-1);
    if (!pick) break;
    home.set(pick, "neon");
    moves.push([pick, "neon"]);
  }
  for (const s of [...home].filter(([, h]) => h === "neon").map(([s]) => s).sort((a, b) => bytes(a) - bytes(b))) {
    if (moves.some(([m]) => m === s)) continue;
    if (used() + bytes(s) > budget) continue;
    home.set(s, "supabase");
    moves.push([s, "supabase"]);
  }

  console.log(`Supabase: ${fmt(size.db)} now (area_stats ${fmt(size.stats)}, the rest ${fmt(fixed)}); target ${fmt(target)}`);
  console.log(`~${Math.round(perRow)} bytes per area_stats row\n`);
  for (const s of [...home.keys()].sort((a, b) => bytes(b) - bytes(a))) {
    const c = counts.get(s);
    const move = moves.find(([m]) => m === s);
    const where = c.supabase && c.neon ? "both" : c.neon ? "neon" : "supabase";
    console.log(`  ${s.padEnd(30)} ${(c.supabase + c.neon).toLocaleString().padStart(10)} rows ${fmt(bytes(s)).padStart(7)}  ${where}${move ? ` -> ${move[1]}` : ""}`);
  }
  console.log(`\nAfter: Supabase ~${fmt(fixed + used())} once compacted; Neon area_stats ~${fmt([...home].filter(([, h]) => h === "neon").reduce((t, [s]) => t + bytes(s), 0))}`);

  // Rows left in both databases by an interrupted run are cleaned up too.
  const strays = [...counts].filter(([s, c]) => c.supabase && c.neon && !moves.some(([m]) => m === s)).map(([s]) => s);
  if (!apply) {
    if (!moves.length && !strays.length) console.log("\nNothing to move.");
    else console.log("\nDry run. Re-run with --apply to move.");
  } else if (moves.length || strays.length) {
    for (const [s, to] of moves) {
      console.log(`\nCopying ${s} to ${to}`);
      await copySource(primary, s, to);
    }
    for (const [s, to] of moves) await primary.query("update datasets set storage = $2, updated_at = now() where slug = $1", [s, to]);
    if (moves.length) {
      console.log(`\nSwitched ${moves.length} dataset(s); waiting ${PLACEMENT_TTL_MS / 1000 + 5}s for the app's placement cache`);
      await new Promise((r) => setTimeout(r, PLACEMENT_TTL_MS + 5000));
    }
    let freed = 0;
    for (const s of [...moves.map(([m]) => m), ...strays]) {
      const from = home.get(s) === "neon" ? "supabase" : "neon";
      const n = await deleteSource(primary, s, from);
      if (from === "supabase") freed += n;
      console.log(`  deleted ${n.toLocaleString()} ${s} rows from ${from}`);
    }
    if (freed && !flag("no-compact")) await compact(primary, "Supabase", { lowDisk: true });
    const { rows: [after] } = await primary.query("select pg_database_size(current_database())::float8 as db");
    console.log(`\nSupabase is now ${fmt(after.db)}`);
  }
}
