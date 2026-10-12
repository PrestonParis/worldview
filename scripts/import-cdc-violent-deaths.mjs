// Imports homicide and firearm death counts and rates from CDC's Mapping
// Injury, Overdose, and Violence data (NVSS death certificates) into
// `area_stats`: source = 'cdc-violent-deaths', geo_level 'nation' | 'state'
// | 'county' (FIPS geoid). Annual periods are years; trailing-twelve-month
// figures go to *_ttm metrics with the last month covered as the period.
// Counties get the two homicide measures only; suppressed county counts
// (1–9) are left out and their rates flagged metadata.unreliable.
//
// Usage:
//   node scripts/import-cdc-violent-deaths.mjs
//   ENV_FILE=.env.cloud node scripts/import-cdc-violent-deaths.mjs

import { fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const FILES = { nation: "t6u2-f84c", state: "fpsi-y8tj", county: "psx4-wq38" };
const INTENTS = { All_Homicide: "homicide", FA_Homicide: "firearm_homicide", FA_Deaths: "firearm_deaths", FA_Suicide: "firearm_suicide" };
const COUNTY_INTENTS = ["All_Homicide", "FA_Homicide"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

async function all(file, where) {
  const out = [];
  for (let offset = 0; ; offset += 50_000) {
    const page = await fetchJson(
      `https://data.cdc.gov/resource/${FILES[file]}.json?$where=${encodeURIComponent(where)}&$order=:id&$limit=50000&$offset=${offset}`,
      { timeoutMs: 300_000 },
      { label: `cdc ${file}` },
    );
    out.push(...page);
    if (page.length < 50_000) return out;
  }
}

// "May, 2025 to April, 2026" -> "2026-04"
const ttmEnd = (range) => {
  const m = /to (\w+), (\d{4})/.exec(range ?? "");
  const i = m ? MONTHS.indexOf(m[1]) : -1;
  return i >= 0 ? `${m[2]}-${String(i + 1).padStart(2, "0")}` : null;
};

await runImport("cdc-violent-deaths", async (pg) => {
  await registerDataset(pg, "cdc-violent-deaths");
  const intents = (list) => list.map((i) => `'${i}'`).join(",");
  const [nation, state, county] = await Promise.all([
    all("nation", `intent in (${intents(Object.keys(INTENTS))}) and type in ('year','TTM')`),
    all("state", `intent in (${intents(Object.keys(INTENTS))})`),
    all("county", `intent in (${intents(COUNTY_INTENTS)})`),
  ]);

  const rows = [];
  const add = (level, geoid, name, r) => {
    const key = INTENTS[r.intent];
    const ttm = r.period === "TTM" || r.type === "TTM";
    const period = ttm ? ttmEnd(r.ttm_date_range) : String(r.period).slice(0, 4);
    if (!key || !period) return;
    const base = {
      source: "cdc-violent-deaths", geo_level: level, geoid, geo_name: name, period,
      period_start: ttm ? `${period}-01` : `${period}-01-01`,
    };
    const meta = {
      ...(ttm ? { ttm_range: r.ttm_date_range } : {}),
      ...(r.rate_m === "1" || r.rate_m === "1.000000000000000" ? { unreliable: true } : {}),
    };
    const rate = num(r.rate);
    if (rate !== null) rows.push({ ...base, metric: `${key}_rate${ttm ? "_ttm" : ""}`, value: rate, unit: "per_100k", metadata: Object.keys(meta).length ? meta : null });
    const count = num(r.count_sup ?? r.count);
    if (count !== null && !ttm) rows.push({ ...base, metric: key === "firearm_deaths" ? "firearm_deaths" : `${key}_deaths`, value: count, unit: "deaths", metadata: null });
  };
  for (const r of nation) add("nation", "US", "United States", r);
  for (const r of state) add("state", r.geoid.padStart(2, "0"), r.name, r);
  for (const r of county) add("county", r.geoid.padStart(5, "0"), `${r.name}, ${r.st_name}`, r);

  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  nation ${nation.length}, state ${state.length}, county ${county.length} source rows`);
  return { inserted };
});
