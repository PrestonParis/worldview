// Imports deaths caused by police into `area_stats`:
//
//   mpv                     Mapping Police Violence: every person killed by
//                           police since 2013, counted by year for the nation
//                           and each state — total, by race and sex, armed
//                           status, cause of death, encounter type, fleeing,
//                           mental illness, body camera, off-duty, and whether
//                           an officer was charged. The current year is partial
//                           (metadata.through = latest incident date).
//   cdc-legal-intervention  NCHS death certificates coded "legal intervention"
//                           (deaths caused by police and other law enforcement,
//                           including the small number of war deaths in the
//                           same ICD category), nation 1999–2016, total and by
//                           mechanism, race, and sex (data.cdc.gov nt65-c7a7)
//
// Source: https://mappingpoliceviolence.us/ (MPVDatasetDownload.xlsx).
//
// Usage:
//   node scripts/import-police-violence.mjs [--only=mpv,cdc] [--file=MPVDatasetDownload.xlsx]
//   ENV_FILE=.env.cloud node scripts/import-police-violence.mjs

import { readFileSync } from "node:fs";
import { arg, fetchJson, fetchRetry, num, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ONLY = new Set(arg("only", "mpv,cdc").split(","));
const MPV_URL = "https://mappingpoliceviolence.us/s/MPVDatasetDownload.xlsx";
// Squarespace serves a 403 to short User-Agents.
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
  timeoutMs: 300_000,
};
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const CONFLICT = ["source", "metric", "geo_level", "geoid", "period"];
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

const RACES = { white: "white", black: "black", hispanic: "hispanic", asian: "asian", "native american": "native_american", "pacific islander": "pacific_islander" };
const CAUSES = [["gunshot", /gunshot/], ["taser", /taser/], ["restraint", /restraint|asphyx|beaten/], ["vehicle", /vehicle/]];
const ENCOUNTERS = [
  ["violent_crime", /violent crime|crimes against people/],
  ["traffic_stop", /traffic stop/],
  ["mental_health_check", /mental health|welfare/],
  ["domestic_disturbance", /domestic/],
  ["person_with_weapon", /person with a weapon/],
  ["nonviolent_offense", /non-violent/],
];

// Excel serial date or "m/d/yyyy" → Date
const toDate = (v) => {
  if (typeof v === "number") return new Date(Date.UTC(1899, 11, 30) + v * 864e5);
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})/.exec(String(v ?? ""));
  return m ? new Date(Date.UTC(+m[3], +m[1] - 1, +m[2])) : null;
};

async function importMpv(pg) {
  await registerDataset(pg, "mpv");
  const file = arg("file", null);
  const buf = file ? readFileSync(file) : Buffer.from(await (await fetchRetry(MPV_URL, BROWSER)).arrayBuffer());
  const sheet = Object.entries(readXlsx(buf)).find(([name]) => /police killings/i.test(name))?.[1];
  if (!sheet) throw new Error("MPV workbook has no 'Police Killings' sheet — layout changed?");
  const h = sheet[0].map((c) => String(c ?? ""));
  const col = (re) => {
    const i = h.findIndex((c) => re.test(c));
    if (i < 0) throw new Error(`MPV sheet has no column matching ${re}`);
    return i;
  };
  const C = {
    date: col(/^Date of Incident/), state: col(/^State$/), race: col(/^Victim's race/), sex: col(/^Victim's gender/),
    cause: col(/^Cause of death/), armed: col(/^Armed\/Unarmed/), charges: col(/^Criminal Charges/),
    mental: col(/^Symptoms of mental illness/), flee: col(/^Fleeing/), offDuty: col(/^Off-Duty/),
    encounter: col(/^Encounter Type/), bodycam: col(/^Body Camera/), age: col(/^Victim's age/),
  };

  const counts = new Map(); // `${geoid}|${year}|${metric}` -> n
  let through = null;
  const bump = (geoid, year, metric) => {
    const k = `${geoid}|${year}|${metric}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const r of sheet.slice(1)) {
    const date = toDate(r[C.date]);
    if (!date) continue;
    if (!through || date > through) through = date;
    const year = date.getUTCFullYear();
    const low = (i) => String(r[i] ?? "").trim().toLowerCase();
    const metrics = ["police_killings"];
    const race = RACES[low(C.race)];
    metrics.push(race ? `police_killings_${race}` : "police_killings_race_unknown");
    const sex = low(C.sex);
    if (sex === "male") metrics.push("police_killings_male");
    else if (sex === "female") metrics.push("police_killings_female");
    const armed = low(C.armed);
    if (armed.startsWith("unarmed")) metrics.push("police_killings_unarmed");
    else if (armed === "allegedly armed") metrics.push("police_killings_armed");
    else if (armed === "vehicle") metrics.push("police_killings_vehicle_as_weapon");
    for (const [id, re] of CAUSES) if (re.test(low(C.cause))) metrics.push(`police_killings_cause_${id}`);
    for (const [id, re] of ENCOUNTERS) if (re.test(low(C.encounter))) metrics.push(`police_killings_encounter_${id}`);
    if (low(C.charges).startsWith("charged")) metrics.push("police_killings_officer_charged");
    if (/convicted|plead guilty|pled guilty/.test(low(C.charges))) metrics.push("police_killings_officer_convicted");
    if (low(C.mental) === "yes") metrics.push("police_killings_mental_illness");
    const flee = low(C.flee);
    if (flee === "not fleeing") metrics.push("police_killings_not_fleeing");
    else if (/car|foot|other/.test(flee)) metrics.push("police_killings_fleeing");
    if (low(C.bodycam) === "yes" || /body cam/.test(low(C.bodycam))) metrics.push("police_killings_body_camera");
    if (low(C.offDuty) === "off-duty") metrics.push("police_killings_off_duty");
    const age = num(r[C.age]);
    if (age !== null && age < 18) metrics.push("police_killings_under_18");

    const fips = STATE_FIPS[String(r[C.state] ?? "").trim()];
    for (const m of metrics) {
      bump("US", year, m);
      if (fips) bump(fips, year, m);
    }
  }
  const latest = through.getUTCFullYear();
  const throughIso = through.toISOString().slice(0, 10);
  const out = [...counts].map(([k, value]) => {
    const [geoid, year, metric] = k.split("|");
    const partial = Number(year) === latest;
    return {
      source: "mpv", metric, geo_level: geoid === "US" ? "nation" : "state", geoid,
      geo_name: geoid === "US" ? "United States" : FIPS_TO_NAME[geoid], period: year, period_start: `${year}-01-01`,
      value, unit: "people", metadata: partial ? { partial: true, through: throughIso } : {},
    };
  });
  console.log(`  mpv: ${out.length} rows, 2013–${latest} (through ${throughIso})`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

async function importCdc(pg) {
  await registerDataset(pg, "cdc-legal-intervention");
  const where = "injury_intent = 'Legal intervention/war' and age_years = 'All Ages'";
  const raw = await fetchJson(
    `https://data.cdc.gov/resource/nt65-c7a7.json?$where=${encodeURIComponent(where)}&$limit=50000`,
    {},
    { label: "cdc legal intervention" },
  );
  const RACE = { "Non-Hispanic white": "white_nh", "Non-Hispanic black": "black_nh", Hispanic: "hispanic" };
  const out = [];
  for (const r of raw) {
    const deaths = num(r.deaths);
    if (deaths === null) continue;
    let metric = null;
    if (r.sex === "Both sexes" && r.race === "All races") {
      metric = r.injury_mechanism === "All Mechanisms" ? "legal_intervention_deaths"
        : r.injury_mechanism === "Firearm" ? "legal_intervention_deaths_firearm" : null;
    } else if (r.injury_mechanism === "All Mechanisms" && r.sex === "Both sexes" && RACE[r.race]) {
      metric = `legal_intervention_deaths_${RACE[r.race]}`;
    } else if (r.injury_mechanism === "All Mechanisms" && r.race === "All races" && /^(Male|Female)$/.test(r.sex)) {
      metric = `legal_intervention_deaths_${r.sex.toLowerCase()}`;
    }
    if (!metric) continue;
    out.push({
      source: "cdc-legal-intervention", metric, geo_level: "nation", geoid: "US", geo_name: "United States",
      period: r.year, period_start: `${r.year}-01-01`, value: deaths, unit: "deaths",
      metadata: { rate_per_100k: num(r.age_specific_rate) },
    });
  }
  if (!out.some((r) => r.metric === "legal_intervention_deaths")) throw new Error("CDC nt65-c7a7 returned no legal-intervention totals — filter values changed?");
  console.log(`  cdc-legal-intervention: ${out.length} rows`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

await runImport("police-violence", async (pg) => {
  let inserted = 0;
  if (ONLY.has("mpv")) inserted += await importMpv(pg);
  if (ONLY.has("cdc")) inserted += await importCdc(pg);
  return { inserted };
});
