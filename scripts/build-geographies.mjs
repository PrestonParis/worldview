// Fills `geographies` (supabase/sql/2026-10-16-geographies.sql): one row per
// place with a single canonical name and its parent state, so area_stats
// rows from different datasets can be joined and labeled by place.
//
//   nation   US
//   state    public/data/us-states.geojson + the five territories
//   county   Census ACS names ("Autauga County"), else the county GeoJSON
//   cd, sldu, sldl   Census ACS names, without the vintage and state
//
// Idempotent (upsert on level + geoid). Reads ACS names from whichever
// database holds census-acs5 (Supabase or the Neon overflow).
//
// Usage:
//   node scripts/build-geographies.mjs
//   ENV_FILE=.env.cloud node scripts/build-geographies.mjs

import { readFileSync } from "node:fs";
import { connectPg, loadEnv, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { closeNeon, neon, placements } from "./lib/stores.mjs";

const ACS = "census-acs5";
const DISTRICT_LEVELS = ["cd", "sldu", "sldl"];

const geojson = (file) => JSON.parse(readFileSync(`public/data/${file}`, "utf8")).features;
const abbrByFips = Object.fromEntries(Object.entries(STATE_FIPS).map(([abbr, fips]) => [fips, abbr]));
const nameByAbbr = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));

// "Congressional District 52 (119th Congress), California" -> "Congressional District 52"
// "State House District 1 (2024); Alabama" -> "State House District 1"
// "Autauga County, Alabama" -> "Autauga County"
function placeName(acsName) {
  return acsName.replace(/[;,]\s*[^;,]+$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
}

loadEnv();
const pg = await connectPg();
try {
  const rows = [{ level: "nation", geoid: "US", name: "United States", state: null, parent_level: null, parent_geoid: null }];
  const child = (level, geoid, name) => ({
    level,
    geoid,
    name,
    state: abbrByFips[geoid.slice(0, 2)] ?? null,
    parent_level: "state",
    parent_geoid: geoid.slice(0, 2),
  });

  for (const [fips, abbr] of Object.entries(abbrByFips)) {
    rows.push({ level: "state", geoid: fips, name: nameByAbbr[abbr] ?? abbr, state: abbr, parent_level: "nation", parent_geoid: "US" });
  }
  for (const f of geojson("us-states.geojson")) {
    const row = rows.find((r) => r.level === "state" && r.geoid === f.properties.GEOID);
    if (row) row.name = f.properties.NAME;
  }

  const placement = (await placements(pg, [ACS])).get(ACS);
  const acsDb = placement === "neon" ? neon() : pg;
  if (!acsDb) throw new Error(`${ACS} is stored in Neon but NEON_DATABASE_URL is not set`);
  const { rows: acs } = await acsDb.query(
    `select geo_level, geoid, max(geo_name) as name from area_stats
     where source = $1 and geo_level = any($2) and geo_name is not null
     group by 1, 2`,
    [ACS, ["county", ...DISTRICT_LEVELS]],
  );
  const counties = new Map(acs.filter((r) => r.geo_level === "county").map((r) => [r.geoid, placeName(r.name)]));
  for (const f of geojson("us-counties.geojson")) {
    if (!counties.has(f.id)) counties.set(f.id, `${f.properties.NAME} ${f.properties.LSAD}`.trim());
  }
  for (const [geoid, name] of counties) rows.push(child("county", geoid, name));
  for (const r of acs.filter((r) => DISTRICT_LEVELS.includes(r.geo_level))) rows.push(child(r.geo_level, r.geoid, placeName(r.name)));

  await upsertRows(pg, "geographies", ["level", "geoid", "name", "state", "parent_level", "parent_geoid"], rows, ["level", "geoid"]);
  const { rows: counts } = await pg.query("select level, count(*)::int as n from geographies group by 1 order by 1");
  console.log("geographies:", Object.fromEntries(counts.map((r) => [r.level, r.n])));
} finally {
  await pg.end();
  await closeNeon();
}
