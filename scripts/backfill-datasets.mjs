// Registers the dataset catalog and runs the importer for every catalog
// dataset that has no rows yet — so a deploy that adds a dataset to
// scripts/lib/catalog.mjs gets its data without a manual import. Datasets
// that already have rows are left to the weekly sync-public-data workflow.
// Runs after each production deploy (.github/workflows/post-deploy.yml).
//
// Usage:
//   node scripts/backfill-datasets.mjs
//   ENV_FILE=.env.cloud node scripts/backfill-datasets.mjs

import { spawnSync } from "node:child_process";
import { connectPg, loadEnv } from "./lib/bulk.mjs";
import { CATALOG, registerDataset } from "./lib/catalog.mjs";

// Catalog slug -> importer. Add an entry with every new catalog dataset.
const IMPORTERS = {
  cbp: ["scripts/import-cbp-encounters.mjs"],
  "dhs-yearbook": ["scripts/import-dhs-yearbook.mjs"],
  "census-pep": ["scripts/import-census-pep.mjs"],
  "census-acs1-immigration": ["scripts/import-acs-immigration.mjs"],
  "ice-detention": ["scripts/import-ice-detention.mjs"],
  "fbi-cde": ["scripts/import-fbi-crime.mjs"],
  "census-acs5": ["scripts/import-acs.mjs"],
  usaspending: ["scripts/import-usaspending.mjs"],
  eavs: ["scripts/import-eavs.mjs"],
};

loadEnv();
const pg = await connectPg();
let missing;
try {
  for (const slug of Object.keys(CATALOG)) await registerDataset(pg, slug);
  const { rows } = await pg.query(
    "select slug from datasets d where partner_id is null and not exists (select 1 from area_stats a where a.source = d.slug) order by slug",
  );
  // Record datasets keep their rows in their own tables, never area_stats.
  missing = rows.map((r) => r.slug).filter((s) => s in CATALOG && !CATALOG[s].records);
} finally {
  await pg.end();
}

const failed = [];
for (const slug of missing) {
  const cmd = IMPORTERS[slug];
  if (!cmd) {
    console.log(`!!! ${slug}: no importer mapped in backfill-datasets.mjs`);
    failed.push(slug);
    continue;
  }
  console.log(`\n=== ${slug}: no rows yet, running ${cmd.join(" ")} ===`);
  const r = spawnSync(process.execPath, cmd, { stdio: "inherit", env: process.env });
  if (r.status !== 0) failed.push(slug);
}

if (!missing.length) console.log("Every catalog dataset has data.");
if (failed.length) {
  // Keep going past one bad source (e.g. the Census key), but surface it.
  console.log(`\nStill missing: ${failed.join(", ")}`);
  process.exitCode = 1;
}
