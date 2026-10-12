// Imports the FBI Crime Data Explorer's annual tables that the monthly
// summarized endpoint lacks, one call per place per year (the API sums
// over the requested range):
//   fbi-hate-crime  hate crime incidents, total and by bias category
//   fbi-arrests     arrests: total, under 18, drug, weapons, DUI, violent
// geo_level 'nation' | 'state' (FIPS geoid), period = year. Years after the
// API's max_data_date are skipped; the latest year is refreshed each run.
//
// Usage:
//   node scripts/import-fbi-annual.mjs [--only=hate|arrests] [--from=2015] [--states=TX,FL]
//   ENV_FILE=.env.cloud node scripts/import-fbi-annual.mjs

import { STATE_FIPS, arg, fetchJson, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const FROM = Number(arg("from", "2015"));
const ONLY = arg("only", "");
const ONLY_STATES = arg("states", "").toUpperCase().split(",").filter(Boolean);
const CDE = "https://api.usa.gov/crime/fbi/cde";
const STATES = Object.keys(STATE_FIPS).filter(
  (s) => !["AS", "GU", "MP", "VI", "PR"].includes(s) && (!ONLY_STATES.length || ONLY_STATES.includes(s)),
);

const BIAS = {
  "Race/Ethnicity/Ancestry": "race", Religion: "religion", "Sexual Orientation": "sexual_orientation",
  "Gender Identity": "gender_identity", Disability: "disability", Gender: "gender", "Multiple Bias": "multiple",
};
const JUVENILE_AGES = ["Under 10", "Under 11", "10-12", "11-12", "13-14", "15", "16", "17", "Juvenile Other"];
const sum = (obj, keys) => keys.reduce((t, k) => t + (num(obj?.[k]) ?? 0), 0);

function hateRows(d) {
  const cats = d.incident_section?.bias_category ?? {};
  const out = { hate_incidents: Object.values(cats).reduce((t, v) => t + (num(v) ?? 0), 0) };
  for (const [label, key] of Object.entries(BIAS)) out[`hate_incidents_${key}`] = num(cats[label]) ?? 0;
  return [out, "incidents"];
}

function arrestRows(d) {
  const off = d["Offense Name"] ?? {};
  const total = sum(d["Arrestee Sex"], ["Male", "Female"]);
  const juvenile = sum(d["Male Arrests By Age"], JUVENILE_AGES) + sum(d["Female Arrests By Age"], JUVENILE_AGES);
  return [
    {
      arrests_total: total,
      arrests_juvenile: juvenile,
      arrests_drug: sum(off, ["Drug Possession", "Drug Sale/Manufacturing", "Drug Abuse Violations"]),
      arrests_weapons: sum(off, ["Weapons"]),
      arrests_dui: sum(off, ["Drive Under the Influence"]),
      arrests_violent: sum(d["Offense Category"], ["Homicide Offenses", "Robbery"]) + sum(off, ["Rape", "Rape (Legacy)", "Aggravated Assault"]),
    },
    "arrests",
  ];
}

const KINDS = {
  hate: { source: "fbi-hate-crime", path: "hate-crime", rows: hateRows },
  arrests: { source: "fbi-arrests", path: "arrest", query: "&type=totals", rows: arrestRows, sub: "/all" },
};

for (const [name, kind] of Object.entries(KINDS)) {
  if (ONLY && ONLY !== name) continue;
  await runImport(kind.source, async (pg) => {
    await registerDataset(pg, kind.source);
    const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || process.env.CONGRESS_GOV_API_KEY || "DEMO_KEY";
    const delay = key === "DEMO_KEY" ? 120_000 : 150;
    const thisYear = new Date().getFullYear();
    let total = 0;
    let maxYear = thisYear;
    for (const st of [null, ...STATES]) {
      const rows = [];
      for (let y = FROM; y <= Math.min(thisYear, maxYear); y++) {
        const path = st ? `${kind.path}/state/${st}${kind.sub ?? ""}` : `${kind.path}/national${kind.sub ?? ""}`;
        const d = await fetchJson(`${CDE}/${path}?from=01-${y}&to=12-${y}${kind.query ?? ""}&API_KEY=${key}`, {}, { label: `fbi ${path} ${y}` });
        await sleep(delay);
        const max = Number(String(d.cde_properties?.max_data_date?.UCR ?? "").split("/")[1]);
        if (max) maxYear = max; // a year with no data yet stops the loop
        const [values, unit] = kind.rows(d);
        if (!Object.values(values).some((v) => v > 0)) continue;
        for (const [metric, value] of Object.entries(values)) {
          rows.push({
            source: kind.source, metric, geo_level: st ? "state" : "nation", geoid: st ? STATE_FIPS[st] : "US",
            geo_name: st ?? "United States", period: String(y), period_start: `${y}-01-01`, value, unit,
            // The latest year is partial until the FBI's annual release.
            metadata: max && y === max ? { partial: true } : null,
          });
        }
      }
      if (rows.length) total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, ["source", "metric", "geo_level", "geoid", "period"]);
      console.log(`  ${kind.source} ${st ?? "US"} done`);
    }
    return { inserted: total };
  });
}
