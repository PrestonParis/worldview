// Imports gun data into `area_stats` (firearm deaths from 2019 on are in
// cdc-violent-deaths, imported by import-cdc-violent-deaths.mjs):
//
//   cdc-injury-mortality  NCHS injury mortality, firearm deaths by intent and
//                         by age and by race, 1999–2016 (data.cdc.gov
//                         nt65-c7a7); age groups are geo_level 'age_group',
//                         races geo_level 'race' (white_nh, black_nh, hispanic)
//   gallup-guns           Gallup trend questions on gun ownership and laws
//
// Usage:
//   node scripts/import-guns.mjs [--only=cdc,gallup]
//   ENV_FILE=.env.cloud node scripts/import-guns.mjs

import { arg, fetchJson, fetchRetry, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { parseGallupTables } from "./lib/gallup.mjs";

const ONLY = new Set(arg("only", "cdc,gallup").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const US = { geo_level: "nation", geoid: "US", geo_name: "United States" };
// Gallup serves its data tables only to full browser user agents.
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Safari/605.1.15" } };

// ---- CDC ---------------------------------------------------------------------

const INTENTS = {
  "All Intentions": "firearm",
  Suicide: "firearm_suicide",
  Homicide: "firearm_homicide",
  Unintentional: "firearm_unintentional",
  Undetermined: "firearm_undetermined",
  "Legal intervention/war": "firearm_legal_intervention",
};
// Intents stored with a rate; the rest are counts only. Rates are crude
// (deaths per 100,000 residents), matching cdc-violent-deaths from 2019 on.
const RATED = new Set(["All Intentions", "Suicide", "Homicide"]);

async function importCdc(pg) {
  const slug = "cdc-injury-mortality";
  await registerDataset(pg, slug);
  const where = "injury_mechanism = 'Firearm' and sex = 'Both sexes' and race = 'All races'";
  const raw = await fetchJson(
    `https://data.cdc.gov/resource/nt65-c7a7.json?$where=${encodeURIComponent(where)}&$limit=50000`,
    { timeoutMs: 300_000 },
    { label: "cdc injury mortality" },
  );
  const rows = [];
  for (const r of raw) {
    const prefix = INTENTS[r.injury_intent];
    if (!prefix) continue;
    const base = { source: slug, period: r.year, period_start: `${r.year}-01-01`, metadata: null };
    if (r.age_years === "All Ages") {
      const deaths = num(r.deaths);
      if (deaths !== null) rows.push({ ...base, ...US, metric: prefix === "firearm" ? "firearm_deaths" : `${prefix}_deaths`, value: deaths, unit: "deaths" });
      const rate = num(r.age_specific_rate);
      if (RATED.has(r.injury_intent) && rate !== null) {
        rows.push({ ...base, ...US, metric: prefix === "firearm" ? "firearm_deaths_rate" : `${prefix}_rate`, value: Math.round(rate * 100) / 100, unit: "per_100k" });
      }
    } else if (r.injury_intent === "All Intentions") {
      const rate = num(r.age_specific_rate);
      if (rate !== null) {
        rows.push({
          ...base, metric: "firearm_deaths_rate_by_age", geo_level: "age_group", geoid: r.age_years, geo_name: r.age_years,
          value: Math.round(rate * 100) / 100, unit: "per_100k",
        });
      }
    }
  }
  // Race and Hispanic origin (all ages, both sexes): firearm deaths and
  // crude rates by intent, geo_level 'race' (white_nh, black_nh, hispanic).
  const RACES = { "Non-Hispanic white": "white_nh", "Non-Hispanic black": "black_nh", Hispanic: "hispanic" };
  const byRace = await fetchJson(
    `https://data.cdc.gov/resource/nt65-c7a7.json?$where=${encodeURIComponent("injury_mechanism = 'Firearm' and sex = 'Both sexes' and age_years = 'All Ages' and race != 'All races'")}&$limit=50000`,
    { timeoutMs: 300_000 },
    { label: "cdc injury mortality by race" },
  );
  for (const r of byRace) {
    const prefix = INTENTS[r.injury_intent];
    const race = RACES[r.race];
    if (!prefix || !race || !RATED.has(r.injury_intent)) continue;
    const base = { source: slug, period: r.year, period_start: `${r.year}-01-01`, metadata: null, geo_level: "race", geoid: race, geo_name: r.race };
    const deaths = num(r.deaths);
    const rate = num(r.age_specific_rate);
    if (deaths !== null) rows.push({ ...base, metric: prefix === "firearm" ? "firearm_deaths" : `${prefix}_deaths`, value: deaths, unit: "deaths" });
    if (rate !== null) rows.push({ ...base, metric: prefix === "firearm" ? "firearm_deaths_rate" : `${prefix}_rate`, value: Math.round(rate * 100) / 100, unit: "per_100k" });
  }
  if (!rows.some((r) => r.metric === "firearm_suicide_rate")) throw new Error("CDC injury mortality: no firearm suicide rows — columns renamed?");
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

// ---- Gallup ------------------------------------------------------------------

const GALLUP_TABLES = {
  "Guns > Have Gun in Home Table": { "Yes, do": "gun_in_home" },
  "Guns > Personally Own Gun Table": { "Personally own": "personally_own_gun" },
  "Guns > Firearm Sales Strict Table": { "More strict": "laws_more_strict", "Less strict": "laws_less_strict", "Kept as now": "laws_kept_as_now" },
  "Guns > Ban Possession of Handguns Table": { "Yes, should be": "ban_handguns" },
  "Guns > Should Not Ban Assault Weapons Table": { "Should be": "ban_assault_rifles" },
};

async function importGallup(pg) {
  const slug = "gallup-guns";
  await registerDataset(pg, slug);
  // Gallup's CDN sometimes serves a copy of the page without its data
  // tables; ask again until one has them.
  let html = "";
  for (let attempt = 1; attempt <= 8 && !html.includes("<table"); attempt++) {
    if (attempt > 1) await sleep(3000);
    html = await (await fetchRetry("https://news.gallup.com/poll/1645/guns.aspx", BROWSER)).text();
  }
  const rows = parseGallupTables(html, GALLUP_TABLES, slug);
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return inserted;
}

await runImport("guns", async (pg) => {
  let inserted = 0;
  if (ONLY.has("cdc")) inserted += await importCdc(pg);
  if (ONLY.has("gallup")) inserted += await importGallup(pg);
  return { inserted };
});
