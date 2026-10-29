// Imports the Federal Bureau of Prisons' weekly population "quick facts"
// into `area_stats` (source bop-population), nation only: every count and
// percent the BOP publishes (citizenship, race, ethnicity, sex, age bands,
// sentence length, offense, security level). The BOP posts only the
// current week, so each run adds that week's snapshot (period = the BOP's
// update date, YYYY-MM-DD); run it regularly to build the series.
//
// Metric names are the BOP's field names as prefix_rest, e.g.
// citizen_mexico, citizen_mexico_pct, race_black, offense_immigration_pct.
//
// Source: https://www.bop.gov/PublicInfo/execute/quickfacts (JSON behind
// bop.gov/about/statistics) — free, no key.
//
// Usage:
//   node scripts/import-bop.mjs
//   ENV_FILE=.env.cloud node scripts/import-bop.mjs

import { fetchJson, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "bop-population";
const URL = "https://www.bop.gov/PublicInfo/execute/quickfacts?todo=query&output=json";
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };

// The BOP's camelCase is inconsistent ("sentenceFiveToTen" vs
// "sentenceFivetoTenPct") and misspelled, so names are rebuilt as a known
// prefix plus the lowercased rest: sentence_fivetoten, sentence_fivetoten_pct.
const FIXES = { sentenct: "sentence", fithteen: "fifteen", fifthteen: "fifteen", ohter: "other" };
const PREFIXES = ["staff_race", "staff", "trans", "citizen", "race", "ethnicity", "gender", "age", "sentence", "offense", "security_level", "total", "average"];
function snake(k) {
  const pct = /Pct$/.test(k);
  let base = Object.entries(FIXES).reduce((s, [bad, good]) => s.replace(new RegExp(bad, "gi"), good), k.replace(/Pct$/, "")).toLowerCase();
  base = base.replace(/^securitylevel/, "security_level").replace(/^staffrace/, "staff_race").replace(/(.)count$/, "$1");
  const prefix = PREFIXES.find((p) => base.startsWith(p) && base.length > p.length);
  if (prefix) base = `${prefix}_${base.slice(prefix.length)}`;
  return pct ? `${base}_pct` : base;
}
const label = (metric) => metric.replace(/_pct$/, " (%)").replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase());

await runImport(SOURCE, async (pg) => {
  const { quickFacts: q } = await fetchJson(URL, BROWSER);
  const date = new Date(`${q.lastUpdateDate.replace(/^\w+, /, "")} UTC`);
  if (Number.isNaN(date.getTime())) throw new Error(`BOP: unreadable update date "${q.lastUpdateDate}"`);
  const period = date.toISOString().slice(0, 10);
  const out = [];
  for (const [k, raw] of Object.entries(q)) {
    if (k === "lastUpdateDate" || typeof raw !== "string") continue;
    const value = Number(raw.replace(/,/g, ""));
    if (!Number.isFinite(value)) continue;
    const metric = snake(k);
    out.push({
      source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States",
      period, period_start: period, value, unit: metric.endsWith("_pct") ? "percent" : metric === "average_age" ? "years" : "people",
      metadata: null,
    });
  }
  await registerDataset(pg, SOURCE, Object.fromEntries(out.map((r) => [r.metric, { label: label(r.metric), unit: r.unit }])));
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${period}: ${out.length} figures`);
  return { inserted, cursor: period };
});
