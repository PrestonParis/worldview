// Imports family and fertility measures by the mother's nativity, by race
// and Hispanic origin, and child poverty by family structure, from the ACS
// 1-year, into `area_stats` (source census-acs1-family-groups), nation and
// states, 2010 onward (no 2020 release):
//
//   births_per_1000_women_<g>     women 15–50 with a birth in the past year,
//                                 per 1,000 (B13008 nativity; B13002H/B/D/I race)
//   births_unmarried_share_<g>    share of those mothers who are unmarried
//   births_foreign_born_mother_share   share of births to foreign-born mothers
//   married_couple_families_share_<r>, single_mother_families_share_<r>
//                                 share of families with a householder of the
//                                 race (B11001H/B/D/I)
//   child_poverty_<f>             children in poverty by family type (B17006):
//                                 married_couple, single_mother, single_father, all
//
// g = native, foreign_born, white_nh, black, asian, hispanic. Race groups are
// race alone (any origin) except white_nh; Hispanic is any race.
//
// Usage:
//   node scripts/import-acs-family-groups.mjs [--years=2010-2024]
//   ENV_FILE=.env.cloud node scripts/import-acs-family-groups.mjs

import { arg, checkCensusKey, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "census-acs1-family-groups";
const [FROM, TO] = arg("years", "2010-2024").split("-").map(Number);
const YEARS = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const RACES = { H: "white_nh", B: "black", D: "asian", I: "hispanic" };
const r3 = (t, a, b) => Array.from({ length: b - a + 1 }, (_, i) => `${t}_${String(a + i).padStart(3, "0")}E`);
const VARS = [
  ...r3("B13008", 1, 15),
  ...Object.keys(RACES).flatMap((r) => [...r3(`B13002${r}`, 1, 4), ...r3(`B11001${r}`, 1, 6)]),
  ...r3("B17006", 1, 29),
];

async function fetchYear(year, key) {
  const rows = [];
  for (const geo of ["us:1", "state:*"]) {
    const merged = new Map();
    for (let i = 0; i < VARS.length; i += 48) {
      const [head, ...data] = await fetchJson(
        `https://api.census.gov/data/${year}/acs/acs1?get=NAME,${VARS.slice(i, i + 48).join(",")}&for=${geo}&key=${key}`,
        {},
        { label: `ACS1 ${year} ${geo}` },
      );
      for (const d of data) {
        const r = Object.fromEntries(head.map((h, j) => [h, d[j]]));
        const id = r.state ?? "US";
        merged.set(id, { ...merged.get(id), ...r });
      }
    }
    rows.push(...merged.values());
  }
  return rows;
}

const pct = (a, b, scale = 100) => (a !== null && b ? Math.round((a / b) * scale * 100) / 100 : null);
const sum = (r, vars) => vars.reduce((t, v) => t + (num(r[v]) ?? 0), 0);

await runImport(SOURCE, async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (const year of YEARS) {
    const out = [];
    for (const r of await fetchYear(year, key)) {
      const geoid = r.state ?? "US";
      if (geoid === "72") continue;
      const base = { source: SOURCE, geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: r.NAME, period: String(year), period_start: `${year}-01-01`, metadata: null };
      const add = (metric, value, unit = "percent") => value !== null && Number.isFinite(value) && out.push({ ...base, metric, value, unit });
      const v = (n) => num(r[n]);
      // Nativity (B13008): mothers by marital status × nativity; women without a birth likewise.
      const birthsNative = sum(r, ["B13008_004E", "B13008_007E"]);
      const birthsForeign = sum(r, ["B13008_005E", "B13008_008E"]);
      const womenNative = birthsNative + sum(r, ["B13008_011E", "B13008_014E"]);
      const womenForeign = birthsForeign + sum(r, ["B13008_012E", "B13008_015E"]);
      add("births_per_1000_women_native", pct(birthsNative, womenNative, 1000), "per_1000");
      add("births_per_1000_women_foreign_born", pct(birthsForeign, womenForeign, 1000), "per_1000");
      add("births_unmarried_share_native", pct(v("B13008_007E"), birthsNative));
      add("births_unmarried_share_foreign_born", pct(v("B13008_008E"), birthsForeign));
      add("births_foreign_born_mother_share", pct(birthsForeign, birthsNative + birthsForeign));
      // Race (B13002x, B11001x).
      for (const [code, g] of Object.entries(RACES)) {
        add(`births_per_1000_women_${g}`, pct(v(`B13002${code}_002E`), v(`B13002${code}_001E`), 1000), "per_1000");
        add(`births_unmarried_share_${g}`, pct(v(`B13002${code}_004E`), v(`B13002${code}_002E`)));
        add(`married_couple_families_share_${g}`, pct(v(`B11001${code}_003E`), v(`B11001${code}_002E`)));
        add(`single_mother_families_share_${g}`, pct(v(`B11001${code}_006E`), v(`B11001${code}_002E`)));
      }
      // Child poverty by family type (B17006): below = 003–015, above = 017–029.
      const fam = { married_couple: [[4, 6], [18, 20]], single_father: [[9, 11], [23, 25]], single_mother: [[13, 15], [27, 29]] };
      for (const [f, [[a, b], [c, d]]] of Object.entries(fam)) {
        const below = sum(r, r3("B17006", a, b));
        add(`child_poverty_${f}`, pct(below, below + sum(r, r3("B17006", c, d))));
      }
      add("child_poverty_all", pct(v("B17006_002E"), v("B17006_001E")));
    }
    inserted += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted };
});
