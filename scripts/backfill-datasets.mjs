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
import { checkCensusKey, connectPg, loadEnv } from "./lib/bulk.mjs";
import { CATALOG, registerDataset } from "./lib/catalog.mjs";
import { closeNeon, sourceCounts } from "./lib/stores.mjs";

// Catalog slug -> importer. Add an entry with every new catalog dataset.
const IMPORTERS = {
  cbp: ["scripts/import-cbp-encounters.mjs"],
  "dhs-yearbook": ["scripts/import-dhs-yearbook.mjs"],
  "dhs-unauthorized": ["scripts/import-dhs-unauthorized.mjs"],
  "census-historical-nativity": ["scripts/import-census-historical-nativity.mjs"],
  "census-pep": ["scripts/import-census-pep.mjs"],
  "census-acs1-immigration": ["scripts/import-acs-immigration.mjs"],
  "ice-detention": ["scripts/import-ice-detention.mjs"],
  "census-state-migration": ["scripts/import-state-migration.mjs"],
  "un-migrant-stock": ["scripts/import-un-migrant-stock.mjs"],
  "fbi-cde": ["scripts/import-fbi-crime.mjs"],
  "fbi-cde-cities": ["scripts/import-fbi-cities.mjs"],
  "fbi-hate-crime": ["scripts/import-fbi-annual.mjs", "--only=hate"],
  "fbi-arrests": ["scripts/import-fbi-annual.mjs", "--only=arrests"],
  "cdc-violent-deaths": ["scripts/import-cdc-violent-deaths.mjs"],
  "bjs-ncvs": ["scripts/import-bjs-ncvs.mjs"],
  "guttmacher-monthly-abortions": ["scripts/import-abortion.mjs", "--only=monthly"],
  "guttmacher-pregnancy-history": ["scripts/import-abortion.mjs", "--only=history"],
  "cdc-abortion-surveillance": ["scripts/import-abortion.mjs", "--only=cdc"],
  "abortion-gestational-limits": ["scripts/import-abortion.mjs", "--only=limits"],
  "census-acs5": ["scripts/import-acs.mjs"],
  usaspending: ["scripts/import-usaspending.mjs"],
  eavs: ["scripts/import-eavs.mjs"],
  "cps-voting": ["scripts/import-cps-voting.mjs"],
  "census-acs1-family": ["scripts/import-acs-social.mjs", "--only=acs"],
  "census-acs1-social": ["scripts/import-acs-social.mjs", "--only=acs"],
  "census-urban-rural": ["scripts/import-acs-social.mjs", "--only=urban"],
  "cdc-natality": ["scripts/import-fertility.mjs", "--only=cdc"],
  "world-bank-fertility": ["scripts/import-fertility.mjs", "--only=worldbank"],
  "pew-rls": ["scripts/import-religion.mjs", "--only=pew"],
  "gallup-religion": ["scripts/import-religion.mjs", "--only=gallup"],
  "omb-historical-tables": ["scripts/import-federal-budget.mjs", "--only=omb"],
  "treasury-fiscal-data": ["scripts/import-federal-budget.mjs", "--only=treasury"],
  "payment-accuracy": ["scripts/import-federal-budget.mjs", "--only=accuracy"],
  "fred-economy": ["scripts/import-fred.mjs", "--only=economy,states"],
  "fred-housing": ["scripts/import-fred.mjs", "--only=housing,states"],
  "fred-energy-prices": ["scripts/import-fred.mjs", "--only=energy"],
  "fred-education": ["scripts/import-fred.mjs", "--only=education"],
  "census-acs1-health": ["scripts/import-acs-issues.mjs", "--only=health"],
  "census-acs1-housing": ["scripts/import-acs-issues.mjs", "--only=housing"],
  "cdc-overdose-deaths": ["scripts/import-health.mjs", "--only=overdose"],
  "world-bank-health": ["scripts/import-health.mjs", "--only=worldbank"],
  "cdc-injury-mortality": ["scripts/import-guns.mjs", "--only=cdc"],
  "gallup-guns": ["scripts/import-guns.mjs", "--only=gallup"],
  naep: ["scripts/import-naep.mjs"],
  "owid-energy": ["scripts/import-climate.mjs", "--only=owid"],
  "noaa-climate": ["scripts/import-climate.mjs", "--only=noaa"],
  "foreign-assistance": ["scripts/import-foreign-assistance.mjs"],
  "census-trade": ["scripts/import-census-trade.mjs"],
};

// Importers that exit on a missing or rejected CENSUS_API_KEY.
const NEEDS_CENSUS_KEY = new Set(["census-acs5", "census-acs1-immigration", "census-acs1-family", "census-acs1-social", "census-urban-rural", "census-acs1-health", "census-acs1-housing"]);

loadEnv();
const pg = await connectPg();
let missing;
try {
  for (const slug of Object.keys(CATALOG)) await registerDataset(pg, slug);
  // Rows may be in Supabase or Neon (scripts/lib/stores.mjs).
  const counts = await sourceCounts(pg);
  const { rows: built } = await pg.query("select slug from datasets where partner_id is null order by slug");
  const rows = built.filter((r) => !counts.has(r.slug));
  // Record datasets keep their rows in their own tables, never area_stats.
  missing = rows.map((r) => r.slug).filter((s) => s in CATALOG && !CATALOG[s].records);
} finally {
  await pg.end();
  await closeNeon();
}

// A bad Census key is a known, external problem: skip those datasets with a
// warning rather than failing every deploy on it.
let censusKeyError = null;
if (missing.some((slug) => NEEDS_CENSUS_KEY.has(slug))) {
  censusKeyError = await checkCensusKey(process.env.CENSUS_API_KEY).then(() => null, (err) => err.message);
}

const failed = [];
const skipped = [];
for (const slug of missing) {
  if (censusKeyError && NEEDS_CENSUS_KEY.has(slug)) {
    skipped.push(slug);
    continue;
  }
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
if (skipped.length) {
  console.log(`\n::warning::Skipped ${skipped.join(", ")}: ${censusKeyError}`);
}
if (failed.length) {
  // Keep going past one bad source, but surface it.
  console.log(`\nStill missing: ${failed.join(", ")}`);
  process.exitCode = 1;
}
