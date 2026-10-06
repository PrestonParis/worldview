// Applies every supabase/sql/*.sql file that hasn't been applied yet, in
// filename order, each in its own transaction, and records it in
// schema_migrations. Runs automatically:
//   - in the Vercel production build (`npm run build`), before `next build`,
//     so a deploy never ships code ahead of its tables — a failed migration
//     fails the build and the previous deployment stays live;
//   - before `npm run dev`, against the local stack.
//
// Usage:
//   node scripts/migrate.mjs                       # .env.local
//   ENV_FILE=.env.cloud node scripts/migrate.mjs   # cloud
//   node scripts/migrate.mjs --if-vercel-production  # build hook: no-op elsewhere
//
// Migration files must stay additive and idempotent (CREATE ... IF NOT
// EXISTS); never edit one after it has shipped — add a new dated file.

import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

const DIR = "supabase/sql";

if (process.argv.includes("--if-vercel-production") && process.env.VERCEL_ENV !== "production") {
  console.log("migrate: skipped (not a Vercel production build)");
  process.exit(0);
}

// On Vercel the vars come from the project settings, not a file.
const envFile = process.env.ENV_FILE || ".env.local";
if (!process.env.VERCEL && existsSync(envFile)) process.loadEnvFile(envFile);
if (!process.env.DATABASE_URL) throw new Error("migrate: DATABASE_URL is not set");

const files = readdirSync(DIR)
  .filter((f) => f.endsWith(".sql"))
  .sort();

const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
try {
  const { rows: existed } = await client.query("select to_regclass('public.schema_migrations') is not null as ok");
  await client.query(`create table if not exists schema_migrations (
    filename text primary key,
    applied_at timestamptz not null default now()
  )`);
  // Databases migrated by hand before this runner existed: a file whose
  // tables are all already there was applied — record it without re-running
  // (re-running 2026-10-02-profiles.sql would grandfather every account).
  if (!existed[0].ok) {
    for (const f of files) {
      const tables = [...readFileSync(path.join(DIR, f), "utf8").matchAll(/CREATE TABLE IF NOT EXISTS "(\w+)"/gi)].map((m) => m[1]);
      if (!tables.length) continue;
      const { rows } = await client.query("select count(*)::int as n from pg_tables where schemaname = 'public' and tablename = any($1)", [tables]);
      if (rows[0].n === tables.length) {
        await client.query("insert into schema_migrations (filename) values ($1) on conflict do nothing", [f]);
        console.log(`migrate: baseline ${f}`);
      }
    }
  }

  const { rows: done } = await client.query("select filename from schema_migrations");
  const applied = new Set(done.map((r) => r.filename));
  const pending = files.filter((f) => !applied.has(f));
  for (const f of pending) {
    try {
      await client.query("begin");
      await client.query(readFileSync(path.join(DIR, f), "utf8"));
      await client.query("insert into schema_migrations (filename) values ($1)", [f]);
      await client.query("commit");
      console.log(`migrate: applied ${f}`);
    } catch (err) {
      await client.query("rollback");
      throw new Error(`migrate: ${f} failed: ${err.message}`);
    }
  }
  if (!pending.length) console.log("migrate: up to date");
} finally {
  await client.end();
}
