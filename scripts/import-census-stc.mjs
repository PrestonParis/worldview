// Imports the Census Bureau's Annual Survey of State Government Tax
// Collections into `area_stats` (source census-stc): what each state
// government collects, by kind of tax, for the nation and every state,
// fiscal years 1902 onward (most states every year since 1951; earlier
// years are sparse).
//
//   total_taxes, property_tax, general_sales_tax, selective_sales_taxes,
//   motor_fuel_tax, tobacco_tax, alcohol_tax, insurance_premium_tax,
//   sports_betting_tax, license_taxes, motor_vehicle_license,
//   individual_income_tax, corporate_income_tax, severance_tax,
//   death_and_gift_tax — in dollars
//
// State governments only (local property and sales taxes are not included).
// Each state's fiscal year is the one ending in the year shown; most end
// June 30.
//
// Source: https://www.census.gov/programs-surveys/stc.html
// (STC-Historical-DB.xlsx, amounts in thousands of dollars).
//
// Usage:
//   node scripts/import-census-stc.mjs
//   ENV_FILE=.env.cloud node scripts/import-census-stc.mjs

import { fetchRetry, num, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "census-stc";
const URL = "https://www2.census.gov/programs-surveys/stc/datasets/historical/STC-Historical-DB.xlsx";
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

// Census item code (header row) → metric
const ITEMS = {
  C105: "total_taxes",
  T01: "property_tax",
  T09: "general_sales_tax",
  C109: "selective_sales_taxes",
  T13: "motor_fuel_tax",
  T16: "tobacco_tax",
  T10: "alcohol_tax",
  T12: "insurance_premium_tax",
  T18: "sports_betting_tax",
  C118: "license_taxes",
  C123: "motor_vehicle_license",
  T40: "individual_income_tax",
  T41: "corporate_income_tax",
  T53: "severance_tax",
  T50: "death_and_gift_tax",
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const book = readXlsx(Buffer.from(await (await fetchRetry(URL)).arrayBuffer()));
  const sheet = Object.entries(book).find(([name]) => /STC_Historical/i.test(name))?.[1];
  if (!sheet) throw new Error("STC workbook has no STC_Historical sheet — layout changed?");
  const header = sheet[0].map((h) => String(h ?? "").trim());
  const iYear = header.indexOf("Year");
  const iName = header.indexOf("Name");
  const cols = Object.entries(ITEMS).map(([code, metric]) => [header.indexOf(code), metric]).filter(([i]) => i >= 0);
  if (cols.length < 10) throw new Error(`STC header is missing item codes: ${header.join(",")}`);

  const out = [];
  let latest = 0;
  for (const r of sheet.slice(2)) {
    const year = num(r[iYear]);
    const name = String(r[iName] ?? "");
    if (!year) continue;
    // "US STATE GOVTS", "AL STATE GOVT"
    const abbr = /^([A-Z]{2}) STATE GOVT/.exec(name)?.[1];
    const [level, geoid] = abbr === "US" ? ["nation", "US"] : STATE_FIPS[abbr] ? ["state", STATE_FIPS[abbr]] : [];
    if (!level) continue;
    latest = Math.max(latest, year);
    for (const [i, metric] of cols) {
      const v = num(r[i]);
      if (v === null) continue; // "X" = not applicable
      out.push({
        source: SOURCE, metric, geo_level: level, geoid, geo_name: level === "nation" ? "United States" : FIPS_TO_NAME[geoid],
        period: String(year), period_start: `${year - 1}-07-01`, value: v * 1000, unit: "usd", metadata: {},
      });
    }
  }
  if (!out.some((r) => r.geoid === "06" && r.metric === "individual_income_tax")) throw new Error("STC: no California income tax rows — layout changed?");
  console.log(`  ${out.length} rows, 1902–${latest}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: String(latest) };
});
