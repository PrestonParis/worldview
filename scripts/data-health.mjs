// Reports on the data pipeline: importers whose latest run failed or never
// finished, and datasets whose newest period is older than their cadence
// allows. Writes a Markdown summary to $GITHUB_STEP_SUMMARY when set (the
// weekly export-lake workflow) and exits 1 when an importer's latest run
// failed, so the workflow goes red.
//
// Usage: node scripts/data-health.mjs   (ENV_FILE=.env.cloud for cloud)

import { appendFileSync } from "node:fs";
import { connectPg, loadEnv } from "./lib/bulk.mjs";
import { closeNeon, neon } from "./lib/stores.mjs";

// Longest acceptable gap, in days, between the end of a dataset's newest
// period and today, by cadence (datasets.cadence is free text; first match
// wins). Publishers release a period well after it ends (annual surveys
// about nine months later, provisional monthly counts four or five), so
// these allow for that.
const MAX_LAG_DAYS = [
  [/^daily|^weekly/i, 45],
  [/^biweekly/i, 60],
  [/^monthly/i, 180],
  [/^quarterly/i, 240],
  [/^annual/i, 730],
  [/^biennial|every two years/i, 1100],
];
// Importers scheduled weekly (.github/workflows/sync-*.yml).
const WEEKLY = new Set([
  "congress-bills", "congress-votes", "fec-cycle", "fec-schedule-e-2026", "openstates-people",
  "voteview-members", "federal-register", "cbp-encounters", "ice-detention", "census-pep", "fred",
]);
const DAY = 86_400_000;

// End of a period label: "2024", "2025-08", "2024-Q3", "FY2024" (federal
// fiscal years end September 30).
function periodEnd(period) {
  const m = /^(FY)?(\d{4})(?:-(\d{2}))?(?:-Q([1-4]))?/.exec(period ?? "");
  if (!m) return null;
  const year = Number(m[2]);
  if (m[1]) return new Date(Date.UTC(year, 8, 30));
  if (m[3]) return new Date(Date.UTC(year, Number(m[3]), 0));
  if (m[4]) return new Date(Date.UTC(year, Number(m[4]) * 3, 0));
  return new Date(Date.UTC(year, 11, 31));
}

loadEnv();
const pg = await connectPg();
const problems = [];
const lines = ["# Data health", ""];
try {
  const { rows: runs } = await pg.query(
    `select distinct on (source) source, status, started_at, finished_at, left(coalesce(error, ''), 160) as error
     from sync_runs order by source, started_at desc`,
  );
  lines.push("## Importers", "", "| Source | Last run | Status | Note |", "|---|---|---|---|");
  for (const r of runs) {
    let note = "";
    const age = (Date.now() - new Date(r.started_at).getTime()) / DAY;
    if (r.status === "error") {
      note = r.error;
      problems.push(`${r.source}: last run failed`);
    } else if (!r.finished_at && age > 1) {
      note = "never finished";
    } else if (WEEKLY.has(r.source) && age > 8) {
      note = `no run in ${Math.floor(age)} days`;
    }
    lines.push(`| ${r.source} | ${new Date(r.started_at).toISOString().slice(0, 10)} | ${r.status} | ${note.replaceAll("|", "\\|")} |`);
  }

  const { rows: datasets } = await pg.query("select slug, cadence, storage from datasets where status = 'published'");
  // One indexed lookup per dataset (the primary key leads with source),
  // in whichever database holds it.
  const latest = new Map();
  for (const d of datasets) {
    const db = d.storage === "neon" ? neon() : pg;
    if (!db) continue;
    const { rows } = await db.query("select max(period) as period from area_stats where source = $1", [d.slug]);
    if (rows[0].period) latest.set(d.slug, rows[0].period);
  }
  lines.push("", "## Datasets behind their cadence", "", "| Dataset | Cadence | Newest period | Days since it ended |", "|---|---|---|---|");
  let behind = 0;
  for (const d of datasets.sort((a, b) => a.slug.localeCompare(b.slug))) {
    const end = periodEnd(latest.get(d.slug));
    const limit = MAX_LAG_DAYS.find(([re]) => re.test(d.cadence ?? ""))?.[1];
    if (!end || !limit) continue;
    const lag = Math.floor((Date.now() - end.getTime()) / DAY);
    if (lag <= limit) continue;
    behind++;
    lines.push(`| ${d.slug} | ${d.cadence} | ${latest.get(d.slug)} | ${lag} |`);
  }
  if (!behind) lines.push("| (none) | | | |");
  const empty = datasets.filter((d) => !latest.has(d.slug)).map((d) => d.slug);
  lines.push("", `Datasets without area_stats rows (record datasets or not yet loaded): ${empty.join(", ") || "none"}`);
} finally {
  await pg.end();
  await closeNeon();
}

const report = lines.join("\n");
console.log(report);
if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${report}\n`);
if (problems.length) {
  console.error(`\n${problems.length} importer(s) failing: ${problems.join("; ")}`);
  process.exitCode = 1;
}
