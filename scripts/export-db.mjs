// Point-in-time dump of both stores to backups/<timestamp>/ as plain JSON
// — one file per Postgres table plus entities.json / edges.json from
// Neo4j, and a manifest.json with row counts.
//
// This is the backup that did NOT exist when the graph was wiped. Run it
// before any destructive change, and on a schedule. Output lands under
// backups/ which is gitignored (except the one recovered snapshot) — copy
// dumps you want to keep to durable storage, not git.
//
// Usage: node scripts/export-db.mjs
//   Restore Postgres from a dump:  node scripts/restore-postgres-backup.mjs <dir>
//   Restore Neo4j: no generic restore yet — reconstruct-fec-graph.mjs and
//   seed.mjs are the current paths.

process.loadEnvFile(".env.local");

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";
import neo4j from "neo4j-driver";

// NOTE: hand-maintained. Add new tables here as they're created (Elections
// and Legislation tables are also missing — worth switching this to an
// information_schema enumeration).
const PG_TABLES = [
  "sources",
  "claims",
  "contributions",
  "candidate_finance",
  "lobbying_registrations",
  "lobbying_issues",
  "bills",
  "votes",
  "map_projects",
];

function serialize(value) {
  if (value == null) return value;
  if (neo4j.isInt(value)) return value.toNumber();
  if (
    neo4j.isDateTime(value) ||
    neo4j.isDate(value) ||
    neo4j.isLocalDateTime(value) ||
    neo4j.isLocalTime(value) ||
    neo4j.isTime(value) ||
    neo4j.isDuration(value)
  ) {
    return value.toString();
  }
  if (Array.isArray(value)) return value.map(serialize);
  if (typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, serialize(v)]));
  }
  return value;
}

async function main() {
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, "-");
  const outDir = path.join("backups", stamp);
  fs.mkdirSync(outDir, { recursive: true });
  console.log(`Exporting to ${outDir}`);

  const counts = {};

  // --- Postgres ---
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    for (const table of PG_TABLES) {
      let rows;
      try {
        ({ rows } = await pg.query(`select * from ${table} order by created_at nulls last`));
      } catch (err) {
        console.log(`  ${table}: skipped (${err.message.split("\n")[0]})`);
        continue;
      }
      fs.writeFileSync(path.join(outDir, `${table}.json`), JSON.stringify(rows, null, 2));
      counts[table] = rows.length;
      console.log(`  ${table}: ${rows.length}`);
    }
  } finally {
    await pg.end();
  }

  // --- Neo4j ---
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();
  try {
    const entityRes = await session.run("MATCH (e:Entity) RETURN properties(e) AS p ORDER BY e.name");
    const entities = entityRes.records.map((r) => serialize(r.get("p")));
    fs.writeFileSync(path.join(outDir, "entities.json"), JSON.stringify(entities, null, 2));
    counts.entities = entities.length;
    console.log(`  entities: ${entities.length}`);

    const edgeRes = await session.run(
      `MATCH (a:Entity)-[r:RELATED_TO]->(b:Entity)
       RETURN properties(r) AS p, a.id AS sourceEntityId, b.id AS targetEntityId
       ORDER BY r.createdAt`,
    );
    const edges = edgeRes.records.map((r) => ({
      ...serialize(r.get("p")),
      sourceEntityId: r.get("sourceEntityId"),
      targetEntityId: r.get("targetEntityId"),
    }));
    fs.writeFileSync(path.join(outDir, "edges.json"), JSON.stringify(edges, null, 2));
    counts.edges = edges.length;
    console.log(`  edges: ${edges.length}`);
  } finally {
    await session.close();
    await driver.close();
  }

  fs.writeFileSync(
    path.join(outDir, "manifest.json"),
    JSON.stringify({ capturedAt: new Date().toISOString(), counts }, null, 2),
  );
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
