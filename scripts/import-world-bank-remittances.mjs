// Imports World Bank personal-remittance series into `area_stats` (source
// world-bank-remittances), annual:
//
//   remittances_paid             nation (U.S.), money sent abroad, current USD
//   remittances_received         geo_level 'country' (geoid = ISO3), current USD
//   remittances_received_gdp_pct geo_level 'country', share of the
//                                receiving country's GDP
//
// The World Bank's API has no country-to-country flows; the U.S. figure is
// all remittances leaving the U.S.
//
// Source: https://api.worldbank.org/v2 (indicators BM.TRF.PWKR.CD.DT,
// BX.TRF.PWKR.CD.DT, BX.TRF.PWKR.DT.GD.ZS) — free, no key.
//
// Usage:
//   node scripts/import-world-bank-remittances.mjs
//   ENV_FILE=.env.cloud node scripts/import-world-bank-remittances.mjs

import { fetchJson, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "world-bank-remittances";
const API = "https://api.worldbank.org/v2";

async function indicator(countries, id) {
  const out = [];
  for (let page = 1; ; page++) {
    const [meta, rows] = await fetchJson(`${API}/country/${countries}/indicator/${id}?format=json&per_page=20000&page=${page}`);
    out.push(...(rows ?? []));
    if (page >= meta.pages) break;
  }
  return out.filter((r) => r.value !== null);
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  // Aggregates (regions, income groups) have no ISO3 in the country list.
  const [, countries] = await fetchJson(`${API}/country?format=json&per_page=400`);
  const real = new Set(countries.filter((c) => c.region?.id !== "NA").map((c) => c.id));
  const out = [];
  const row = (metric, geoLevel, geoid, name, r, unit) =>
    out.push({
      source: SOURCE, metric, geo_level: geoLevel, geoid, geo_name: name, period: r.date, period_start: `${r.date}-01-01`,
      value: r.value, unit, metadata: null,
    });
  for (const r of await indicator("USA", "BM.TRF.PWKR.CD.DT")) row("remittances_paid", "nation", "US", "United States", r, "usd");
  for (const [id, metric, unit] of [
    ["BX.TRF.PWKR.CD.DT", "remittances_received", "usd"],
    ["BX.TRF.PWKR.DT.GD.ZS", "remittances_received_gdp_pct", "percent"],
  ]) {
    for (const r of await indicator("all", id)) if (real.has(r.countryiso3code)) row(metric, "country", r.countryiso3code, r.country.value, r, unit);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
