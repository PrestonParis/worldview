// Validates the entity foreign keys (supabase/sql/2026-10-16-entity-foreign-keys.sql),
// which were added NOT VALID: once a column has no rows pointing at a
// missing entity, its constraint is validated, so the database vouches for
// old rows too. Columns that still have such rows are listed and left alone
// (scripts/repair-orphan-donors.mjs fixes the contributions ones).
//
// Usage: node scripts/validate-entity-fks.mjs   (ENV_FILE=.env.cloud for cloud)

import { connectPg, loadEnv } from "./lib/bulk.mjs";
import { ENTITY_REFERENCES } from "./lib/entities.mjs";

loadEnv();
const pg = await connectPg();
try {
  for (const { table, column, constraint } of ENTITY_REFERENCES) {
    const { rows } = await pg.query(
      "select convalidated from pg_constraint where conname = $1 and conrelid = $2::regclass",
      [constraint, table],
    );
    if (!rows.length) {
      console.log(`  ${constraint}: missing (run scripts/migrate.mjs)`);
      continue;
    }
    if (rows[0].convalidated) continue;
    const { rows: orphans } = await pg.query(
      `select count(*)::int as n from ${table} t
       where ${column} is not null and not exists (select 1 from entities e where e.id = t.${column})`,
    );
    if (orphans[0].n) {
      console.log(`  ${constraint}: ${orphans[0].n} rows point at missing entities; not validated`);
      continue;
    }
    await pg.query(`alter table ${table} validate constraint ${constraint}`);
    console.log(`  ${constraint}: validated`);
  }
} finally {
  await pg.end();
}
