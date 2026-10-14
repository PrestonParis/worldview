// Registers every built-in dataset (scripts/lib/catalog.mjs) in the
// `datasets` table — titles, publishers, methodology, metric labels — and
// reports which have no rows in area_stats yet (in Supabase or Neon) (record datasets keep
// theirs in their own tables). Each importer also registers
// its own entry, so this is only needed after editing the catalog.
//
// Usage:
//   node scripts/sync-catalog.mjs
//   ENV_FILE=.env.cloud node scripts/sync-catalog.mjs

import { connectPg, loadEnv } from "./lib/bulk.mjs";
import { CATALOG, registerDataset } from "./lib/catalog.mjs";
import { closeNeon, sourceCounts } from "./lib/stores.mjs";

loadEnv();
const pg = await connectPg();
try {
  for (const slug of Object.keys(CATALOG)) await registerDataset(pg, slug);
  const counts = await sourceCounts(pg);
  const { rows } = await pg.query("select slug, storage from datasets order by slug");
  for (const r of rows) {
    const c = counts.get(r.slug);
    const n = c ? c.supabase + c.neon : 0;
    const status = n ? `${n.toLocaleString()} rows (${r.storage})` : CATALOG[r.slug]?.records ? "record dataset (own tables)" : "no data yet";
    console.log(`  ${r.slug.padEnd(28)} ${status}`);
  }
} finally {
  await pg.end();
  await closeNeon();
}
