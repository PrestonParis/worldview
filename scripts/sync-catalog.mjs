// Registers every built-in dataset (scripts/lib/catalog.mjs) in the
// `datasets` table — titles, publishers, methodology, metric labels — and
// reports which have no rows in area_stats yet. Each importer also registers
// its own entry, so this is only needed after editing the catalog.
//
// Usage:
//   node scripts/sync-catalog.mjs
//   ENV_FILE=.env.cloud node scripts/sync-catalog.mjs

import { connectPg, loadEnv } from "./lib/bulk.mjs";
import { CATALOG, registerDataset } from "./lib/catalog.mjs";

loadEnv();
const pg = await connectPg();
try {
  for (const slug of Object.keys(CATALOG)) await registerDataset(pg, slug);
  const { rows } = await pg.query(
    "select d.slug, (select count(*) from area_stats a where a.source = d.slug)::int as n from datasets d order by d.slug",
  );
  for (const r of rows) console.log(`  ${r.slug.padEnd(26)} ${r.n ? `${r.n.toLocaleString()} rows` : "no data yet"}`);
} finally {
  await pg.end();
}
