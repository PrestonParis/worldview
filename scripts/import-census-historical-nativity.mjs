// Imports the Census Bureau's historical count of the foreign-born
// population into `area_stats` (nation, one row per decennial census):
//   foreign_born         1850–2000
//   foreign_born_share   1850–2000, percent of the total population
//   population           1850–2000, total resident population
//
// 1850–1990 is Table 1 of Census Population Division Working Paper No. 29
// (Gibson & Lennon, 1999); 2000 is the Census 2000 brief "The Foreign-Born
// Population: 2000" (C2KBR-34). Both are transcribed here — the working
// paper is a one-off release. ACS 1-year estimates (census-acs1-immigration)
// carry the series from 2005 on.
//
// 1850 and 1860 cover the free population only; 1950–2000 are sample data.
//
// Usage:
//   node scripts/import-census-historical-nativity.mjs
//   ENV_FILE=.env.cloud node scripts/import-census-historical-nativity.mjs

import { runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const TABLE = "https://www2.census.gov/library/working-papers/1999/demo/pop-twps0029/table01.xlsx";
const BRIEF = "https://www.census.gov/library/publications/2003/dec/c2kbr-34.html";

// [census year, total population, foreign-born population, foreign-born %]
const ROWS = [
  [1850, 23191876, 2244602, 9.7],
  [1860, 31443321, 4138697, 13.2],
  [1870, 38558371, 5567229, 14.4],
  [1880, 50155783, 6679943, 13.3],
  [1890, 62622250, 9249547, 14.8],
  [1900, 75994575, 10341276, 13.6],
  [1910, 91972266, 13515886, 14.7],
  [1920, 105710620, 13920692, 13.2],
  [1930, 122775046, 14204149, 11.6],
  [1940, 131669275, 11594896, 8.8],
  [1950, 150216110, 10347395, 6.9],
  [1960, 179325671, 9738091, 5.4],
  [1970, 203210158, 9619302, 4.7],
  [1980, 226545805, 14079906, 6.2],
  [1990, 248709873, 19767316, 7.9],
  [2000, 281421906, 31107889, 11.1],
];

await runImport("census-historical-nativity", async (pg) => {
  await registerDataset(pg, "census-historical-nativity");
  const out = [];
  for (const [y, total, fb, share] of ROWS) {
    const metadata = {
      source: y === 2000 ? BRIEF : TABLE,
      ...(y <= 1860 ? { note: "Free population only" } : {}),
    };
    const row = (metric, value, unit) =>
      out.push({
        source: "census-historical-nativity",
        metric,
        geo_level: "nation",
        geoid: "US",
        geo_name: "United States",
        period: String(y),
        period_start: `${y}-04-01`,
        value,
        unit,
        metadata,
      });
    row("population", total, "people");
    row("foreign_born", fb, "people");
    row("foreign_born_share", share, "percent");
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: "2000" };
});
