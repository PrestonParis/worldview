// Publishes Parquet extracts to the lake (scripts/lib/lake.mjs):
//   area-stats/<dataset>.parquet   every published dataset, from whichever
//                                  database holds it (Supabase or Neon)
//   tables/<table>.parquet         the public record tables: people and
//                                  relationships, legislation, money,
//                                  elections, courts, executive actions
// Accounts, quizzes, saved maps, and partner keys are never exported.
// Files whose content didn't change aren't re-uploaded. Linked from
// /datasets/<slug> and listed at /api/data/v1/datasets.
//
// Usage:
//   node scripts/export-lake.mjs [--only=cbp,bills]
//   ENV_FILE=.env.cloud node scripts/export-lake.mjs

import { arg, connectPg, loadEnv } from "./lib/bulk.mjs";
import { attach, closeLake, exportParquet } from "./lib/lake.mjs";
import { placements } from "./lib/stores.mjs";

const RECORD_TABLES = [
  "entities", "entity_edges", "entity_identifiers", "entity_offices",
  "bills", "bill_actions", "bill_cosponsors", "bill_committees", "bill_relations", "bill_text_versions",
  "roll_calls", "votes", "member_ideology",
  "contributions", "candidate_finance", "independent_expenditures", "lobbying_registrations", "lobbying_issues",
  "elections", "candidacies", "election_results", "race_ratings", "polls", "poll_results",
  "executive_documents", "court_cases", "case_votes",
  "geographies", "geo_levels", "sources", "claims",
];

const only = arg("only", "").split(",").map((s) => s.trim()).filter(Boolean);
const wanted = (name) => !only.length || only.includes(name);

loadEnv();
const pg = await connectPg();
try {
  const { rows: datasets } = await pg.query("select slug from datasets where status = 'published' order by slug");
  const where = await placements(pg, datasets.map((d) => d.slug));
  let uploaded = 0;
  const report = (r) => {
    if (r.empty) return;
    if (r.changed) uploaded++;
    console.log(`  ${r.path}: ${r.rows.toLocaleString()} rows, ${(r.bytes / 1024).toFixed(0)} KB${r.changed ? "" : " (unchanged)"}`);
  };

  for (const { slug } of datasets.filter((d) => wanted(d.slug))) {
    const neon = where.get(slug) === "neon";
    const url = neon ? process.env.NEON_DATABASE_URL : process.env.DATABASE_URL;
    if (!url) throw new Error(`${slug} is stored in Neon but NEON_DATABASE_URL is not set`);
    const src = await attach(url);
    report(await exportParquet(pg, {
      source: slug,
      objectPath: `area-stats/${slug}.parquet`,
      query: `SELECT source, metric, geo_level, geoid, geo_name, period, period_start, value, unit,
                     CAST(metadata AS VARCHAR) AS metadata, updated_at
              FROM ${src}.public.area_stats WHERE source = '${slug.replaceAll("'", "''")}'
              ORDER BY metric, geo_level, geoid, period`,
    }));
  }

  for (const table of RECORD_TABLES.filter(wanted)) {
    const { rows } = await pg.query("select to_regclass($1) is not null as ok", [`public.${table}`]);
    if (!rows[0].ok) continue;
    const src = await attach(process.env.DATABASE_URL);
    report(await exportParquet(pg, {
      source: table,
      objectPath: `tables/${table}.parquet`,
      query: `SELECT * FROM ${src}.public.${table}`,
    }));
  }
  console.log(`\nexport-lake: ${uploaded} files uploaded`);
} finally {
  await closeLake();
  await pg.end();
}
