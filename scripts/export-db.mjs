// Point-in-time dump to backups/<timestamp>/ as plain JSON — one file per
// Postgres table, including the People & Power graph (entities,
// entity_edges, ...), and a manifest.json with row counts. Neo4j holds only
// a copy of the graph (scripts/sync-graph.mjs), so it isn't exported.
//
// This is the backup that did NOT exist when the graph was wiped. Run it
// before any destructive change, and on a schedule. Output lands under
// backups/ which is gitignored (except the one recovered snapshot) — copy
// dumps you want to keep to durable storage, not git.
//
// Usage: node scripts/export-db.mjs
//   Restore Postgres from a dump:  node scripts/restore-postgres-backup.mjs <dir>
//   Then rebuild Neo4j:            node scripts/sync-graph.mjs

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

// NOTE: hand-maintained. Add new tables here as they're created (Elections
// and Legislation tables are also missing — worth switching this to an
// information_schema enumeration).
const PG_TABLES = [
  "entities",
  "entity_identifiers",
  "entity_offices",
  "entity_edges",
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
        ({ rows } = await pg.query(`select * from ${table}`));
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
