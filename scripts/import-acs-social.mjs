// Imports family and social characteristics into `area_stats` for the nation
// and every state from three Census Bureau sources:
//
//   census-acs1-family     ACS 1-year, 2008 onward (no 2020 release)
//     never_married_share, now_married_share, divorced_share, widowed_share
//                          marital status, people 15+ (B12001)
//     marriage_rate, divorce_rate
//                          women married / divorced in the past 12 months per
//                          1,000 women 15+ (B12501, B12503)
//     first_marriage_age_men, first_marriage_age_women   median (B12007)
//     births_per_1000_women   women 15–50 with a birth in the past 12 months
//                          per 1,000 (B13002)
//     births_unmarried_share  share of those mothers who are unmarried
//     households, family_households_share, married_couple_households_share,
//     other_family_households_share, living_alone_share
//                          household type (B11001); other families have a
//                          householder with no spouse present
//     avg_household_size  (B25010)
//     children_married_couple_share, children_single_mother_share,
//     children_single_father_share
//                          own children under 18 by family type (B09002)
//
//   census-acs1-social     ACS 1-year, 2008 onward
//     english_only_share, spanish_share, other_language_share,
//     limited_english_share   people 5+ (B06007)
//     hs_plus_share, bachelors_plus_share   people 25+ (B15002)
//     median_household_income (nominal dollars, B19013), poverty_rate (B17001)
//
//   census-urban-rural     Decennial census 2000, 2010, 2020
//     urban_population, rural_population, urban_share
//
// Variable codes are stable across these years; a few labels are checked
// each year so a renumbering fails loudly instead of loading wrong cells.
//
// Usage:
//   node scripts/import-acs-social.mjs [--years=2008-2024] [--only=acs,urban]
//   ENV_FILE=.env.cloud node scripts/import-acs-social.mjs

import { arg, checkCensusKey, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const [FROM, TO] = arg("years", "2008-2024").split("-").map(Number);
const YEARS = Array.from({ length: (TO ?? FROM) - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const ONLY = new Set(arg("only", "acs,urban").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];

const range = (table, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${table}_${String(from + i).padStart(3, "0")}E`);
const VARS = [
  ...range("B12001", 1, 19),
  "B12501_007E", "B12501_010E", "B12503_007E", "B12503_010E",
  "B12007_001E", "B12007_002E",
  "B13002_001E", "B13002_002E", "B13002_007E",
  ...range("B11001", 1, 8),
  "B25010_001E",
  "B09002_001E", "B09002_002E", "B09002_009E", "B09002_015E",
  "B06007_001E", "B06007_002E", "B06007_003E", "B06007_005E", "B06007_006E", "B06007_008E",
  ...range("B15002", 1, 35),
  "B19013_001E", "B17001_001E", "B17001_002E",
];

// Labels that must hold every year (fragments of the API label).
const CHECKS = {
  B12501_010E: "Married last year", B12503_010E: "Divorced last year", B13002_007E: "Unmarried",
  B09002_015E: "Female householder", B15002_032E: "Bachelor", B15002_028E: "High school graduate", B06007_008E: "less than",
};

async function checkLabels(year) {
  for (const [name, want] of Object.entries(CHECKS)) {
    const v = await fetchJson(`https://api.census.gov/data/${year}/acs/acs1/variables/${name}.json`, {}, { label: `${name} ${year}` });
    if (!v.label?.includes(want)) throw new Error(`${year} ${name}: label "${v.label}" lacks "${want}" — variables renumbered?`);
  }
}

async function fetchYear(year, key) {
  const rows = [];
  // The API takes at most 50 variables per call.
  const groups = [];
  for (let i = 0; i < VARS.length; i += 48) groups.push(VARS.slice(i, i + 48));
  for (const geo of ["us:1", "state:*"]) {
    const merged = new Map();
    for (const vars of groups) {
      const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,${vars.join(",")}&for=${geo}&key=${key}`;
      const [header, ...data] = await fetchJson(url, {}, { label: `ACS1 ${year} ${geo}` });
      for (const d of data) {
        const r = Object.fromEntries(header.map((h, i) => [h, d[i]]));
        const id = r.state ?? "US";
        merged.set(id, { ...merged.get(id), ...r });
      }
    }
    rows.push(...merged.values());
  }
  return rows;
}

const sum = (r, names) => names.reduce((t, n) => t + (num(r[n]) ?? 0), 0);
const share = (part, whole, scale = 100) => (whole ? Math.round((part / whole) * scale * 100) / 100 : null);

function acsRows(year, r) {
  const geoid = r.state ?? "US";
  const geo = { geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: r.NAME };
  const out = [];
  const add = (source, metric, value, unit) => {
    if (value === null || value === undefined || !Number.isFinite(value) || value < -1e6) return;
    out.push({ source, metric, ...geo, period: String(year), period_start: `${year}-01-01`, value, unit, metadata: null });
  };
  const v = (n) => num(r[n]);

  // ---- Family ----
  const F = "census-acs1-family";
  const adults = v("B12001_001E");
  add(F, "never_married_share", share(sum(r, ["B12001_003E", "B12001_012E"]), adults), "percent");
  add(F, "now_married_share", share(sum(r, ["B12001_004E", "B12001_013E"]), adults), "percent");
  add(F, "divorced_share", share(sum(r, ["B12001_010E", "B12001_019E"]), adults), "percent");
  add(F, "widowed_share", share(sum(r, ["B12001_009E", "B12001_018E"]), adults), "percent");
  add(F, "marriage_rate", share(v("B12501_010E"), v("B12501_007E"), 1000), "per_1000");
  add(F, "divorce_rate", share(v("B12503_010E"), v("B12503_007E"), 1000), "per_1000");
  add(F, "first_marriage_age_men", v("B12007_001E"), "years");
  add(F, "first_marriage_age_women", v("B12007_002E"), "years");
  add(F, "births_per_1000_women", share(v("B13002_002E"), v("B13002_001E"), 1000), "per_1000");
  add(F, "births_unmarried_share", share(v("B13002_007E"), v("B13002_002E")), "percent");
  const households = v("B11001_001E");
  add(F, "households", households, "households");
  add(F, "family_households_share", share(v("B11001_002E"), households), "percent");
  add(F, "married_couple_households_share", share(v("B11001_003E"), households), "percent");
  add(F, "other_family_households_share", share(v("B11001_004E"), households), "percent");
  add(F, "living_alone_share", share(v("B11001_008E"), households), "percent");
  add(F, "avg_household_size", v("B25010_001E"), "per_household");
  const kids = v("B09002_001E");
  add(F, "children_married_couple_share", share(v("B09002_002E"), kids), "percent");
  add(F, "children_single_mother_share", share(v("B09002_015E"), kids), "percent");
  add(F, "children_single_father_share", share(v("B09002_009E"), kids), "percent");

  // ---- Language, education, income ----
  const S = "census-acs1-social";
  const over5 = v("B06007_001E");
  add(S, "english_only_share", share(v("B06007_002E"), over5), "percent");
  add(S, "spanish_share", share(v("B06007_003E"), over5), "percent");
  add(S, "other_language_share", share(v("B06007_006E"), over5), "percent");
  add(S, "limited_english_share", share(sum(r, ["B06007_005E", "B06007_008E"]), over5), "percent");
  const over25 = v("B15002_001E");
  // Men's cells are 011–018, women's 028–035.
  const cells = (a, b) => range("B15002", a, b);
  add(S, "hs_plus_share", share(sum(r, [...cells(11, 18), ...cells(28, 35)]), over25), "percent");
  add(S, "bachelors_plus_share", share(sum(r, [...cells(15, 18), ...cells(32, 35)]), over25), "percent");
  add(S, "median_household_income", v("B19013_001E"), "usd");
  add(S, "poverty_rate", share(v("B17001_002E"), v("B17001_001E")), "percent");
  return out;
}

async function importAcs(pg, key) {
  await registerDataset(pg, "census-acs1-family");
  await registerDataset(pg, "census-acs1-social");
  let inserted = 0;
  for (const year of YEARS) {
    await checkLabels(year);
    const out = (await fetchYear(year, key)).flatMap((r) => acsRows(year, r));
    inserted += await upsertRows(pg, "area_stats", COLUMNS, out, KEY);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return inserted;
}

// Decennial urban/rural counts. The 2020 urban definition changed (housing
// density, 2,000 housing units / 5,000 people), so 2020 is not strictly
// comparable with 2000 and 2010.
const DECENNIAL = [
  [2020, "dec/dhc", "P2_001N", "P2_002N", "P2_003N"],
  [2010, "dec/sf1", "P002001", "P002002", "P002005"],
  [2000, "dec/sf1", "P002001", "P002002", "P002005"],
];

async function importUrbanRural(pg, key) {
  const slug = "census-urban-rural";
  await registerDataset(pg, slug);
  const out = [];
  for (const [year, path, total, urban, rural] of DECENNIAL) {
    for (const geo of ["us:1", "state:*"]) {
      const [header, ...data] = await fetchJson(
        `https://api.census.gov/data/${year}/${path}?get=NAME,${total},${urban},${rural}&for=${geo}&key=${key}`,
        {},
        { label: `${year} urban/rural ${geo}` },
      );
      for (const d of data) {
        const r = Object.fromEntries(header.map((h, i) => [h, d[i]]));
        const geoid = r.state ?? "US";
        if (geoid === "72") continue;
        const base = {
          source: slug, geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: r.NAME,
          period: String(year), period_start: `${year}-04-01`, metadata: year === 2020 ? { definition: "2020 urban areas" } : null,
        };
        const [t, u, ru] = [total, urban, rural].map((n) => num(r[n]));
        out.push({ ...base, metric: "urban_population", value: u, unit: "people" });
        out.push({ ...base, metric: "rural_population", value: ru, unit: "people" });
        out.push({ ...base, metric: "urban_share", value: share(u, t), unit: "percent" });
      }
    }
  }
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, out, KEY);
  console.log(`  ${slug}: ${out.length} rows`);
  return inserted;
}

await runImport("acs-social", async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  let inserted = 0;
  if (ONLY.has("acs")) inserted += await importAcs(pg, key);
  if (ONLY.has("urban")) inserted += await importUrbanRural(pg, key);
  return { inserted };
});
