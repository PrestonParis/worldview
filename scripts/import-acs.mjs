// Imports Census ACS 5-year demographics into `area_stats` for the nation,
// every state, county, congressional district, and state legislative
// district (upper + lower) — the geographies My Government and the
// election maps key on (GEOID = state FIPS + local code).
//
// Each metric is one row per geography: raw counts (population, median
// income, ...) or a derived share in percent. source = 'census-acs5',
// period = the ACS end year.
//
// Needs CENSUS_API_KEY (free, https://api.census.gov/data/key_signup.html —
// not an api.data.gov key).
//
// Usage:
//   node scripts/import-acs.mjs [--year=2024] [--levels=state,county,cd,sldu,sldl,us]
//   ENV_FILE=.env.cloud node scripts/import-acs.mjs

import { arg, checkCensusKey, num, runImport, STATE_FIPS, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const YEAR = Number(arg("year", "2024"));
const LEVELS = arg("levels", "us,state,county,cd,sldu,sldl").split(",");

const GEOS = {
  us: { for: "us:1", geoid: () => "US" },
  state: { for: "state:*", geoid: (r) => r.state },
  county: { for: "county:*", geoid: (r) => r.state + r.county },
  cd: { for: "congressional district:*", in: "state:*", geoid: (r) => r.state + r["congressional district"] },
  sldu: {
    for: "state legislative district (upper chamber):*",
    perState: true,
    geoid: (r) => r.state + r["state legislative district (upper chamber)"],
  },
  sldl: {
    for: "state legislative district (lower chamber):*",
    perState: true,
    geoid: (r) => r.state + r["state legislative district (lower chamber)"],
  },
};

// The API rejects a state wildcard for legislative districts, so those are
// fetched one state at a time (states without the chamber, like Nebraska's
// lower house, return no rows).
const STATES = Object.values(STATE_FIPS).filter((f) => Number(f) <= 56 || f === "72");

// metric -> { vars, value(row) , unit }
const sum = (r, vars) => vars.reduce((t, v) => t + (num(r[v]) ?? 0), 0);
const pct = (part, total) => (total > 0 ? Math.round((part / total) * 10000) / 100 : null);
const METRICS = {
  population: { vars: ["B01003_001E"], value: (r) => num(r.B01003_001E), unit: "people" },
  median_age: { vars: ["B01002_001E"], value: (r) => num(r.B01002_001E), unit: "years" },
  median_household_income: { vars: ["B19013_001E"], value: (r) => num(r.B19013_001E), unit: "usd" },
  per_capita_income: { vars: ["B19301_001E"], value: (r) => num(r.B19301_001E), unit: "usd" },
  median_home_value: { vars: ["B25077_001E"], value: (r) => num(r.B25077_001E), unit: "usd" },
  median_gross_rent: { vars: ["B25064_001E"], value: (r) => num(r.B25064_001E), unit: "usd" },
  poverty_rate: {
    vars: ["B17001_001E", "B17001_002E"],
    value: (r) => pct(num(r.B17001_002E), num(r.B17001_001E)),
    unit: "percent",
  },
  unemployment_rate: {
    vars: ["B23025_003E", "B23025_005E"],
    value: (r) => pct(num(r.B23025_005E), num(r.B23025_003E)),
    unit: "percent",
  },
  bachelors_or_higher: {
    vars: ["B15003_001E", "B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"],
    value: (r) => pct(sum(r, ["B15003_022E", "B15003_023E", "B15003_024E", "B15003_025E"]), num(r.B15003_001E)),
    unit: "percent",
  },
  white_non_hispanic: { vars: ["B03002_001E", "B03002_003E"], value: (r) => pct(num(r.B03002_003E), num(r.B03002_001E)), unit: "percent" },
  black_non_hispanic: { vars: ["B03002_004E"], value: (r) => pct(num(r.B03002_004E), num(r.B03002_001E)), unit: "percent" },
  asian_non_hispanic: { vars: ["B03002_006E"], value: (r) => pct(num(r.B03002_006E), num(r.B03002_001E)), unit: "percent" },
  hispanic: { vars: ["B03002_012E"], value: (r) => pct(num(r.B03002_012E), num(r.B03002_001E)), unit: "percent" },
  foreign_born: { vars: ["B05002_001E", "B05002_013E"], value: (r) => pct(num(r.B05002_013E), num(r.B05002_001E)), unit: "percent" },
  noncitizen: { vars: ["B05001_001E", "B05001_006E"], value: (r) => pct(num(r.B05001_006E), num(r.B05001_001E)), unit: "percent" },
  veterans: { vars: ["B21001_001E", "B21001_002E"], value: (r) => pct(num(r.B21001_002E), num(r.B21001_001E)), unit: "percent" },
  owner_occupied: { vars: ["B25003_001E", "B25003_002E"], value: (r) => pct(num(r.B25003_002E), num(r.B25003_001E)), unit: "percent" },
  married_couple_households: { vars: ["B11001_001E", "B11001_003E"], value: (r) => pct(num(r.B11001_003E), num(r.B11001_001E)), unit: "percent" },
};
// B15003 starts with the 2012 release; earlier years have only the
// by-sex table B15002 (men's bachelor's-or-more cells 015–018, women's 032–035).
if (YEAR < 2012) {
  const ba = ["B15002_015E", "B15002_016E", "B15002_017E", "B15002_018E", "B15002_032E", "B15002_033E", "B15002_034E", "B15002_035E"];
  METRICS.bachelors_or_higher = { vars: ["B15002_001E", ...ba], value: (r) => pct(sum(r, ba), num(r.B15002_001E)), unit: "percent" };
}

// Drops metrics whose variables the year's release doesn't have (tables
// added after 2009), so early years load what exists.
async function availableMetrics(key) {
  const res = await fetch(`https://api.census.gov/data/${YEAR}/acs/acs5/variables.json?key=${key}`);
  if (!res.ok) throw new Error(`ACS ${YEAR} variables -> ${res.status}`);
  const known = new Set(Object.keys((await res.json()).variables));
  for (const [metric, m] of Object.entries(METRICS)) {
    const missing = m.vars.filter((v) => !known.has(v));
    if (missing.length) {
      console.log(`  ${YEAR}: skipping ${metric} (no ${missing.join(", ")})`);
      delete METRICS[metric];
    }
  }
}

await runImport("census-acs5", async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  await registerDataset(pg, "census-acs5");
  await availableMetrics(key);
  const vars =[...new Set(Object.values(METRICS).flatMap((m) => m.vars))];
  let total = 0;
  for (const level of LEVELS) {
    const geo = GEOS[level];
    const rows = [];
    for (const state of geo.perState ? STATES : [null]) {
      const url = new URL(`https://api.census.gov/data/${YEAR}/acs/acs5`);
      url.searchParams.set("get", ["NAME", ...vars].join(","));
      url.searchParams.set("for", geo.for);
      if (state) url.searchParams.set("in", `state:${state}`);
      else if (geo.in) url.searchParams.set("in", geo.in);
      url.searchParams.set("key", key);
      const res = await fetch(url);
      // 204 = the state has no such chamber.
      if (state && res.status === 204) continue;
      if (!res.ok) throw new Error(`ACS ${level}${state ? ` ${state}` : ""} -> ${res.status} ${(await res.text()).slice(0, 200)}`);
      const [header, ...data] = await res.json();
      rows.push(...data.map((d) => Object.fromEntries(header.map((h, i) => [h, d[i]]))));
    }
    const out = [];
    for (const r of rows) {
      for (const [metric, m] of Object.entries(METRICS)) {
        let value = m.value(r);
        // ACS uses large negative sentinels (-666666666) for "not available".
        if (value !== null && value < -1e6) value = null;
        out.push({
          source: "census-acs5",
          metric,
          geo_level: level,
          geoid: geo.geoid(r),
          geo_name: r.NAME,
          period: String(YEAR),
          period_start: `${YEAR - 4}-01-01`,
          value,
          unit: m.unit,
          metadata: null,
        });
      }
    }
    total += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, [
      "source", "metric", "geo_level", "geoid", "period",
    ]);
    console.log(`  ${level}: ${rows.length} areas`);
  }
  return { inserted: total };
});
