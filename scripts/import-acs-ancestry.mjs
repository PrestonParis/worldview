// Imports ancestry and Hispanic origin detail from the ACS 1-year into
// `area_stats` (source census-acs1-ancestry) for the nation and every
// state, 2010 onward (no 2020 release):
//
//   ancestry_<slug>          people reporting each ancestry (B04006), as a
//                            share of the total population
//   hispanic_origin_<slug>   Hispanic or Latino origin groups (B03001), as a
//                            share of the total population
//   ancestry_<slug>_count, hispanic_origin_<slug>_count   the counts
//
// Variable numbers moved between years, so cells are matched by label
// against the lists in scripts/lib/catalog.mjs (ANCESTRIES,
// HISPANIC_ORIGINS); an unknown label fails the run.
//
// Usage:
//   node scripts/import-acs-ancestry.mjs [--years=2010-2024]
//   ENV_FILE=.env.cloud node scripts/import-acs-ancestry.mjs

import { arg, checkCensusKey, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { ANCESTRIES, HISPANIC_ORIGINS, ancestrySlug, registerDataset } from "./lib/catalog.mjs";

const SOURCE = "census-acs1-ancestry";
const [FROM, TO] = arg("years", "2010-2024").split("-").map(Number);
const YEARS = Array.from({ length: (TO ?? FROM) - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const TABLES = { B04006: ["ancestry", ANCESTRIES], B03001: ["hispanic_origin", HISPANIC_ORIGINS] };

// variable -> metric prefix + slug, from the year's group labels.
async function variables(year, table) {
  const [prefix, names] = TABLES[table];
  const known = new Set(names.map(ancestrySlug));
  const { variables: vars } = await fetchJson(`https://api.census.gov/data/${year}/acs/acs1/groups/${table}.json`, {}, { label: `${table} ${year}` });
  const out = {};
  for (const [name, v] of Object.entries(vars)) {
    if (!/_\d{3}E$/.test(name)) continue;
    const parts = v.label.replace(/:/g, "").split("!!").slice(2); // drop "Estimate", "Total"
    if (!parts.length) continue; // the table total
    if (table === "B03001") {
      if (parts[0] !== "Hispanic or Latino" || parts.length < 2) continue;
      parts.shift();
    }
    const slug = ancestrySlug(parts.at(-1));
    if (!known.has(slug)) throw new Error(`${year} ${name}: unknown ${table} label "${v.label}" — add it to catalog.mjs`);
    out[name] = `${prefix}_${slug}`;
  }
  return out;
}

await runImport(SOURCE, async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (const year of YEARS) {
    const metricOf = {};
    for (const t of Object.keys(TABLES)) Object.assign(metricOf, await variables(year, t));
    const vars = ["B01003_001E", ...Object.keys(metricOf)];
    const out = [];
    for (const geo of ["us:1", "state:*"]) {
      const merged = new Map();
      // The API takes at most 50 variables per call.
      for (let i = 0; i < vars.length; i += 48) {
        const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,${vars.slice(i, i + 48).join(",")}&for=${geo}&key=${key}`;
        const [header, ...data] = await fetchJson(url, {}, { label: `ACS1 ${year} ${geo}` });
        for (const d of data) {
          const r = Object.fromEntries(header.map((h, j) => [h, d[j]]));
          const id = r.state ?? "US";
          merged.set(id, { ...merged.get(id), ...r });
        }
      }
      for (const r of merged.values()) {
        const geoid = r.state ?? "US";
        if (geoid === "72") continue;
        const base = {
          source: SOURCE, geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: r.NAME,
          period: String(year), period_start: `${year}-01-01`, metadata: null,
        };
        const pop = num(r.B01003_001E);
        for (const [v, metric] of Object.entries(metricOf)) {
          const n = num(r[v]);
          if (n === null || n < 0) continue;
          out.push({ ...base, metric: `${metric}_count`, value: n, unit: "people" });
          if (pop) out.push({ ...base, metric, value: Math.round((n / pop) * 10000) / 100, unit: "percent" });
        }
      }
    }
    inserted += await upsertRows(pg, "area_stats", ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"], out, [
      "source", "metric", "geo_level", "geoid", "period",
    ]);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted };
});
