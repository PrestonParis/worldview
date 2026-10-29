// Imports the FBI's Law Enforcement Officers Killed and Assaulted (LEOKA)
// year-to-date figures into `area_stats` (source fbi-leoka), nation, 2020
// onward (the Crime Data Explorer has no earlier detail):
//
//   officers_killed_felonious, officers_killed_accidental
//   felonious_weapon_<w>          officers feloniously killed, by weapon
//   felonious_offender_race_<r>, felonious_offender_sex_<s>,
//   felonious_offender_status_<s> offenders in felonious killings
//   accidental_type_<t>           accidental deaths by incident type
//
// Source: https://cde.ucr.cjis.gov/LATEST/leoka/ytd?year= (the JSON behind
// the CDE's LEOKA page) — free, no key.
//
// Usage:
//   node scripts/import-fbi-leoka.mjs [--from=2020]
//   ENV_FILE=.env.cloud node scripts/import-fbi-leoka.mjs

import { arg, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "fbi-leoka";
const FROM = Number(arg("from", "2020"));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

await runImport(SOURCE, async (pg) => {
  const out = [];
  const labels = {};
  const thisYear = new Date().getFullYear();
  const row = (metric, year, value, label, unit = "officers", metadata = null) => {
    if (value === null) return;
    labels[metric] = { label, unit };
    out.push({
      source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States",
      period: String(year), period_start: `${year}-01-01`, value, unit, metadata,
    });
  };
  const breakdown = (prefix, obj, year, what, unit) => {
    for (const [l, v] of Object.entries(obj ?? {})) row(`${prefix}_${slug(l)}`, year, num(v), `${what}: ${l}`, unit, year === thisYear ? { partial: true } : null);
  };
  let latest = null;
  for (let y = FROM; y <= thisYear; y++) {
    const [res] = await fetchJson(`https://cde.ucr.cjis.gov/LATEST/leoka/ytd?year=${y}`);
    const c = res?.leoka_chart_ytd?.data?.chart_data;
    if (!c) continue;
    latest = c;
    breakdown("felonious_weapon", c.weapons, y, "Officers feloniously killed, by weapon");
    breakdown("felonious_offender_race", c.offender_demographic?.offender_race, y, "Offenders in felonious killings, by race", "offenders");
    breakdown("felonious_offender_sex", c.offender_demographic?.offender_sex, y, "Offenders in felonious killings, by sex", "offenders");
    breakdown("felonious_offender_status", c.offender_demographic?.offender_status, y, "Offenders in felonious killings, by status", "offenders");
    breakdown("accidental_type", c.officer_incident_type, y, "Officers accidentally killed, by incident type");
  }
  if (!latest) throw new Error("LEOKA: no years returned");
  // The newest file carries every year's death totals.
  for (const [kind, byYear] of Object.entries(latest.officer_death_by_year ?? {})) {
    for (const [y, v] of Object.entries(byYear)) {
      row(`officers_killed_${slug(kind)}`, y, num(v), `Officers killed (${kind.toLowerCase()})`, "officers", Number(y) === thisYear ? { partial: true } : null);
    }
  }
  await registerDataset(pg, SOURCE, labels);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
