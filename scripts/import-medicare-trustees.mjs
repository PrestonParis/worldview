// Imports the Medicare Trustees Report's expanded tables into `area_stats`
// (source medicare-trustees, nation, calendar years), actual and projected
// under the intermediate assumptions:
//
//   cost as % of GDP by part (1967–2100), enrollment by part, total income /
//   expenditures / trust fund assets (to depletion), the HI trust fund ratio,
//   HI cost and income rates (% of taxable payroll), and HI covered workers
//   per beneficiary.
//
// metadata.projected marks years after the report's last actual year;
// metadata.report is the Trustees Report year.
//
// Source: https://www.cms.gov/data-research/statistics-trends-and-reports/trustees-report-trust-funds
// (the "Expanded and Supplementary Tables and Figures" zip).
//
// Usage:
//   node scripts/import-medicare-trustees.mjs [--report=2026]
//   ENV_FILE=.env.cloud node scripts/import-medicare-trustees.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "medicare-trustees";
const REPORT = arg("report", "2026");
// CMS has used both names for the zip.
const URLS = [
  `https://www.cms.gov/files/zip/${REPORT}-expanded-supplementary-tables-figures.zip`,
  `https://www.cms.gov/files/zip/${REPORT}-expanded-and-supplementary-tables-and-figures.zip`,
];

// [file name pattern, { column index: [metric, unit] }]
const TABLES = [
  [/^HI and SMI Incurred Expenditures as a Percentage of the Gross Domestic Product\.csv$/, {
    4: ["medicare_expenditures", "usd_millions"],
    6: ["part_a_cost_gdp", "percent_gdp"], 7: ["part_b_cost_gdp", "percent_gdp"], 8: ["part_d_cost_gdp", "percent_gdp"],
    10: ["medicare_cost_gdp", "percent_gdp"],
  }],
  [/^Medicare Enrollment by Part and in Total\.csv$/, {
    1: ["enrollment_part_a", "millions"], 2: ["enrollment_part_b", "millions"], 3: ["enrollment_part_d", "millions"], 4: ["enrollment_total", "millions"],
  }],
  [/^Total Medicare Income, Expenditures and Trust Fund Assets/, {
    1: ["trust_fund_income", "usd_millions"], 2: ["trust_fund_expenditures", "usd_millions"], 4: ["trust_fund_assets", "usd_millions"],
  }],
  [/^Ratio of Assets at the Beginning of the Year to Expenditures/, { 1: ["hi_trust_fund_ratio", "percent"] }],
  [/^HI Cost and Income Rates\.csv$/, { 1: ["hi_cost_rate", "percent"], 2: ["hi_income_rate", "percent"], 3: ["hi_balance_rate", "percent"] }],
  [/^Ratio of HI Covered Workers to HI Beneficiaries\.csv$/, { 1: ["hi_workers_per_beneficiary", "ratio"] }],
];

const value = (s) => {
  const n = Number(String(s ?? "").replace(/[,%\s]/g, ""));
  return String(s ?? "").trim() === "" || !Number.isFinite(n) ? null : n;
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const dir = mkdtempSync(join(tmpdir(), "medicare-tr-"));
  let res;
  for (const url of URLS) {
    res = await fetch(url, { headers: { "User-Agent": "worldview-data-import/1.0" } });
    if (res.ok) break;
  }
  if (!res.ok) throw new Error(`No Medicare Trustees tables zip for ${REPORT} (${res.status})`);
  writeFileSync(join(dir, "tr.zip"), Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", join(dir, "tr.zip"), "-d", dir]);
  const csvDir = readdirSync(dir, { recursive: true }).find((p) => /(^|\/)CSV$/.test(p));
  const files = readdirSync(join(dir, csvDir)).filter((f) => f.endsWith(".csv"));

  const out = [];
  for (const [pattern, cols] of TABLES) {
    const file = files.find((f) => pattern.test(f));
    if (!file) throw new Error(`Trustees zip has no table matching ${pattern}`);
    const text = readFileSync(join(dir, csvDir, file), "utf8").replace(/^﻿/, "");
    const title = text.split("\n")[0];
    // "(Actual data through 2025)" / "Historical amounts through 2025"
    const actualThrough = Number(/through (\d{4})/i.exec(title)?.[1] ?? Number(REPORT) - 1);
    // Positional columns: give parseCsv a synthetic header (c0, c1, …).
    const rows = parseCsv(`${Array.from({ length: 30 }, (_, i) => `c${i}`).join(",")}\n${text}`);
    for (const r of rows) {
      const year = String(r.c0 ?? "").trim();
      if (!/^\d{4}$/.test(year)) continue;
      for (const [i, [metric, unit]] of Object.entries(cols)) {
        const v = value(r[`c${i}`]);
        if (v === null) continue;
        out.push({
          source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States", period: year,
          period_start: `${year}-01-01`, value: v, unit, metadata: { report: Number(REPORT), projected: Number(year) > actualThrough },
        });
      }
    }
  }
  if (!out.some((r) => r.metric === "medicare_cost_gdp")) throw new Error("Trustees tables: no cost as % of GDP — layout changed?");
  console.log(`  ${out.length} rows from the ${REPORT} report`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: REPORT };
});
