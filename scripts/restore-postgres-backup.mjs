// Restores Postgres rows (sources, claims, contributions) from a backup
// directory of the shape `scripts/export-db.mjs` writes — plain JSON
// arrays, one file per table. Idempotent: every insert is ON CONFLICT DO
// NOTHING keyed on the primary key (and the unique external_id for
// contributions), so re-running only fills gaps and never overwrites a
// row that's already there.
//
// Neo4j is NOT touched here — entities/edges restore via
// `scripts/reconstruct-fec-graph.mjs` (money graph) and
// `scripts/seed.mjs` (canonical fixtures).
//
// Usage: node scripts/restore-postgres-backup.mjs <backup-dir>
//   e.g. node scripts/restore-postgres-backup.mjs backups/2026-09-06T21-05-25

process.loadEnvFile(".env.local");

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const backupDir = process.argv[2];
if (!backupDir) {
  console.error("Usage: node scripts/restore-postgres-backup.mjs <backup-dir>");
  process.exit(1);
}
if (!fs.existsSync(backupDir)) {
  console.error(`Backup directory not found: ${backupDir}`);
  process.exit(1);
}

function read(table) {
  const file = path.join(backupDir, `${table}.json`);
  if (!fs.existsSync(file)) {
    console.log(`  ${table}.json — not in backup, skipping`);
    return [];
  }
  const rows = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(rows)) throw new Error(`${file} is not a JSON array`);
  return rows;
}

// Column order per table. Restore order matters: sources before claims
// (claims.source_id -> sources.id) and before contributions
// (contributions.source_record_id -> sources.id).
const TABLES = {
  sources: [
    "id", "title", "url", "publisher", "source_type",
    "published_at", "notes", "created_at", "updated_at",
  ],
  claims: [
    "id", "speaker_entity_id", "date", "venue", "quote", "topic",
    "position_classification", "confidence", "contradicts_claim_id",
    "source_id", "created_at", "updated_at",
    "verdict", "verdict_notes", "verified_at",
  ],
  contributions: [
    "id", "donor_entity_id", "recipient_entity_id", "amount", "currency",
    "date", "source_record_id", "notes", "external_id",
    "created_at", "updated_at",
  ],
};

async function restoreTable(pg, table, columns) {
  const rows = read(table);
  if (rows.length === 0) {
    console.log(`  ${table}: nothing to restore`);
    return;
  }

  let inserted = 0;
  for (const row of rows) {
    const values = columns.map((c) => (row[c] === undefined ? null : row[c]));
    const placeholders = columns.map((_, i) => `$${i + 1}`).join(", ");
    const res = await pg.query(
      `insert into ${table} (${columns.join(", ")})
       values (${placeholders})
       on conflict do nothing
       returning id`,
      values,
    );
    if (res.rows.length > 0) inserted++;
  }
  console.log(
    `  ${table}: ${inserted} inserted, ${rows.length - inserted} already present (${rows.length} in backup)`,
  );
}

async function main() {
  console.log(`Restoring Postgres from ${backupDir}`);
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  try {
    for (const [table, columns] of Object.entries(TABLES)) {
      await restoreTable(pg, table, columns);
    }
  } finally {
    await pg.end();
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
