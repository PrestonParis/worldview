// Imports IRS Statistics of Income Table 4.1 — who earns the income and
// pays the federal income tax — into `area_stats` (source irs-soi-tax-shares),
// nation, tax years 2001 onward, for the top 0.001% … top 50% of returns
// (descending cumulative percentiles) and the bottom 50% (derived):
//
//   tax_share_<group>    share of all federal income tax paid
//   agi_share_<group>    share of all adjusted gross income
//   avg_tax_rate_<group> income tax as a share of AGI (top groups and all)
//   agi_floor_<group>    AGI needed to be in the group (current dollars)
//
// group = top_0_001, top_0_01, top_0_1, top_1, top_5, top_10, top_25,
// top_50, bottom_50, all.
//
// Source: https://www.irs.gov/statistics/soi-tax-stats-individual-statistical-tables-by-tax-rate-and-income-percentile
// (23in41ts.xlsx; pass --file= for the next year's) — free, no key.
//
// Usage:
//   node scripts/import-irs-tax-shares.mjs [--file=23in41ts.xlsx]
//   ENV_FILE=.env.cloud node scripts/import-irs-tax-shares.mjs

import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "irs-soi-tax-shares";
const FILE = arg("file", "23in41ts.xlsx");
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
// Column index -> group (column 1 is all returns).
const COLUMNS = { 1: "all", 2: "top_0_001", 3: "top_0_01", 4: "top_0_1", 5: "top_1", 9: "top_5", 10: "top_10", 12: "top_25", 15: "top_50" };
const SECTIONS = [
  [/^Adjusted gross income floor on percentiles \(current/, "agi_floor", "usd"],
  [/^Average tax rate/, "avg_tax_rate", "percent"],
  [/^Adjusted gross income share/, "agi_share", "percent"],
  [/^Total income tax share/, "tax_share", "percent"],
];

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const book = readXlsx(Buffer.from(await (await fetchRetry(`https://www.irs.gov/pub/irs-soi/${FILE}`, BROWSER)).arrayBuffer()));
  const rows = Object.values(book)[0];
  const out = [];
  let section = null;
  for (const r of rows) {
    if (typeof r[0] === "string") {
      section = SECTIONS.find(([re]) => re.test(r[0].trim())) ?? null;
      continue;
    }
    if (!section || typeof r[0] !== "number") continue;
    const [, prefix, unit] = section;
    const year = String(r[0]);
    const add = (group, value) =>
      out.push({
        source: SOURCE, metric: `${prefix}_${group}`, geo_level: "nation", geoid: "US", geo_name: "United States",
        period: year, period_start: `${year}-01-01`, value: Math.round(value * 100) / 100, unit, metadata: { file: FILE },
      });
    for (const [i, group] of Object.entries(COLUMNS)) if (typeof r[i] === "number") add(group, r[i]);
    // The bottom half's shares are what the top half leaves.
    if ((prefix === "tax_share" || prefix === "agi_share") && typeof r[15] === "number") add("bottom_50", 100 - r[15]);
  }
  for (const want of ["tax_share_top_1", "agi_share_bottom_50", "avg_tax_rate_all"]) {
    if (!out.some((r) => r.metric === want)) throw new Error(`${FILE}: no ${want} rows — layout changed?`);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted, cursor: FILE };
});
