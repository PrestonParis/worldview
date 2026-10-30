// Imports the Kiel Institute's Ukraine Support Tracker into `area_stats`
// (source kiel-ukraine-support): government aid to Ukraine since the
// Russian invasion (January 24, 2022 onward).
//
//   geo_level 'donor' (slug of the donor, e.g. united_states,
//   eu_commission_and_council; 'total' for all donors): cumulative financial,
//   humanitarian, military, and total allocations and commitments in dollars,
//   and the donor's 2021 GDP, with the period set to the release's last month
//   (metadata.from / through give the window)
//   geo_level 'donor', monthly: allocations by month in euros — United
//   States, Europe, other donors, and all donors by kind of aid
//
// The tracker's workbook URL changes with each release; the importer finds
// it on the tracker page (or pass --file= / --url=).
//
// Source: https://www.kielinstitut.de/research/topics/war-against-ukraine/ukraine-support-tracker/
//
// Usage:
//   node scripts/import-ukraine-support.mjs [--file=Ukraine_Support_Tracker.xlsx]
//   ENV_FILE=.env.cloud node scripts/import-ukraine-support.mjs

import { readFileSync } from "node:fs";
import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "kiel-ukraine-support";
const PAGE = "https://www.kielinstitut.de/research/topics/war-against-ukraine/ukraine-support-tracker/";
const slug = (s) => s.toLowerCase().replace(/[()]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
const excelDate = (n) => new Date(Date.UTC(1899, 11, 30) + n * 864e5).toISOString().slice(0, 10);

const SUMMARY = {
  "Financial allocations": "allocated_financial", "Humanitarian allocations": "allocated_humanitarian", "Military allocations": "allocated_military",
  "Total bilateral allocations": "allocated_total", "Financial commitments": "committed_financial", "Humanitarian commitments": "committed_humanitarian",
  "Military commitments": "committed_military", "Total bilateral commitments": "committed_total",
};
// Monthly figure: column header → [donor geoid, donor name, metric]
const MONTHLY = {
  "United States, allocated (€ billion)": ["united_states", "United States", "allocated_total_eur"],
  "Europe, allocated (€ billion)": ["europe", "Europe", "allocated_total_eur"],
  "Other donors, allocated (€ billion)": ["other_donors", "Other donors", "allocated_total_eur"],
  "Total aid, committed (€ billion)": ["total", "All donors", "committed_total_eur"],
  "Total aid, allocated (€ billion)": ["total", "All donors", "allocated_total_eur"],
  "Financial aid, allocated (€ billion)": ["total", "All donors", "allocated_financial_eur"],
  "Humanitarian aid, allocated (€ billion)": ["total", "All donors", "allocated_humanitarian_eur"],
  "Military aid, allocated (€ billion)": ["total", "All donors", "allocated_military_eur"],
};

async function workbook() {
  if (arg("file", null)) return readFileSync(arg("file"));
  let url = arg("url", null);
  if (!url) {
    const html = await (await fetchRetry(PAGE)).text();
    const href = html.match(/href="([^"]*Ukraine_Support_Tracker[^"]*\.xlsx)"/i)?.[1];
    if (!href) throw new Error("No tracker workbook link on the Kiel page — pass --url=");
    url = new URL(href, PAGE).href;
  }
  console.log(`  ${url}`);
  return Buffer.from(await (await fetchRetry(url, { timeoutMs: 600_000 })).arrayBuffer());
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const book = readXlsx(await workbook());
  const out = [];
  const add = (geoid, name, metric, period, periodStart, value, unit, metadata = {}) =>
    out.push({ source: SOURCE, metric, geo_level: "donor", geoid, geo_name: name, period, period_start: periodStart, value, unit, metadata });

  // Monthly allocations (one row per month, Excel serial dates).
  const fig = book["Fig 1. Allocated over time"];
  const hi = fig.findIndex((r) => r[1] === "Month");
  const header = fig[hi];
  let last = null;
  for (const r of fig.slice(hi + 1)) {
    if (typeof r[1] !== "number") continue;
    const date = excelDate(r[1]);
    last = date;
    header.forEach((h, i) => {
      const spec = MONTHLY[h];
      if (spec && typeof r[i] === "number") add(spec[0], spec[1], spec[2], date.slice(0, 7), date, Math.round(r[i] * 1e9), "eur");
    });
  }

  // Cumulative totals by donor, in dollars.
  const sum = book["Country Summary ($)"];
  const shi = sum.findIndex((r) => r[1] === "Country");
  const cols = sum[shi];
  const through = last.slice(0, 7);
  for (const r of sum.slice(shi + 2)) {
    const name = typeof r[1] === "string" ? r[1].trim() : null;
    if (!name) continue;
    const geoid = name === "Total" ? "total" : slug(name);
    // The sheet continues with other tables below; the first ends at "Total".
    cols.forEach((h, i) => {
      // Column names repeat further right (shares of GDP); use the first, in $.
      if (SUMMARY[h] && cols.indexOf(h) === i && typeof r[i] === "number") add(geoid, name === "Total" ? "All donors" : name, SUMMARY[h], through, `${through}-01`, Math.round(r[i] * 1e9), "usd", { from: "2022-01-24", through });
    });
    const gdp = cols.indexOf("GDP (2021)");
    if (gdp >= 0 && typeof r[gdp] === "number") add(geoid, name, "gdp_2021", through, `${through}-01`, Math.round(r[gdp] * 1e9), "usd");
    if (name === "Total") break;
  }
  if (!out.some((r) => r.geoid === "united_states" && r.metric === "allocated_military")) throw new Error("Kiel tracker: no U.S. military allocations — layout changed?");
  console.log(`  ${out.length} rows, through ${through}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: through };
});
