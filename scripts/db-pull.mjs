// Mirrors the cloud (production) data into the local Docker stack, so
// localhost renders exactly what production renders.
//
// Usage:
//   node scripts/db-pull.mjs                 # snapshot cloud, then mirror it locally
//   node scripts/db-pull.mjs --from=<dir>    # mirror an existing snapshot (no cloud access)
//
// A snapshot dir holds cloud-public.dump (pg_dump -Fc of the public schema)
// and neon-area-stats.ndjson.gz (the area_stats rows kept in the Neon
// overflow database, src/lib/db/stores.ts). Local has no size cap, so both
// clouds' area_stats land in the one local table. The People & Power graph
// comes over with the Postgres tables; the local Neo4j copy is then rebuilt
// from them (scripts/sync-graph.mjs).
//
// Only reads from cloud. Locally it overwrites every public-data table and
// the whole Neo4j graph; user/account tables (profiles, quiz_sessions,
// map_projects, sync_runs, data_partners, partner_keys) and local-only
// tables are left alone. area_stats is replaced per source, so sources that
// exist only locally (not yet pushed to cloud) survive. Back up first if
// local holds anything unpushed: node scripts/export-db.mjs

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import zlib from "node:zlib";
import pg from "pg";

const KEEP_LOCAL = new Set([
  "profiles",
  "quiz_sessions",
  "map_projects",
  "sync_runs",
  "data_partners",
  "partner_keys",
]);
const STAGE = "cloud_stage";
const SCRATCH_DB = "cloud_pull_scratch";

const fromArg = process.argv.find((a) => a.startsWith("--from="))?.slice(7);
const local = loadEnv(".env.local");

const container = execFileSync("docker", ["ps", "--format", "{{.Names}}"], { encoding: "utf8" })
  .split("\n")
  .find((n) => n.startsWith("supabase_db_"));
if (!container) throw new Error("Local Supabase DB container is not running (supabase start).");

const dir = fromArg ?? (await snapshotCloud());
const dumpFile = path.join(dir, "cloud-public.dump");
if (!fs.existsSync(dumpFile)) throw new Error(`Snapshot is missing ${dumpFile}`);

await mirrorPostgres();
await mirrorNeon();
mirrorNeo4j();
console.log("\nLocal now mirrors", dir);

function loadEnv(file) {
  const out = {};
  for (const line of fs.readFileSync(file, "utf8").split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m) out[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
  return out;
}

function sh(args, input) {
  const r = spawnSync("docker", ["exec", "-i", container, ...args], {
    input,
    encoding: input ? undefined : "utf8",
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`${args.join(" ")}\n${r.stderr}`);
  return r.stdout?.toString() ?? "";
}

function psql(db, sql) {
  return sh(["psql", "-U", "postgres", "-d", db, "-v", "ON_ERROR_STOP=1", "-qAt", "-c", sql]);
}

async function snapshotCloud() {
  const cloud = loadEnv(".env.cloud");
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const out = path.join("backups", `pull-${stamp}`);
  fs.mkdirSync(out, { recursive: true });
  console.log(`Snapshotting cloud into ${out}`);

  const r = spawnSync("docker", ["exec", container, "pg_dump", cloud.DATABASE_URL, "-n", "public", "-Fc"], {
    maxBuffer: 1 << 30,
  });
  if (r.status !== 0) throw new Error(`pg_dump failed: ${r.stderr}`);
  fs.writeFileSync(path.join(out, "cloud-public.dump"), r.stdout);
  await snapshotNeon(cloud.NEON_DATABASE_URL, path.join(out, "neon-area-stats.ndjson.gz"));

  return out;
}

async function mirrorPostgres() {
  console.log("Postgres: staging cloud dump");
  // Restore into a scratch DB, rename its schema, then move that schema into
  // the real DB so the copy is plain SQL with columns matched by name.
  psql("postgres", `drop database if exists ${SCRATCH_DB}`);
  psql("postgres", `create database ${SCRATCH_DB}`);
  try {
    psql(SCRATCH_DB, "drop schema public cascade");
    const dump = fs.readFileSync(dumpFile);
    sh(["pg_restore", "-U", "postgres", "-d", SCRATCH_DB, "--no-owner", "--no-acl"], dump);
    psql(SCRATCH_DB, `alter schema public rename to ${STAGE}`);
    const staged = spawnSync("docker", ["exec", container, "pg_dump", "-U", "postgres", "-d", SCRATCH_DB, "-n", STAGE, "-Fc"], {
      maxBuffer: 1 << 30,
    });
    if (staged.status !== 0) throw new Error(staged.stderr.toString());
    psql("postgres", `drop schema if exists ${STAGE} cascade`);
    sh(["pg_restore", "-U", "postgres", "-d", "postgres", "--no-owner", "--no-acl"], staged.stdout);
  } finally {
    psql("postgres", `drop database if exists ${SCRATCH_DB}`);
  }

  const tables = psql(
    "postgres",
    `select s.table_name from information_schema.tables s
       join information_schema.tables p on p.table_schema = 'public' and p.table_name = s.table_name
      where s.table_schema = '${STAGE}' and s.table_type = 'BASE TABLE' order by 1`,
  )
    .split("\n")
    .filter((t) => t && !KEEP_LOCAL.has(t));

  const stmts = ["set session_replication_role = replica"];
  const full = tables.filter((t) => t !== "area_stats");
  stmts.push(`truncate ${full.map((t) => `public."${t}"`).join(", ")}`);
  for (const t of tables) {
    // Enum columns point at the staged copy of the type; recast via text.
    const [cols, exprs] = psql(
      "postgres",
      `select string_agg(quote_ident(s.column_name), ','),
              string_agg(case when s.udt_schema = '${STAGE}'
                then quote_ident(s.column_name) || '::text::' || format_type(p_t.oid, null)
                else quote_ident(s.column_name) end, ',')
         from information_schema.columns s
         join information_schema.columns p on p.table_schema = 'public' and p.table_name = s.table_name and p.column_name = s.column_name
         left join pg_type p_t on p_t.typname = p.udt_name and p_t.typnamespace = 'public'::regnamespace
        where s.table_schema = '${STAGE}' and s.table_name = '${t}'`,
    )
      .trim()
      .split("|");
    if (t === "area_stats") {
      stmts.push(`delete from public.area_stats where source in (select distinct source from ${STAGE}.area_stats)`);
    }
    stmts.push(`insert into public."${t}" (${cols}) select ${exprs} from ${STAGE}."${t}"`);
  }
  console.log(`Postgres: mirroring ${tables.length} tables`);
  try {
    sh(["psql", "-U", "postgres", "-d", "postgres", "-v", "ON_ERROR_STOP=1", "-q", "--single-transaction"], Buffer.from(stmts.join(";\n") + ";\n"));
  } finally {
    psql("postgres", `drop schema if exists ${STAGE} cascade`);
  }
}

// Neon runs a newer Postgres than the local pg_dump can read, so its rows
// are streamed out through node instead.
async function snapshotNeon(url, file) {
  const gz = zlib.createGzip();
  const done = new Promise((resolve, reject) => gz.pipe(fs.createWriteStream(file)).on("finish", resolve).on("error", reject));
  let n = 0;
  if (url) {
    const client = new pg.Client({ connectionString: url });
    await client.connect();
    try {
      // Pages in primary-key order.
      const key = ["source", "metric", "geo_level", "geoid", "period"];
      let after = null;
      for (;;) {
        const { rows } = await client.query(
          `select * from area_stats ${after ? `where (${key}) > ($1, $2, $3, $4, $5)` : ""} order by ${key} limit 10000`,
          after ?? [],
        );
        if (!rows.length) break;
        for (const row of rows) if (!gz.write(JSON.stringify(row) + "\n")) await new Promise((r) => gz.once("drain", r));
        n += rows.length;
        after = key.map((c) => rows.at(-1)[c]);
      }
    } finally {
      await client.end();
    }
  }
  gz.end();
  await done;
  console.log(`Neon: ${n.toLocaleString()} area_stats rows`);
}

async function mirrorNeon() {
  const file = path.join(dir, "neon-area-stats.ndjson.gz");
  if (!fs.existsSync(file)) return; // snapshot from before the Neon split
  const client = new pg.Client({ connectionString: local.DATABASE_URL });
  await client.connect();
  const seen = new Set();
  let n = 0;
  let batch = [];
  const flush = async () => {
    if (!batch.length) return;
    const columns = Object.keys(batch[0]);
    const params = [];
    const values = batch.map((row) => `(${columns.map((c) => {
      params.push(c === "metadata" && row[c] !== null ? JSON.stringify(row[c]) : row[c]);
      return `$${params.length}`;
    }).join(", ")})`);
    await client.query(`insert into area_stats (${columns.map((c) => `"${c}"`).join(", ")}) values ${values.join(", ")}`, params);
    n += batch.length;
    batch = [];
  };
  try {
    await client.query("begin");
    const lines = readline.createInterface({ input: fs.createReadStream(file).pipe(zlib.createGunzip()), crlfDelay: Infinity });
    for await (const line of lines) {
      if (!line) continue;
      const row = JSON.parse(line);
      // Replace each Neon source wholesale, like the Supabase sources.
      if (!seen.has(row.source)) {
        await flush();
        await client.query("delete from area_stats where source = $1", [row.source]);
        seen.add(row.source);
      }
      batch.push(row);
      if (batch.length >= 4000) await flush();
    }
    await flush();
    await client.query("commit");
  } catch (err) {
    await client.query("rollback");
    throw err;
  } finally {
    await client.end();
  }
  if (n) console.log(`Postgres: mirrored ${n.toLocaleString()} Neon area_stats rows (${[...seen].join(", ")})`);
}

function mirrorNeo4j() {
  console.log("Neo4j: rebuilding the local graph from Postgres");
  const r = spawnSync("node", ["scripts/sync-graph.mjs"], { stdio: "inherit", env: { ...process.env, ENV_FILE: ".env.local" } });
  if (r.status !== 0) throw new Error("sync-graph failed");
}
