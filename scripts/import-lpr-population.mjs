// Imports DHS Office of Homeland Security Statistics estimates of the
// lawful permanent resident (green-card holder) population into `area_stats`
// (source ohss-lpr-population), period 'YYYY' (as of January 1):
//
//   lpr_population, lpr_eligible_to_naturalize   nation, 2006–
//   lpr_population   by geo_level 'country', 'state' (FIPS), 'class' — latest year
//
// The national series is data/immigration/lpr-population.json: OHSS
// publishes each year in its own PDF report and revises earlier years, so
// the file keeps the latest vintage of each year with the report it came
// from. The breakdowns are read from the latest report's HTML tables.
//
// Source: https://ohss.dhs.gov/topics/immigration/lawful-permanent-residents/population-estimates
//
// Usage:
//   node scripts/import-lpr-population.mjs [--url=<latest report page>]
//   ENV_FILE=.env.cloud node scripts/import-lpr-population.mjs

import { readFileSync } from "node:fs";
import { arg, fetchRetry, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "ohss-lpr-population";
const PAGE = arg("url", "https://ohss.dhs.gov/topics/immigration/lawful-permanent-residents/population-estimates/fy-25-lpr-pop-estimates");
const { estimates } = JSON.parse(readFileSync(new URL("../data/immigration/lpr-population.json", import.meta.url)));
const TABLES = { "Table 2a.": "country", "Table 5.": "class", "Table 6.": "state" };
const text = (s) =>
  s.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&#039;|&#39;/g, "'").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  const row = (metric, level, geoid, name, year, value, meta) =>
    out.push({ source: SOURCE, metric, geo_level: level, geoid, geo_name: name, period: String(year), period_start: `${year}-01-01`, value, unit: "people", metadata: meta });
  for (const e of estimates) {
    row("lpr_population", "nation", "US", "United States", e.year, e.population, { report: e.report });
    row("lpr_eligible_to_naturalize", "nation", "US", "United States", e.year, e.eligible, { report: e.report });
  }

  const html = await (await fetchRetry(PAGE)).text();
  const latest = estimates.at(-1).year;
  for (const [label, level] of Object.entries(TABLES)) {
    const at = html.indexOf(label);
    const table = at < 0 ? null : /<table.*?<\/table>/s.exec(html.slice(at))?.[0];
    if (!table) throw new Error(`LPR population: ${label} not found`);
    const rows = [...table.matchAll(/<tr.*?<\/tr>/gs)].map((r) => [...r[0].matchAll(/<t[hd].*?<\/t[hd]>/gs)].map((c) => text(c[0])));
    const col = rows[0].indexOf(`${latest} LPR Population Estimate`);
    if (col < 0) throw new Error(`LPR population: ${label} has no ${latest} column`);
    let n = 0;
    for (const r of rows.slice(1)) {
      const [name] = r;
      const value = Number(String(r[col] ?? "").replace(/,/g, ""));
      if (!name || name === "Total" || !Number.isFinite(value)) continue;
      const fips = level === "state" ? STATE_FIPS[STATE_NAME_TO_ABBR[name]] : null;
      if (level === "state" && !fips) continue; // territories, "Other", "Unknown"
      row("lpr_population", level, fips ?? slug(name), name, latest, value, { report: PAGE });
      n++;
    }
    const total = Number(rows.find((r) => r[0] === "Total")?.[col]?.replace(/,/g, ""));
    if (total !== estimates.at(-1).population) throw new Error(`LPR population: ${label} total ${total} ≠ national ${estimates.at(-1).population}`);
    console.log(`  ${label} ${level}: ${n} rows`);
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
