// Imports the Census Bureau's CPS Voting and Registration Supplement into
// `area_stats` (source 'cps-voting'): eligible citizens, registered voters
// and voters by age, race and ethnicity, sex, education and family income,
// plus voting method, for the nation and each state.
//
// Reads the November public-use microdata CSV directly (no API key — the
// CPS data API needs one) and weights each respondent with PWSSWGT, which
// carries four implied decimals. Universe and coding follow the Census
// Bureau's published P20 tables: U.S. citizens 18+, and anyone who did not
// answer "did you vote" counts as not voting. 2024 reproduces the published
// national figures (65.3% turnout, 154.3M voters).
//
// One row per (measure × dimension × group, geo, year); the groups and their
// metric names live in src/lib/elections/electorate.ts. metadata carries
// { measure, dimension, group, sample } — sample is the unweighted
// respondent count, so thin state-level cells can be spotted.
//
// Source: https://www2.census.gov/programs-surveys/cps/datasets/{year}/supp/
// Only years published as CSV (2020 onward) are importable here.
//
// Usage:
//   node scripts/import-cps-voting.mjs [--years=2020,2022,2024] [--file=nov24pub.csv]
//   ENV_FILE=.env.cloud node scripts/import-cps-voting.mjs

import { createReadStream } from "node:fs";
import { createInterface } from "node:readline";
import { Readable } from "node:stream";
import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { metricName } from "../src/lib/elections/electorate.ts";

const SOURCE = "cps-voting";
const YEARS = arg("years", "2020,2022,2024").split(",").map((y) => Number(y.trim()));
const FILE = arg("file", "");
const urlFor = (year) =>
  `https://www2.census.gov/programs-surveys/cps/datasets/${year}/supp/nov${String(year).slice(2)}pub.csv`;

const ABBR_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([n, a]) => [a, n]));
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_FIPS).map(([a, f]) => [f, ABBR_TO_NAME[a] ?? a]));

// CPS codes → electorate.ts group keys. null = respondent left out of that
// dimension (never happens for the universe filter's own fields).
function ageGroup(age) {
  if (age < 25) return "18_24";
  if (age < 35) return "25_34";
  if (age < 45) return "35_44";
  if (age < 55) return "45_54";
  if (age < 65) return "55_64";
  if (age < 75) return "65_74";
  return "75_plus";
}

// Hispanic of any race; everyone else by single race (PTDTRACE 1 White,
// 2 Black, 4 Asian), with all other and multiple races together.
function raceGroup(hispanic, race) {
  if (hispanic === 1) return "hispanic";
  if (race === 1) return "white";
  if (race === 2) return "black";
  if (race === 4) return "asian";
  return "other";
}

function sexGroup(sex) {
  return sex === 1 ? "male" : sex === 2 ? "female" : null;
}

// PEEDUCA: 31–38 below a diploma, 39 HS graduate, 40 some college,
// 41–42 associate, 43 bachelor's, 44–46 master's / professional / doctorate.
function educationGroup(code) {
  if (code >= 31 && code <= 38) return "no_diploma";
  if (code === 39) return "high_school";
  if (code >= 40 && code <= 42) return "some_college";
  if (code === 43) return "bachelors";
  if (code >= 44 && code <= 46) return "advanced";
  return null;
}

// HEFAMINC brackets 1–16 (8 = $25,000–29,999, 16 = $150,000+).
function incomeGroup(code) {
  if (code >= 1 && code <= 8) return "under_30k";
  if (code >= 9 && code <= 11) return "30k_50k";
  if (code >= 12 && code <= 13) return "50k_75k";
  if (code === 14) return "75k_100k";
  if (code === 15) return "100k_150k";
  if (code === 16) return "150k_plus";
  return "not_reported";
}

// PES5: 1 in person, 2 by mail. PES6: 1 on Election Day, 2 before.
function methodGroup(where, when) {
  if (where === 2) return "mail";
  if (where === 1 && when === 1) return "election_day";
  if (where === 1 && when === 2) return "early_in_person";
  return "not_reported";
}

async function linesFor(year) {
  if (FILE) return createInterface({ input: createReadStream(FILE), crlfDelay: Infinity });
  const res = await fetchRetry(urlFor(year), {}, { label: `CPS November ${year}` });
  return createInterface({ input: Readable.fromWeb(res.body), crlfDelay: Infinity });
}

async function tally(year) {
  const totals = new Map(); // `${geoid}|${metric}` -> { value, sample, measure, dimension, group }
  const add = (geoid, measure, weight, dimension, group) => {
    const metric = metricName(measure, dimension, group);
    const key = `${geoid}|${metric}`;
    const cell = totals.get(key) ?? { geoid, metric, measure, dimension: dimension ?? null, group: group ?? null, value: 0, sample: 0 };
    cell.value += weight;
    cell.sample += 1;
    totals.set(key, cell);
  };

  let idx = null;
  let respondents = 0;
  for await (const line of await linesFor(year)) {
    const f = line.split(",");
    if (!idx) {
      idx = Object.fromEntries(f.map((h, i) => [h.trim().toUpperCase(), i]));
      for (const col of ["PRTAGE", "PRCITSHP", "PWSSWGT", "PES1", "PES2", "PES5", "PES6", "PTDTRACE", "PEHSPNON", "PESEX", "PEEDUCA", "HEFAMINC", "GESTFIPS"]) {
        if (!(col in idx)) throw new Error(`CPS ${year}: column ${col} missing`);
      }
      continue;
    }
    const get = (col) => Number(f[idx[col]]);
    const age = get("PRTAGE");
    const citizenship = get("PRCITSHP");
    if (!(age >= 18) || !(citizenship >= 1 && citizenship <= 4)) continue;
    const weight = get("PWSSWGT") / 10_000;
    if (!(weight > 0)) continue;
    respondents++;

    const voted = get("PES1") === 1;
    const registered = voted || get("PES2") === 1;
    const state = String(get("GESTFIPS")).padStart(2, "0");
    const groups = [
      ["age", ageGroup(age)],
      ["race", raceGroup(get("PEHSPNON"), get("PTDTRACE"))],
      ["sex", sexGroup(get("PESEX"))],
      ["education", educationGroup(get("PEEDUCA"))],
      ["income", incomeGroup(get("HEFAMINC"))],
    ];
    const measures = ["citizens", ...(registered ? ["registered"] : []), ...(voted ? ["voted"] : [])];

    for (const geoid of ["US", state]) {
      for (const measure of measures) {
        add(geoid, measure, weight);
        for (const [dimension, group] of groups) if (group) add(geoid, measure, weight, dimension, group);
      }
      if (voted) add(geoid, "voted", weight, "method", methodGroup(get("PES5"), get("PES6")));
    }
  }
  return { totals, respondents };
}

runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (const year of YEARS) {
    console.log(`CPS November ${year}: reading ${FILE || urlFor(year)}`);
    const { totals, respondents } = await tally(year);
    const rows = [...totals.values()]
      .filter((c) => c.geoid === "US" || FIPS_TO_NAME[c.geoid])
      .map((c) => ({
        source: SOURCE,
        metric: c.metric,
        geo_level: c.geoid === "US" ? "nation" : "state",
        geoid: c.geoid,
        geo_name: c.geoid === "US" ? "United States" : FIPS_TO_NAME[c.geoid],
        period: String(year),
        period_start: `${year}-11-01`,
        value: Math.round(c.value),
        unit: "people",
        metadata: { measure: c.measure, dimension: c.dimension, group: c.group, sample: c.sample },
      }));
    inserted += await upsertRows(
      pg,
      "area_stats",
      ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"],
      rows,
      ["source", "metric", "geo_level", "geoid", "period"],
    );
    const us = (m) => totals.get(`US|${m}`)?.value ?? 0;
    console.log(
      `  ${respondents.toLocaleString()} citizen respondents · ${rows.length} rows · ` +
        `voted ${(us("voted_total") / 1e6).toFixed(1)}M of ${(us("citizens_total") / 1e6).toFixed(1)}M ` +
        `(${((us("voted_total") / us("citizens_total")) * 100).toFixed(1)}%)`,
    );
  }
  return { inserted };
});
