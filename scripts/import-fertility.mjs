// Imports national birth and fertility series into `area_stats`:
//
//   cdc-natality          National Center for Health Statistics (CDC open data)
//     births              live births, 1909–2018 (dataset e6fc-ccez)
//     general_fertility_rate   births per 1,000 women 15–44
//     crude_birth_rate    births per 1,000 people
//                         1909–2018 from e6fc-ccez, 2016 on from Health,
//                         United States (daba-4vfq), which wins where both
//                         have a year
//
//   world-bank-fertility  World Bank World Development Indicators
//     total_fertility_rate   births per woman (SP.DYN.TFRT.IN), 1960 on, for
//                         the U.S., peer countries, and the world
//                         (geo_level 'country', geoid ISO3; the world 'WLD')
//
// Usage:
//   node scripts/import-fertility.mjs [--only=cdc,worldbank]
//   ENV_FILE=.env.cloud node scripts/import-fertility.mjs

import { arg, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const ONLY = new Set(arg("only", "cdc,worldbank").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const US = { geo_level: "nation", geoid: "US", geo_name: "United States" };

async function importCdc(pg) {
  const slug = "cdc-natality";
  await registerDataset(pg, slug);
  const rows = new Map();
  const add = (metric, year, value, unit, dataset) => {
    if (value === null) return;
    rows.set(`${metric}|${year}`, { source: slug, metric, ...US, period: year, period_start: `${year}-01-01`, value, unit, metadata: { dataset } });
  };

  const history = await fetchJson("https://data.cdc.gov/resource/e6fc-ccez.json?$limit=500", {}, { label: "CDC e6fc-ccez" });
  for (const r of history) {
    add("births", r.year, num(r.birth_number), "births", "e6fc-ccez");
    add("general_fertility_rate", r.year, num(r.general_fertility_rate), "per_1000", "e6fc-ccez");
    add("crude_birth_rate", r.year, num(r.crude_birth_rate), "per_1000", "e6fc-ccez");
  }

  // Health, United States: "Total" rows only (all women / all people).
  const recent = await fetchJson(
    "https://data.cdc.gov/resource/daba-4vfq.json?$where=classification='Total'&$limit=500",
    {},
    { label: "CDC daba-4vfq" },
  );
  for (const r of recent) {
    if (r.subtopic === "Fertility rate") add("general_fertility_rate", r.time_period, num(r.estimate), "per_1000", "daba-4vfq");
    else if (r.subtopic === "Birth rate" && /total population/.test(r.estimate_type)) add("crude_birth_rate", r.time_period, num(r.estimate), "per_1000", "daba-4vfq");
  }
  if (!rows.size) throw new Error("CDC natality: no rows");
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, [...rows.values()], KEY);
  console.log(`  ${slug}: ${rows.size} rows`);
  return inserted;
}

// The U.S. alongside large economies and close neighbours.
const COUNTRIES = ["USA", "CAN", "MEX", "GBR", "FRA", "DEU", "ITA", "JPN", "KOR", "CHN", "IND", "ISR", "AUS", "WLD"];

async function importWorldBank(pg) {
  const slug = "world-bank-fertility";
  await registerDataset(pg, slug);
  const [meta, data] = await fetchJson(
    `https://api.worldbank.org/v2/country/${COUNTRIES.join(";")}/indicator/SP.DYN.TFRT.IN?format=json&per_page=2000&date=1960:2100`,
    {},
    { label: "World Bank SP.DYN.TFRT.IN" },
  );
  const rows = (data ?? [])
    .filter((r) => r.value !== null)
    .map((r) => ({
      source: slug, metric: "total_fertility_rate", geo_level: "country", geoid: r.countryiso3code, geo_name: r.country.value,
      period: r.date, period_start: `${r.date}-01-01`, value: r.value, unit: "per_woman", metadata: { updated: meta.lastupdated },
    }));
  const found = new Set(rows.map((r) => r.geoid));
  const missing = COUNTRIES.filter((c) => !found.has(c));
  if (missing.length) throw new Error(`World Bank: no data for ${missing.join(", ")}`);
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

await runImport("fertility", async (pg) => {
  let inserted = 0;
  if (ONLY.has("cdc")) inserted += await importCdc(pg);
  if (ONLY.has("worldbank")) inserted += await importWorldBank(pg);
  return { inserted };
});
