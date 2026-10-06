// Mirrors the cloud (production) data into the local Docker stack, so
// localhost renders exactly what production renders.
//
// Usage:
//   node scripts/db-pull.mjs                 # snapshot cloud, then mirror it locally
//   node scripts/db-pull.mjs --from=<dir>    # mirror an existing snapshot (no cloud access)
//
// A snapshot dir holds cloud-public.dump (pg_dump -Fc of the public schema)
// plus entities.json / edges.json (scripts/export-db.mjs format).
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
import neo4j from "neo4j-driver";

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
for (const f of [dumpFile, path.join(dir, "entities.json"), path.join(dir, "edges.json")]) {
  if (!fs.existsSync(f)) throw new Error(`Snapshot is missing ${f}`);
}

await mirrorPostgres();
await mirrorNeo4j();
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

  const driver = neo4j.driver(cloud.NEO4J_URI, neo4j.auth.basic(cloud.NEO4J_USER, cloud.NEO4J_PASSWORD));
  const session = driver.session();
  try {
    // Same shape as export-db.mjs: ints as numbers, temporals as ISO strings.
    const str = (v) => (neo4j.isInt(v) ? v.toNumber() : neo4j.isDateTime(v) ? v.toString() : v);
    const clean = (p) => Object.fromEntries(Object.entries(p).map(([k, v]) => [k, str(v)]));
    const ents = await session.run("MATCH (e:Entity) RETURN properties(e) AS p");
    fs.writeFileSync(path.join(out, "entities.json"), JSON.stringify(ents.records.map((r) => clean(r.get("p")))));
    const edges = await session.run(
      "MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity) RETURN properties(r) AS p, a.id AS s, b.id AS t",
    );
    fs.writeFileSync(
      path.join(out, "edges.json"),
      JSON.stringify(edges.records.map((r) => ({ ...clean(r.get("p")), sourceEntityId: r.get("s"), targetEntityId: r.get("t") }))),
    );
  } finally {
    await session.close();
    await driver.close();
  }
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

async function mirrorNeo4j() {
  const entities = JSON.parse(fs.readFileSync(path.join(dir, "entities.json"), "utf8"));
  const edges = JSON.parse(fs.readFileSync(path.join(dir, "edges.json"), "utf8"));
  const driver = neo4j.driver(local.NEO4J_URI, neo4j.auth.basic(local.NEO4J_USER, local.NEO4J_PASSWORD));
  const session = driver.session();
  const batch = async (rows, cypher) => {
    for (let i = 0; i < rows.length; i += 1000) await session.run(cypher, { rows: rows.slice(i, i + 1000) });
  };
  try {
    console.log("Neo4j: clearing local graph");
    await session.run("MATCH (n) CALL (n) { DETACH DELETE n } IN TRANSACTIONS OF 5000 ROWS");
    console.log(`Neo4j: loading ${entities.length} entities, ${edges.length} edges`);
    await batch(
      entities,
      `UNWIND $rows AS row
       CREATE (e:Entity) SET e = row, e.createdAt = datetime(row.createdAt), e.updatedAt = datetime(row.updatedAt)`,
    );
    await session.run("CREATE INDEX entity_id IF NOT EXISTS FOR (e:Entity) ON (e.id)");
    await session.run("CALL db.awaitIndexes()");
    await batch(
      edges,
      `UNWIND $rows AS row
       MATCH (a:Entity {id: row.sourceEntityId}), (b:Entity {id: row.targetEntityId})
       CREATE (a)-[r:RELATED_TO]->(b)
       SET r = row {.*, sourceEntityId: null, targetEntityId: null},
           r.createdAt = datetime(row.createdAt), r.updatedAt = datetime(row.updatedAt)`,
    );
    const n = (await session.run("MATCH (n:Entity) RETURN count(n) AS c")).records[0].get("c").toNumber();
    const r = (await session.run("MATCH ()-[r:RELATED_TO]->() RETURN count(r) AS c")).records[0].get("c").toNumber();
    console.log(`Neo4j: local now has ${n} entities, ${r} edges`);
  } finally {
    await session.close();
    await driver.close();
  }
}
