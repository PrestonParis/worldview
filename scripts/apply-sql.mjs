// Applies an idempotent SQL file to DATABASE_URL — for additive table
// creation without `drizzle-kit push`, which also wants to reconcile (and
// can drop) anything else that differs between schema.ts and the database.
//
// Usage: node scripts/apply-sql.mjs supabase/sql/<file>.sql
//        ENV_FILE=.env.cloud node scripts/apply-sql.mjs supabase/sql/<file>.sql

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import { readFileSync } from "node:fs";
import { Client } from "pg";

const file = process.argv[2];
if (!file) {
  console.error("usage: node scripts/apply-sql.mjs <file.sql>");
  process.exit(1);
}

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  await client.query("begin");
  await client.query(readFileSync(file, "utf8"));
  await client.query("commit");
  console.log(`Applied ${file}`);
} catch (err) {
  await client.query("rollback");
  console.error(err.message);
  process.exitCode = 1;
} finally {
  await client.end();
}
