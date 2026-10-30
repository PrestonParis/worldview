// Imports Congressional Budget Office budget data into `area_stats`
// (source cbo-budget, nation; fiscal years as FY2026, calendar years as 2026), from CBO's open data repository
// (github.com/US-CBO/cbo-data), which republishes the spreadsheets on
// cbo.gov as tidy CSVs:
//
//   historical_budget  revenues, outlays by category, deficits, and debt held
//                      by the public, actual, FY1962 onward (dollars + % of GDP)
//   ten_year_budget    the current 10-year baseline (proj_*): revenues,
//                      outlays by program, deficits, debt, interest
//   long_term_budget   the 30-year extended baseline (lt_*): debt, deficits,
//                      Social Security, Medicare, Medicaid, interest, revenues
//                      as % of GDP; Medicare HI trust fund to depletion
//   trust_fund         Social Security (OASI, DI) and Medicare (HI, SMI) and
//                      other trust fund balances and cash flows (tf_*)
//   tax_parameters     federal income tax brackets and rates, standard
//                      deduction, child tax credit, EITC, payroll tax cap, and
//                      effective marginal tax rates on labor and capital
//                      (tp_*), calendar years, current law
//
// Each dataset is read from its latest vintage (or --vintage=YYYY-MM).
// Metric names are CBO's variable names; labels and units come from each
// dataset's schema.json. metadata.vintage is the CBO release; ten-year rows
// carry metadata.projected (the first year of a vintage is actual).
//
// Usage:
//   node scripts/import-cbo.mjs [--vintage=2026-02]
//   ENV_FILE=.env.cloud node scripts/import-cbo.mjs

import { arg, fetchJson, fetchRetry, num, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "cbo-budget";
const REPO = "US-CBO/cbo-data";
const RAW = `https://raw.githubusercontent.com/${REPO}/HEAD/data/budget`;
const VINTAGE = arg("vintage", null);
// dataset → file prefix (fiscal-year files, except tax parameters)
const DATASETS = { historical_budget: "annual_fy_", ten_year_budget: "annual_fy_", long_term_budget: "annual_fy_", trust_fund: "annual_fy_", tax_parameters: "annual_cy_" };

const UNITS = {
  billions_of_dollars: "usd_billions", "Billions of $": "usd_billions", "Trillions $": "usd_trillions", "Trillions of $": "usd_trillions",
  "% of GDP": "percent_gdp", "%": "percent", "Percentage points": "percentage_points",
  Dollars: "usd", Percent: "percent", Index: "index", Count: "count",
};

// Which variables to keep from each dataset. The ten-year file also holds
// change-since-last-baseline tables, alternative scenarios, and
// timing-adjusted duplicates; trust-fund surplus (tf_sur_*) rows repeat with
// table subtotals, so the per-fund cash-flow rows are used instead.
const KEEP = {
  historical_budget: () => true,
  ten_year_budget: (v) => v.startsWith("proj_") && !/timing_adj|_ba$|^proj_(exp|seq)_/.test(v),
  long_term_budget: () => true,
  trust_fund: (v) => !v.startsWith("tf_sur_"),
  tax_parameters: (v) => !v.startsWith("tp_delta_"),
};

await runImport(SOURCE, async (pg) => {
  const tree = await fetchJson(`https://api.github.com/repos/${REPO}/git/trees/HEAD?recursive=1`, {}, { label: "cbo-data tree" });
  const metrics = {};
  const out = [];
  const vintages = {};
  for (const [dataset, prefix] of Object.entries(DATASETS)) {
    const fiscal = prefix === "annual_fy_";
    const files = tree.tree.map((t) => t.path).filter((p) => p.startsWith(`data/budget/${dataset}/${prefix}`) && /_\d{4}-\d{2}\.csv$/.test(p)).sort();
    const file = VINTAGE ? files.find((f) => f.endsWith(`_${VINTAGE}.csv`)) : files.at(-1);
    if (!file) throw new Error(`cbo-data has no ${dataset} file${VINTAGE ? ` for ${VINTAGE}` : ""}`);
    const vintage = file.match(/_(\d{4}-\d{2})\.csv$/)[1];
    vintages[dataset] = vintage;
    const schema = await fetchJson(`${RAW}/${dataset}/schema.json`, {}, { label: `${dataset} schema` });
    const rows = parseCsv(await (await fetchRetry(`${RAW}/${dataset}/${file.split("/").at(-1)}`)).text());
    const firstYear = Math.min(...rows.map((r) => Number(r.date.slice(2))).filter(Number.isFinite));
    const seen = new Set();
    for (const r of rows) {
      const v = r.variable;
      const value = num(r.value);
      const year = r.date.replace(/^[FC]Y/, "");
      if (!KEEP[dataset](v) || value === null || !/^\d{4}$/.test(year) || seen.has(`${v}|${year}`)) continue;
      seen.add(`${v}|${year}`);
      const field = schema.fields?.[v] ?? {};
      const unit = UNITS[field.unit] ?? (v.endsWith("_gdp_share") ? "percent_gdp" : "usd_billions");
      metrics[v] ??= { label: field.description ?? v, unit };
      const metadata = { vintage, dataset };
      if (dataset === "ten_year_budget") metadata.projected = Number(year) > firstYear;
      if (dataset === "long_term_budget") metadata.projected = true;
      if (dataset === "tax_parameters") metadata.projected = Number(year) > firstYear;
      out.push({
        source: SOURCE, metric: v, geo_level: "nation", geoid: "US", geo_name: "United States", period: fiscal ? `FY${year}` : year,
        period_start: fiscal ? `${Number(year) - 1}-10-01` : `${year}-01-01`, value, unit, metadata,
      });
    }
    console.log(`  ${dataset} ${vintage}: ${rows.length} source rows`);
  }
  await registerDataset(pg, SOURCE, metrics);
  for (const want of ["debt_held_by_public_gdp_share", "lt_debt_held_by_public_gdp_share", "tf_bal_oasi"]) {
    if (!out.some((r) => r.metric === want)) throw new Error(`cbo-data has no ${want} — variable renamed?`);
  }
  console.log(`  ${out.length} rows, ${Object.keys(metrics).length} metrics`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: JSON.stringify(vintages) };
});
