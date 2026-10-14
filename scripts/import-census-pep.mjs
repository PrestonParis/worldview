// Imports Census Bureau Population Estimates (PEP) into `area_stats`: July 1
// population and the components of change — net international migration,
// net domestic migration, natural change, births and deaths — for the nation,
// every state, and every county (period = year, e.g. '2025'; births and
// deaths are the 12 months to July 1).
//
// Two vintages are stitched together: Vintage 2020 for 2011–2020 and the
// latest vintage (2020–2025 file) for 2021 on; metadata.vintage records
// which. The latest vintage's 2020 column covers only April–June 2020, so
// its components start at 2021. Rates are per 1,000 residents.
//
// Source: https://www2.census.gov/programs-surveys/popest/datasets/ — free,
// no key.
//
// Usage:
//   node scripts/import-census-pep.mjs [--vintage=2025] [--levels=state,county]
//   ENV_FILE=.env.cloud node scripts/import-census-pep.mjs

import { arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const VINTAGE = Number(arg("vintage", "2025"));
const LEVELS = arg("levels", "state,county").split(",");
const ROOT = "https://www2.census.gov/programs-surveys/popest/datasets";

const FILES = [
  // [vintage, years, level, url]
  [2020, [2011, 2020], "state", `${ROOT}/2010-2020/state/totals/nst-est2020-alldata.csv`],
  [2020, [2011, 2020], "county", `${ROOT}/2010-2020/counties/totals/co-est2020-alldata.csv`],
  [VINTAGE, [2021, VINTAGE], "state", `${ROOT}/2020-${VINTAGE}/state/totals/NST-EST${VINTAGE}-ALLDATA.csv`],
  [VINTAGE, [2021, VINTAGE], "county", `${ROOT}/2020-${VINTAGE}/counties/totals/co-est${VINTAGE}-alldata.csv`],
];

const SERIES = {
  population: ["POPESTIMATE", "people"],
  population_change: ["NPOPCHG_", "people"],
  international_migration: ["INTERNATIONALMIG", "people"],
  domestic_migration: ["DOMESTICMIG", "people"],
  natural_change: ["NATURALCHG", "people"],
  births: ["BIRTHS", "births"],
  deaths: ["DEATHS", "deaths"],
  birth_rate: ["RBIRTH", "per_1000"],
  death_rate: ["RDEATH", "per_1000"],
  international_migration_rate: ["RINTERNATIONALMIG", "per_1000"],
  domestic_migration_rate: ["RDOMESTICMIG", "per_1000"],
};

await runImport("census-pep", async (pg) => {
  await registerDataset(pg, "census-pep");
  const out = [];
  for (const [vintage, [from, to], level, url] of FILES) {
    if (!LEVELS.includes(level)) continue;
    // County files are Latin-1 (Doña Ana County, ...).
    const buf = Buffer.from(await (await fetchRetry(url, {}, { label: url })).arrayBuffer());
    const rows = parseCsv(new TextDecoder("latin1").decode(buf));
    let areas = 0;
    for (const r of rows) {
      let geoLevel, geoid, name;
      if (r.SUMLEV === "010") [geoLevel, geoid, name] = ["nation", "US", "United States"];
      else if (r.SUMLEV === "040") [geoLevel, geoid, name] = ["state", r.STATE, r.NAME ?? r.STNAME];
      else if (r.SUMLEV === "050") [geoLevel, geoid, name] = ["county", r.STATE + r.COUNTY, `${r.CTYNAME}, ${r.STNAME}`];
      else continue;
      // The county file repeats each state as SUMLEV 040; take states and
      // the nation from the state file only.
      if (level === "county" && geoLevel !== "county") continue;
      areas++;
      for (let y = from; y <= to; y++) {
        for (const [metric, [prefix, unit]] of Object.entries(SERIES)) {
          const raw = r[`${prefix}${y}`];
          if (raw === undefined || raw === "") continue;
          const value = Number(raw);
          if (!Number.isFinite(value)) continue;
          out.push({
            source: "census-pep", metric, geo_level: geoLevel, geoid, geo_name: name,
            period: String(y), period_start: `${y}-07-01`, value, unit, metadata: { vintage },
          });
        }
      }
    }
    console.log(`  V${vintage} ${level}: ${areas} areas`);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"], {
    batchSize: 1000,
  });
  return { inserted, cursor: `V${VINTAGE}` };
});
