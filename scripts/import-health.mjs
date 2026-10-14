// Imports health data into `area_stats`:
//
//   cdc-overdose-deaths  CDC VSRR provisional drug overdose deaths, 12 months
//                        ending each month (data.cdc.gov xkb8-kh2a): nation
//                        by drug, states total. NY + YC (New York City) are
//                        summed into New York State.
//   world-bank-health    life expectancy, infant mortality, and health
//                        spending for the U.S. and peer countries
//
// Usage:
//   node scripts/import-health.mjs [--only=overdose,worldbank]
//   ENV_FILE=.env.cloud node scripts/import-health.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const ONLY = new Set(arg("only", "overdose,worldbank").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

// ---- Overdoses ---------------------------------------------------------------

const INDICATORS = {
  "Number of Drug Overdose Deaths": "overdose_deaths",
  "Opioids (T40.0-T40.4,T40.6)": "overdose_deaths_opioids",
  "Synthetic opioids, excl. methadone (T40.4)": "overdose_deaths_synthetic_opioids",
  "Psychostimulants with abuse potential (T43.6)": "overdose_deaths_stimulants",
  "Cocaine (T40.5)": "overdose_deaths_cocaine",
};
const TOTAL = "Number of Drug Overdose Deaths";

async function importOverdoses(pg) {
  const slug = "cdc-overdose-deaths";
  await registerDataset(pg, slug);
  const list = Object.keys(INDICATORS).map((i) => `'${i}'`).join(",");
  const where = `(state = 'US' and indicator in (${list})) or (state != 'US' and indicator = '${TOTAL}')`;
  const raw = [];
  for (let offset = 0; ; offset += 50_000) {
    const page = await fetchJson(
      `https://data.cdc.gov/resource/xkb8-kh2a.json?$where=${encodeURIComponent(where)}&$order=:id&$limit=50000&$offset=${offset}`,
      { timeoutMs: 300_000 },
      { label: "cdc overdose" },
    );
    raw.push(...page);
    if (page.length < 50_000) break;
  }

  // Sum by (place, metric, month) so YC folds into NY.
  const cells = new Map();
  for (const r of raw) {
    const month = MONTHS.indexOf(r.month);
    const metric = INDICATORS[r.indicator];
    const value = num(r.predicted_value) ?? num(r.data_value);
    if (month < 0 || !metric || value === null) continue;
    const abbr = r.state === "YC" ? "NY" : r.state;
    const geoid = abbr === "US" ? "US" : STATE_FIPS[abbr];
    if (!geoid || (abbr !== "US" && Number(geoid) >= 60)) continue;
    const period = `${r.year}-${String(month + 1).padStart(2, "0")}`;
    const key = `${geoid}|${metric}|${period}`;
    const cell = cells.get(key) ?? { geoid, abbr, metric, period, value: 0, parts: [], predicted: true };
    cell.value += value;
    cell.parts.push(r.state);
    if (num(r.predicted_value) === null) cell.predicted = false;
    cells.set(key, cell);
  }
  const rows = [...cells.values()]
    // New York needs both halves; a month with only one is incomplete.
    .filter((c) => c.abbr !== "NY" || c.parts.length === 2)
    .map((c) => ({
      source: slug, metric: c.metric, geo_level: c.geoid === "US" ? "nation" : "state", geoid: c.geoid,
      geo_name: c.geoid === "US" ? "United States" : STATE_NAMES[c.abbr], period: c.period, period_start: `${c.period}-01`,
      value: Math.round(c.value), unit: "deaths", metadata: c.predicted ? null : { reported: true },
    }));
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- World Bank --------------------------------------------------------------

const COUNTRIES = ["USA", "CAN", "MEX", "GBR", "FRA", "DEU", "ITA", "JPN", "KOR", "AUS", "CHE", "SWE", "NLD", "ESP", "ISR", "CHN", "OED", "WLD"];
const WB = {
  "SP.DYN.LE00.IN": ["life_expectancy", "years"],
  "SP.DYN.IMRT.IN": ["infant_mortality", "per_1000"],
  "SH.XPD.CHEX.GD.ZS": ["health_spending_share_gdp", "percent"],
  "SH.XPD.CHEX.PC.CD": ["health_spending_per_capita", "usd"],
};

async function importWorldBank(pg) {
  const slug = "world-bank-health";
  await registerDataset(pg, slug);
  const rows = [];
  for (const [indicator, [metric, unit]] of Object.entries(WB)) {
    const [meta, data] = await fetchJson(
      `https://api.worldbank.org/v2/country/${COUNTRIES.join(";")}/indicator/${indicator}?format=json&per_page=5000&date=1960:2100`,
      {},
      { label: `World Bank ${indicator}` },
    );
    for (const r of data ?? []) {
      if (r.value === null) continue;
      rows.push({
        source: slug, metric, geo_level: "country", geoid: r.countryiso3code, geo_name: r.country.value,
        period: r.date, period_start: `${r.date}-01-01`, value: Math.round(r.value * 100) / 100, unit, metadata: { updated: meta.lastupdated },
      });
    }
    const found = new Set(rows.filter((r) => r.metric === metric).map((r) => r.geoid));
    const missing = COUNTRIES.filter((c) => !found.has(c));
    if (missing.length) throw new Error(`World Bank ${indicator}: no data for ${missing.join(", ")}`);
  }
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

await runImport("health", async (pg) => {
  let inserted = 0;
  if (ONLY.has("overdose")) inserted += await importOverdoses(pg);
  if (ONLY.has("worldbank")) inserted += await importWorldBank(pg);
  return { inserted };
});
