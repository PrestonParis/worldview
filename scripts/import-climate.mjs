// Imports energy and climate data into `area_stats`:
//
//   owid-energy   Our World in Data: CO₂ emissions (Global Carbon Project) and
//                 electricity generation shares by source, for the U.S.,
//                 other large emitters, and the world (geo_level 'country',
//                 ISO3 geoid; EU27 and WLD for the aggregates)
//   noaa-climate  NOAA Climate at a Glance: annual average temperature for
//                 the contiguous U.S. (nation) and each state, 1895 onward
//
// Usage:
//   node scripts/import-climate.mjs [--only=owid,noaa]
//   ENV_FILE=.env.cloud node scripts/import-climate.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchJson, fetchRetry, num, parseCsv, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const ONLY = new Set(arg("only", "owid,noaa").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];

// ---- Our World in Data ---------------------------------------------------------

// OWID country name -> geoid.
const COUNTRIES = {
  "United States": "USA", China: "CHN", India: "IND", "European Union (27)": "EU27", Russia: "RUS", Japan: "JPN",
  Germany: "DEU", "United Kingdom": "GBR", France: "FRA", Canada: "CAN", World: "WLD",
};
const FILES = {
  co2: {
    url: "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv",
    from: 1950,
    // column -> [metric, unit, scale]
    columns: { co2: ["co2_emissions", "tonnes", 1e6], co2_per_capita: ["co2_per_capita", "tonnes_per_person", 1], share_global_co2: ["co2_share_global", "percent", 1] },
  },
  energy: {
    url: "https://raw.githubusercontent.com/owid/energy-data/master/owid-energy-data.csv",
    from: 1985,
    columns: Object.fromEntries(
      ["coal", "gas", "nuclear", "hydro", "wind", "solar", "oil", "low_carbon"].map((k) => [`${k}_share_elec`, [`elec_share_${k}`, "percent", 1]]),
    ),
  },
};

async function importOwid(pg) {
  const slug = "owid-energy";
  await registerDataset(pg, slug);
  const rows = [];
  for (const [name, file] of Object.entries(FILES)) {
    const csv = parseCsv(await (await fetchRetry(file.url, { timeoutMs: 300_000 }, { label: `OWID ${name}` })).text());
    const missingCols = Object.keys(file.columns).filter((c) => !(c in (csv[0] ?? {})));
    if (missingCols.length) throw new Error(`OWID ${name}: columns missing: ${missingCols.join(", ")}`);
    for (const r of csv) {
      const geoid = COUNTRIES[r.country];
      const year = Number(r.year);
      if (!geoid || year < file.from) continue;
      for (const [col, [metric, unit, scale]] of Object.entries(file.columns)) {
        const v = num(r[col]);
        if (v === null) continue;
        rows.push({
          source: slug, metric, geo_level: "country", geoid, geo_name: r.country === "European Union (27)" ? "European Union" : r.country,
          period: r.year, period_start: `${r.year}-01-01`, value: Math.round(v * scale * 1000) / 1000, unit, metadata: null,
        });
      }
    }
  }
  const found = new Set(rows.map((r) => r.geoid));
  const missing = Object.values(COUNTRIES).filter((g) => !found.has(g));
  if (missing.length) throw new Error(`OWID: no rows for ${missing.join(", ")}`);
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- NOAA ----------------------------------------------------------------------

const CAG = "https://www.ncei.noaa.gov/access/monitoring/climate-at-a-glance";
// Statewide codes 1–48 are the contiguous states alphabetically; 50 is Alaska.
// Each response's title names its state, which is what rows are keyed by.
const STATE_CODES = [...Array.from({ length: 48 }, (_, i) => i + 1), 50];

async function series(path, last) {
  const body = await fetchJson(`${CAG}/${path}/tavg/12/12/1895-${last}/data.json`, {}, { label: `NOAA ${path}` });
  const name = body.description?.title?.replace(/ January-December Average Temperature$/, "");
  const points = Object.entries(body.data ?? {}).map(([k, v]) => ({ year: k.slice(0, 4), value: num(v?.value ?? v) })).filter((p) => p.value !== null);
  return { name, points };
}

async function importNoaa(pg) {
  const slug = "noaa-climate";
  await registerDataset(pg, slug);
  const last = new Date().getFullYear() - 1;
  const rows = [];
  const add = (geo, points) => {
    for (const p of points) rows.push({ source: slug, metric: "avg_temperature", ...geo, period: p.year, period_start: `${p.year}-01-01`, value: p.value, unit: "deg_f", metadata: null });
  };
  const nation = await series("national/time-series/110", last);
  add({ geo_level: "nation", geoid: "US", geo_name: "Contiguous United States" }, nation.points);
  for (const code of STATE_CODES) {
    const s = await series(`statewide/time-series/${code}`, last);
    const abbr = STATE_NAME_TO_ABBR[s.name];
    if (!abbr) throw new Error(`NOAA statewide ${code}: unknown state "${s.name}"`);
    add({ geo_level: "state", geoid: STATE_FIPS[abbr], geo_name: s.name }, s.points);
    await sleep(200);
  }
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

await runImport("climate", async (pg) => {
  let inserted = 0;
  if (ONLY.has("owid")) inserted += await importOwid(pg);
  if (ONLY.has("noaa")) inserted += await importNoaa(pg);
  return { inserted };
});
