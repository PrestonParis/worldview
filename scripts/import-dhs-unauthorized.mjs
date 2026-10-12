// Imports DHS's estimates of the unauthorized immigrant population into
// `area_stats` (period = the January 1 reference year, e.g. '2022'):
//   unauthorized_population        nation, 2000 and 2005–2022 (no 2001–2004, 2021)
//   unauthorized_by_country        top 10 countries of birth + 'all-other'
//   unauthorized_by_state          top 10 states of residence (FIPS geoid)
//   unauthorized_by_entry_period   2018–2020, 2022 (geo_level 'entry_period')
//
// OHSS publishes these only as PDF reports (irregularly — the latest, April
// 2024, covers January 2018–January 2022), so the tables are transcribed
// here: Table A2-1 (historical series, thousands) and Table 1 (period of
// entry). Where the report revises a year to a new census base or method
// (2010*, 2015**, 2018**), the revised value is used, and each row records
// its basis in metadata so the series breaks stay visible.
//
// Source: https://ohss.dhs.gov/topics/immigration/illegal/population-estimates
//
// Usage:
//   node scripts/import-dhs-unauthorized.mjs
//   ENV_FILE=.env.cloud node scripts/import-dhs-unauthorized.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const REPORT =
  "https://ohss.dhs.gov/sites/default/files/2024-06/2024_0418_ohss_estimates-of-the-unauthorized-immigrant-population-residing-in-the-united-states-january-2018%25E2%2580%2593january-2022.pdf";

const YEARS = [2000, 2005, 2006, 2007, 2008, 2009, 2010, 2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2022];
const basis = (y) =>
  y === 2000 ? "2000 Census" : y < 2010 ? "ACS tied to 2000 Census" : y < 2015 ? "ACS tied to 2010 Census" : y < 2018 ? "2015–2018 method update" : y < 2022 ? "2018–2020 method update" : "ACS tied to 2020 Census";

// Table A2-1, thousands, one value per YEARS entry (revised columns for
// 2010, 2015, 2018). null = not available.
const TOTAL = [8460, 10490, 11310, 11780, 11600, 10750, 11590, 11510, 11430, 11210, 11460, 11440, 11750, 11410, 11570, 11110, 10510, 10990];
const COUNTRIES = {
  Mexico: [4680, 5970, 6570, 6980, 7030, 6650, 6830, 6800, 6720, 6450, 6450, 6200, 5970, 5860, 5540, 5350, 4970, 4810],
  Guatemala: [290, 370, 430, 500, 430, 480, 520, 520, 560, 590, 620, 600, 610, 610, 620, 670, 780, 750],
  "El Salvador": [430, 470, 510, 540, 570, 530, 670, 660, 690, 690, 670, 720, 750, 750, 730, 750, 750, 710],
  Honduras: [160, 180, 280, 280, 300, 320, 380, 380, 360, 390, 390, 420, 430, 500, 450, 450, 550, 560],
  Philippines: [200, 210, 280, 290, 300, 270, 290, 270, 310, 340, 330, 350, 410, 300, 370, 360, 340, 350],
  Venezuela: [null, null, null, 60, 50, 50, 50, 50, 60, 50, 40, 80, 100, 120, 190, 220, 260, 320],
  Colombia: [100, 110, 140, 130, 130, 100, 120, 130, 130, 160, 130, 130, 140, 130, 210, 190, 190, 240],
  Brazil: [100, 170, 210, 190, 180, 150, 150, 150, 130, 110, 110, 100, 110, 150, 190, 180, 190, 230],
  India: [120, 280, 210, 220, 160, 200, 270, 240, 260, 320, 390, 450, 560, 490, 480, 390, 340, 220],
  China: [190, 230, 170, 290, 220, 120, 300, 280, 210, 190, 230, 320, 420, 410, 390, 330, 270, 210],
  "All other countries": [2180, 2500, 2510, 2290, 2240, 1880, 2020, 2030, 2010, 1920, 2090, 2080, 2260, 2090, 2400, 2220, 1870, 2600],
};
const STATES = {
  California: [2510, 2770, 2790, 2840, 2850, 2600, 2910, 2830, 2820, 2780, 2730, 2760, 2860, 2790, 2640, 2620, 2410, 2600],
  Texas: [1090, 1360, 1620, 1710, 1680, 1680, 1780, 1790, 1830, 1750, 1850, 1860, 1910, 1870, 1950, 1950, 1900, 2060],
  Florida: [800, 850, 960, 960, 840, 720, 730, 740, 730, 740, 710, 540, 610, 610, 680, 650, 610, 590],
  "New Jersey": [350, 380, 420, 470, 400, 360, 440, 420, 430, 410, 450, 420, 420, 450, 460, 390, 400, 490],
  Illinois: [440, 520, 530, 560, 550, 540, 550, 550, 540, 520, 530, 440, 520, 440, 460, 440, 370, 420],
  "New York": [540, 560, 510, 640, 640, 550, 690, 630, 580, 610, 570, 630, 630, 620, 600, 510, 370, 410],
  "North Carolina": [260, 360, 360, 380, 380, 370, 390, 400, 360, 400, 390, 370, 360, 320, 360, 340, 360, 360],
  Georgia: [220, 470, 490, 490, 460, 480, 430, 440, 400, 390, 410, 370, 400, 400, 390, 360, 360, 340],
  Washington: [170, null, 280, 260, 260, 230, 260, 260, 270, 240, 280, 260, 280, 280, 310, 330, 340, 340],
  Arizona: [330, 480, 490, 530, 560, 460, 350, 360, 350, 350, 350, 360, 330, 340, 340, 330, 340, 290],
};
// Table 1, people.
const ENTRY_YEARS = [2018, 2019, 2020, 2022];
const ENTRY = {
  "1980–1989": [1560000, 1520000, 1480000, 1460000],
  "1990–1999": [3820000, 3540000, 3420000, 3360000],
  "2000–2009": [4230000, 4180000, 3930000, 3860000],
  "2010 or later": [1960000, 1870000, 1680000, 2310000],
};

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

await runImport("dhs-unauthorized", async (pg) => {
  await registerDataset(pg, "dhs-unauthorized");
  const out = [];
  const row = (metric, geoLevel, geoid, geoName, y, value) => {
    if (value === null) return;
    out.push({
      source: "dhs-unauthorized", metric, geo_level: geoLevel, geoid, geo_name: geoName,
      period: String(y), period_start: `${y}-01-01`, value, unit: "people",
      metadata: { basis: basis(y), report: REPORT },
    });
  };
  YEARS.forEach((y, i) => {
    row("unauthorized_population", "nation", "US", "United States", y, TOTAL[i] * 1000);
    for (const [name, vals] of Object.entries(COUNTRIES)) {
      if (vals[i] !== null) row("unauthorized_by_country", "country", slug(name), name, y, vals[i] * 1000);
    }
    for (const [name, vals] of Object.entries(STATES)) {
      if (vals[i] !== null) row("unauthorized_by_state", "state", STATE_FIPS[STATE_NAME_TO_ABBR[name]], name, y, vals[i] * 1000);
    }
  });
  ENTRY_YEARS.forEach((y, i) => {
    for (const [name, vals] of Object.entries(ENTRY)) row("unauthorized_by_entry_period", "entry_period", slug(name), name, y, vals[i]);
  });
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: "2022" };
});
