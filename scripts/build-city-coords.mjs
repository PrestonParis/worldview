// Writes src/lib/crime/city-coords.json: ORI -> [longitude, latitude] for
// every police department in fbi-cde-cities, from the coordinates the FBI
// Crime Data Explorer agency directory gives each agency. The crime page's
// U.S. map places its city markers with it. Re-run after import:fbi-cities
// adds departments.
//
// Usage: node scripts/build-city-coords.mjs

import { writeFileSync } from "node:fs";
import { connectPg, fetchJson, loadEnv, num, sleep } from "./lib/bulk.mjs";
import { closeNeon, neon, placements } from "./lib/stores.mjs";

const OUT = "src/lib/crime/city-coords.json";
const CDE = "https://api.usa.gov/crime/fbi/cde";
// Departments the directory lists without coordinates: the city center.
const MISSING = {
  CA033320X: [-117.2297, 33.9425], // Moreno Valley
  CA0334900: [-117.1464, 33.6971], // Menifee
  CA036320X: [-117.3009, 34.4264], // Hesperia
  FL064250X: [-81.2637, 28.9005], // Deltona
  GA0607200: [-84.6693, 33.6187], // South Fulton
};

loadEnv();
const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || process.env.CONGRESS_GOV_API_KEY || "DEMO_KEY";
const pg = await connectPg();
try {
  const place = (await placements(pg, ["fbi-cde-cities"])).get("fbi-cde-cities");
  const db = place === "neon" && neon() ? neon() : pg;
  const { rows } = await db.query(
    "select distinct geoid, metadata->>'state' as state from area_stats where source = 'fbi-cde-cities' and geo_level = 'agency'",
  );
  const byState = new Map();
  for (const r of rows) if (r.state) byState.set(r.state, [...(byState.get(r.state) ?? []), r.geoid]);

  const coords = {};
  for (const [st, oris] of [...byState].sort()) {
    const dir = Object.values(await fetchJson(`${CDE}/agency/byStateAbbr/${st}?API_KEY=${key}`, {}, { label: `agencies ${st}` })).flat();
    const byOri = new Map(dir.map((a) => [a.ori, a]));
    for (const ori of oris) {
      const a = byOri.get(ori);
      const lat = num(a?.latitude);
      const lon = num(a?.longitude);
      if (lat !== null && lon !== null) coords[ori] = [Math.round(lon * 1e4) / 1e4, Math.round(lat * 1e4) / 1e4];
      else if (MISSING[ori]) coords[ori] = MISSING[ori];
      else console.log(`  no coordinates: ${st} ${ori}`);
    }
    await sleep(key === "DEMO_KEY" ? 120_000 : 150);
  }
  const sorted = Object.fromEntries(Object.entries(coords).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(OUT, `${JSON.stringify(sorted, null, 0).replace(/\],"/g, '],\n"')}\n`);
  console.log(`${Object.keys(sorted).length} of ${rows.length} departments placed -> ${OUT}`);
} finally {
  await pg.end();
  await closeNeon();
}
