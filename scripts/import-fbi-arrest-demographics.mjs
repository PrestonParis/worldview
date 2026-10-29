// Imports FBI Crime Data Explorer arrests by race, sex, and age into
// `area_stats` (source fbi-arrest-demographics), one row per offense ×
// group, nation and states, per year:
//
//   arrests_<offense>_total
//   arrests_<offense>_<white|black|aian|asian|nhpi|race_unknown>
//   arrests_<offense>_<male|female>
//   arrests_<offense>_<under_18|age_18_24|age_25_34|age_35_44|age_45_54|age_55_64|age_65_plus>
//
// Offenses are the UCR arrest categories (CDE offense ids); "violent" sums
// murder, rape, robbery and aggravated assault; drug_sale and
// drug_possession sum their drug-type ids. States get the offenses in
// STATE_OFFENSES only.
//
// The CDE does not publish arrestee ethnicity with these tables, and
// Hispanic arrestees are counted within their race (mostly White). Counts
// are from agencies that reported; coverage is in the CDE's monthly counts.
//
// Usage:
//   node scripts/import-fbi-arrest-demographics.mjs [--from=2015] [--states=TX,FL] [--nation-only]
//   ENV_FILE=.env.cloud node scripts/import-fbi-arrest-demographics.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchJson, flag, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "fbi-arrest-demographics";
const FROM = Number(arg("from", "2015"));
const ONLY_STATES = arg("states", "").toUpperCase().split(",").filter(Boolean);
const CDE = "https://api.usa.gov/crime/fbi/cde";
const STATES = flag("nation-only")
  ? []
  : Object.keys(STATE_FIPS).filter((s) => !["AS", "GU", "MP", "VI", "PR"].includes(s) && (!ONLY_STATES.length || ONLY_STATES.includes(s)));
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));

// offense -> CDE arrest offense ids ("all" is its own path). Labels are in
// ARREST_OFFENSES in scripts/lib/catalog.mjs.
const OFFENSES = {
  all: ["all"],
  murder: [11],
  rape: [20],
  robbery: [30],
  aggravated_assault: [50],
  simple_assault: [55],
  burglary: [60],
  larceny: [70],
  motor_vehicle_theft: [90],
  arson: [110],
  human_trafficking: [101, 102],
  weapons: [230],
  drug_sale: [151, 152, 153, 154, 155],
  drug_possession: [156, 157, 158, 159, 160],
  dui: [260],
  fraud: [190],
  sex_offenses: [240],
};
const STATE_OFFENSES = ["all", "murder", "robbery", "aggravated_assault", "weapons"];
const VIOLENT = ["murder", "rape", "robbery", "aggravated_assault"];

const RACES = {
  White: "white", "Black or African American": "black", "American Indian or Alaska Native": "aian", Asian: "asian",
  "Native Hawaiian or Other Pacific Islander": "nhpi", "Asian, Native Hawaiian, or Other Pacific Islander": "asian",
  Unknown: "race_unknown", "Not Specified": "race_unknown", Multiple: "race_unknown",
};
const AGE_BANDS = {
  under_18: ["Under 10", "Under 11", "10-12", "11-12", "13-14", "15", "16", "17", "Juvenile Other"],
  age_18_24: ["18", "19", "20", "21", "22", "23", "24"],
  age_25_34: ["25-29", "30-34"],
  age_35_44: ["35-39", "40-44"],
  age_45_54: ["45-49", "50-54"],
  age_55_64: ["55-59", "60-64"],
  age_65_plus: ["65 and over"],
};

// One CDE response -> { group: count }.
function groups(d) {
  const out = {};
  const add = (k, v) => (out[k] = (out[k] ?? 0) + (num(v) ?? 0));
  for (const [label, v] of Object.entries(d["Arrestee Race"] ?? {})) if (RACES[label]) add(RACES[label], v);
  add("male", d["Arrestee Sex"]?.Male);
  add("female", d["Arrestee Sex"]?.Female);
  for (const [band, ages] of Object.entries(AGE_BANDS)) {
    for (const a of ages) {
      add(band, d["Male Arrests By Age"]?.[a]);
      add(band, d["Female Arrests By Age"]?.[a]);
    }
  }
  out.total = out.male + out.female;
  return out;
}

const merge = (list) => {
  const out = {};
  for (const g of list) for (const [k, v] of Object.entries(g)) out[k] = (out[k] ?? 0) + v;
  return out;
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || process.env.CONGRESS_GOV_API_KEY || "DEMO_KEY";
  const delay = key === "DEMO_KEY" ? 120_000 : 150;
  const thisYear = new Date().getFullYear();
  let maxYear = thisYear;
  let total = 0;
  for (const st of [null, ...STATES]) {
    const offenses = st ? STATE_OFFENSES : Object.keys(OFFENSES);
    const rows = [];
    for (let y = FROM; y <= Math.min(thisYear, maxYear); y++) {
      const byOffense = {};
      let partial = false;
      for (const offense of offenses) {
        const parts = [];
        for (const id of OFFENSES[offense]) {
          const path = `arrest/${st ? `state/${st}` : "national"}/${id}`;
          const d = await fetchJson(`${CDE}/${path}?from=01-${y}&to=12-${y}&type=totals&API_KEY=${key}`, {}, { label: `fbi ${path} ${y}` });
          await sleep(delay);
          const max = Number(String(d.cde_properties?.max_data_date?.UCR ?? "").split("/")[1]);
          if (max) {
            maxYear = max;
            partial = y === max;
          }
          parts.push(groups(d));
        }
        byOffense[offense] = merge(parts);
      }
      if (!st) byOffense.violent = merge(VIOLENT.map((o) => byOffense[o]));
      if (!byOffense.all?.total) continue; // no data for the year yet
      for (const [offense, g] of Object.entries(byOffense)) {
        for (const [group, value] of Object.entries(g)) {
          rows.push({
            source: SOURCE, metric: `arrests_${offense}_${group}`, geo_level: st ? "state" : "nation",
            geoid: st ? STATE_FIPS[st] : "US", geo_name: st ? (STATE_NAMES[st] ?? st) : "United States",
            period: String(y), period_start: `${y}-01-01`, value, unit: "arrests",
            // The latest year is partial until the FBI's annual release.
            metadata: partial ? { partial: true } : null,
          });
        }
      }
    }
    if (rows.length) total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  ${st ?? "US"}: ${rows.length} rows`);
  }
  return { inserted: total, cursor: String(maxYear) };
});
