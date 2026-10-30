// Imports HUD's homelessness point-in-time (PIT) counts into `area_stats`
// (source hud-pit): people counted as homeless on one night each January,
// 2007 onward.
//
//   geo_level 'nation' (US), 'state' (FIPS, territories included), and
//   'coc' (Continuum of Care number, e.g. CA-600 = Los Angeles; core
//   metrics only)
//
//   homeless, sheltered, unsheltered, emergency shelter, transitional
//   housing, individuals, people in families, family households, chronically
//   homeless, veterans, unaccompanied youth, parenting youth — and, from 2013
//   (age) and 2015 (race, ethnicity), the totals by age, race, and ethnicity.
//
// HUD publishes the counts only as .xlsb workbooks (one sheet per year),
// read with scripts/lib/xlsb.mjs. Pass --year= for the release (the file
// name carries the latest count year).
//
// Source: https://www.huduser.gov/portal/datasets/ahar.html
//
// Usage:
//   node scripts/import-hud-pit.mjs [--year=2025]
//   ENV_FILE=.env.cloud node scripts/import-hud-pit.mjs

import { arg, fetchRetry, num, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsb } from "./lib/xlsb.mjs";

const SOURCE = "hud-pit";
const YEAR = arg("year", "2025");
const BASE = "https://www.huduser.gov/portal/sites/default/files/xls";
// huduser.gov's WAF answers short User-Agents with an empty 202.
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
  timeoutMs: 300_000,
};
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

// Column → metric. Columns present in all years.
const CORE = {
  "Overall Homeless": "homeless",
  "Sheltered Total Homeless": "homeless_sheltered",
  "Unsheltered Homeless": "homeless_unsheltered",
  "Sheltered ES Homeless": "homeless_emergency_shelter",
  "Sheltered TH Homeless": "homeless_transitional_housing",
  "Overall Homeless Individuals": "homeless_individuals",
  "Unsheltered Homeless Individuals": "homeless_individuals_unsheltered",
  "Overall Homeless People in Families": "homeless_people_in_families",
  "Unsheltered Homeless People in Families": "homeless_people_in_families_unsheltered",
  "Overall Homeless Family Households": "homeless_family_households",
  "Overall Chronically Homeless Individuals": "chronically_homeless_individuals",
  "Unsheltered Chronically Homeless Individuals": "chronically_homeless_individuals_unsheltered",
  "Overall Chronically Homeless": "chronically_homeless",
  "Overall Homeless Veterans": "homeless_veterans",
  "Unsheltered Homeless Veterans": "homeless_veterans_unsheltered",
  "Overall Homeless Unaccompanied Youth (Under 25)": "homeless_unaccompanied_youth",
  "Unsheltered Homeless Unaccompanied Youth (Under 25)": "homeless_unaccompanied_youth_unsheltered",
  "Overall Homeless Unaccompanied Youth Under 18": "homeless_unaccompanied_minors",
  "Overall Homeless Parenting Youth (Under 25)": "homeless_parenting_youth",
};
// "Overall Homeless - <label>" → metric suffix. HUD renamed the race
// categories in 2022 and split them by ethnicity in 2024; the inclusive
// columns ("White", not "White Only") line up across years.
const GROUPS = {
  "Under 18": "under_18",
  "Age 18 to 24": "age_18_24",
  "Over 24": "over_24",
  "Age 25 to 34": "age_25_34",
  "Age 35 to 44": "age_35_44",
  "Age 45 to 54": "age_45_54",
  "Age 55 to 64": "age_55_64",
  "Over 64": "over_64",
  "Hispanic/Latina/o": "hispanic",
  "Non-Hispanic/Latina/o": "non_hispanic",
  White: "white",
  "Black or African American": "black",
  "Black, African American, or African": "black",
  Asian: "asian",
  "Asian or Asian American": "asian",
  "American Indian or Alaska Native": "native_american",
  "American Indian, Alaska Native, or Indigenous": "native_american",
  "Native Hawaiian or Other Pacific Islander": "pacific_islander",
  "Middle Eastern or North African": "middle_eastern",
  "Multiple Races": "multiracial",
  "Multi-Racial": "multiracial",
};

const metricFor = (header) => {
  const h = String(header ?? "").trim();
  if (CORE[h]) return CORE[h];
  const g = /^Overall Homeless - (.+)$/.exec(h);
  return g && GROUPS[g[1]] ? `homeless_${GROUPS[g[1]]}` : null;
};

async function workbook(kind) {
  const url = `${BASE}/2007-${YEAR}-PIT-Counts-by-${kind}.xlsb`;
  console.log(`  ${url}`);
  const res = await fetchRetry(url, BROWSER);
  const buf = Buffer.from(await res.arrayBuffer());
  if (!buf.length) throw new Error(`${url} came back empty (WAF challenge?)`);
  return readXlsb(buf);
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  const add = (geoLevel, geoid, name, metric, year, value) =>
    out.push({
      source: SOURCE, metric, geo_level: geoLevel, geoid, geo_name: name, period: year,
      period_start: `${year}-01-01`, value, unit: "people", metadata: {},
    });

  const state = await workbook("State");
  for (const [year, rows] of Object.entries(state)) {
    if (!/^\d{4}$/.test(year)) continue;
    const metrics = rows[0].map(metricFor);
    for (const r of rows.slice(1)) {
      const key = String(r[0] ?? "").trim();
      const [level, geoid, name] = key === "Total" ? ["nation", "US", "United States"] : STATE_FIPS[key] ? ["state", STATE_FIPS[key], FIPS_TO_NAME[STATE_FIPS[key]] ?? key] : [];
      if (!level) continue;
      const seen = new Set();
      metrics.forEach((metric, i) => {
        const v = num(r[i]);
        // A renamed category can appear twice in a year; keep the first.
        if (metric && v !== null && !seen.has(metric)) { seen.add(metric); add(level, geoid, name, metric, year, v); }
      });
    }
  }

  const coc = await workbook("CoC");
  const coreMetrics = new Set(Object.values(CORE));
  for (const [year, rows] of Object.entries(coc)) {
    if (!/^\d{4}$/.test(year)) continue;
    const header = rows[0].map((h) => String(h ?? "").trim());
    const iNum = header.indexOf("CoC Number");
    const iName = header.indexOf("CoC Name");
    const metrics = header.map((h) => (coreMetrics.has(CORE[h]) ? CORE[h] : null));
    for (const r of rows.slice(1)) {
      const id = String(r[iNum] ?? "").trim();
      if (!/^[A-Z]{2}-\d{3}$/.test(id)) continue;
      metrics.forEach((metric, i) => {
        const v = num(r[i]);
        if (metric && v !== null) add("coc", id, String(r[iName] ?? id).trim(), metric, year, v);
      });
    }
  }

  const us = out.filter((r) => r.geoid === "US" && r.metric === "homeless");
  if (us.length < 15) throw new Error("HUD PIT: national totals missing — layout changed?");
  const latest = us.map((r) => r.period).sort().at(-1);
  console.log(`  ${out.length} rows, 2007–${latest}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: latest };
});
