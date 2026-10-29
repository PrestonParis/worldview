// Imports Census Bureau population estimates by race and Hispanic origin,
// and by age, into `area_stats` (source census-pep-race), July 1 of each
// year:
//
//   pop_<group>, share_<group>   nation + state 1990–, county shares 2010–
//   median_age, median_age_<g>   nation + state 2010– (single-year ages);
//                                county median_age 2010– (Census-published)
//   share_under_18, share_65_plus  nation + state + county 2010–
//
// Groups: hispanic, and non-Hispanic white_nh, black_nh, asian_nh, aian_nh,
// nhpi_nh, multiracial_nh (2000–); plus single-race groups of any origin —
// white, black, aian, asian_pi (Asian and Pacific Islander combined) — the
// only race groups the 1990s estimates publish alongside white_nh and
// hispanic.
//
// Files (www2.census.gov, no key, cached in .cache/census-race):
//   1990–1999  tables/1990-2000/state/asrh/srh9X.txt     (ST-99-28)
//   2000–2009  datasets/2000-2010/intercensal/state/st-est00int-alldata.csv
//   2010–2019  Vintage 2020 county ALLDATA + AGESEX, state ALLDATA6
//   2020–      latest vintage county alldata + agesex, state alldata6
// State and national race counts from 2010 on are sums of the county files.
//
// Usage:
//   node scripts/import-census-race.mjs [--vintage=2025] [--levels=nation,state,county]
//   ENV_FILE=.env.cloud node scripts/import-census-race.mjs

import fs from "node:fs";
import path from "node:path";
import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "census-pep-race";
const VINTAGE = Number(arg("vintage", "2025"));
const LEVELS = arg("levels", "nation,state,county").split(",");
const CACHE = ".cache/census-race";
const POPEST = "https://www2.census.gov/programs-surveys/popest";

const FILES = {
  srh: (yy) => `${POPEST}/tables/1990-2000/state/asrh/srh${yy}.txt`,
  st2000: `${POPEST}/datasets/2000-2010/intercensal/state/st-est00int-alldata.csv`,
  cc2020: `${POPEST}/datasets/2010-2020/counties/asrh/CC-EST2020-ALLDATA.csv`,
  ccLatest: `${POPEST}/datasets/2020-${VINTAGE}/counties/asrh/cc-est${VINTAGE}-alldata.csv`,
  age2020: `${POPEST}/datasets/2010-2020/counties/asrh/CC-EST2020-AGESEX-ALL.csv`,
  ageLatest: `${POPEST}/datasets/2020-${VINTAGE}/counties/asrh/cc-est${VINTAGE}-agesex-all.csv`,
  sc2020: `${POPEST}/datasets/2010-2020/state/asrh/SC-EST2020-ALLDATA6.csv`,
  scLatest: `${POPEST}/datasets/2020-${VINTAGE}/state/asrh/sc-est${VINTAGE}-alldata6.csv`,
};

// County files' YEAR code -> July 1 year. Vintage 2020: 3 = 2010 … 12 =
// 2019 (13–14 are 2020, taken from the latest vintage). Latest vintage:
// 2 = 2020, 3 = 2021, …
const ccYear = {
  cc2020: (code) => (code >= 3 && code <= 12 ? 2007 + code : null),
  ccLatest: (code) => (code >= 2 ? 2018 + code : null),
};

// Race groups as county-file column prefixes (each has _MALE and _FEMALE).
const CC_GROUPS = {
  hispanic: ["H"], white_nh: ["NHWA"], black_nh: ["NHBA"], asian_nh: ["NHAA"], aian_nh: ["NHIA"],
  nhpi_nh: ["NHNA"], multiracial_nh: ["NHTOM"], white: ["WA"], black: ["BA"], aian: ["IA"], asian_pi: ["AA", "NA"],
};
const COUNTY_GROUPS = ["hispanic", "white_nh", "black_nh", "asian_nh", "aian_nh", "nhpi_nh", "multiracial_nh"];
// alldata (2000s) and alldata6 (2010s on): [ORIGIN, RACE codes] per group.
// ORIGIN 0 = all, 1 = non-Hispanic, 2 = Hispanic; RACE 1–6 = White, Black,
// AIAN, Asian, NHPI, two or more (0 = all races, 2000s file only).
const CODE_GROUPS = {
  hispanic: [2, [1, 2, 3, 4, 5, 6]], white_nh: [1, [1]], black_nh: [1, [2]], asian_nh: [1, [4]], aian_nh: [1, [3]],
  nhpi_nh: [1, [5]], multiracial_nh: [1, [6]], white: [0, [1]], black: [0, [2]], aian: [0, [3]], asian_pi: [0, [4, 5]],
};
const MEDIAN_GROUPS = { "": [0, [1, 2, 3, 4, 5, 6]], hispanic: CODE_GROUPS.hispanic, white_nh: CODE_GROUPS.white_nh, black_nh: CODE_GROUPS.black_nh, asian_nh: CODE_GROUPS.asian_nh };

const FIPS_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));
const UPPER_TO_FIPS = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [name.toUpperCase(), STATE_FIPS[abbr]]));

async function cached(url) {
  const file = path.join(CACHE, path.basename(url));
  if (!fs.existsSync(file)) {
    console.log(`  downloading ${path.basename(url)}`);
    const res = await fetchRetry(url, { timeoutMs: 900_000 }, { label: url });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  const buf = fs.readFileSync(file);
  // Older county files are Latin-1 (Doña Ana County); newer ones UTF-8.
  const utf8 = new TextDecoder("utf-8").decode(buf);
  return utf8.includes("�") ? new TextDecoder("latin1").decode(buf) : utf8;
}

// The Census bulk CSVs here have no quoted fields; splitting lines directly
// keeps the 200 MB county files out of an array of row objects.
function* csvRows(text, keep = () => true) {
  const lines = text.split(/\r?\n/);
  const head = lines[0].split(",");
  const idx = Object.fromEntries(head.map((h, i) => [h, i]));
  for (let i = 1; i < lines.length; i++) {
    if (!lines[i]) continue;
    const cells = lines[i].split(",");
    if (!keep(cells, idx)) continue;
    yield { cells, get: (k) => cells[idx[k]] };
  }
}

const out = [];
const row = (geoLevel, geoid, name, metric, year, value, unit, metadata) => {
  if (!Number.isFinite(value)) return;
  out.push({
    source: SOURCE, metric, geo_level: geoLevel, geoid, geo_name: name,
    period: String(year), period_start: `${year}-07-01`, value, unit, metadata,
  });
};
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

// Counts per group plus total -> pop_ and share_ rows.
function emitGroups(geoLevel, geoid, name, year, total, counts, metadata, { countsToo = true, groups = Object.keys(counts) } = {}) {
  if (countsToo) row(geoLevel, geoid, name, "pop_total", year, total, "people", metadata);
  for (const g of groups) {
    if (counts[g] === undefined) continue;
    if (countsToo) row(geoLevel, geoid, name, `pop_${g}`, year, counts[g], "people", metadata);
    row(geoLevel, geoid, name, `share_${g}`, year, round((counts[g] / total) * 100), "percent", metadata);
  }
}

// 1990s: fixed-width text, 8 numbers per line after the area name.
async function load1990s() {
  for (let y = 1990; y <= 1999; y++) {
    const text = await cached(FILES.srh(String(y).slice(2)));
    let areas = 0;
    for (const line of text.split(/\r?\n/)) {
      const m = line.match(/^([A-Z][A-Z .]+?)\s{2,}((?:\d+\s+){7}\d+)\s*$/);
      if (!m) continue;
      const name = m[1].trim();
      const [total, white, , whiteNh, black, aian, api, hispanic] = m[2].trim().split(/\s+/).map(Number);
      const counts = { white_nh: whiteNh, hispanic, white, black, aian, asian_pi: api };
      const meta = { file: `ST-99-28 (srh${String(y).slice(2)}.txt)` };
      if (name === "UNITED STATES") {
        if (LEVELS.includes("nation")) emitGroups("nation", "US", "United States", y, total, counts, meta);
      } else if (UPPER_TO_FIPS[name] && LEVELS.includes("state")) {
        emitGroups("state", UPPER_TO_FIPS[name], FIPS_NAME[UPPER_TO_FIPS[name]], y, total, counts, meta);
      } else continue;
      areas++;
    }
    console.log(`  ${y}: ${areas} areas`);
  }
}

// 2000s: intercensal state file, SEX 0, AGEGRP 0, ORIGIN × RACE cells.
async function load2000s() {
  const text = await cached(FILES.st2000);
  const cells = new Map(); // state -> year -> "origin:race" -> value
  for (const r of csvRows(text, (c, i) => c[i.SEX] === "0" && c[i.AGEGRP] === "0")) {
    const st = r.get("STATE").padStart(2, "0");
    const key = `${Number(r.get("ORIGIN"))}:${Number(r.get("RACE"))}`;
    for (let y = 2000; y <= 2009; y++) {
      const byYear = cells.get(st) ?? new Map();
      cells.set(st, byYear);
      const m = byYear.get(y) ?? {};
      byYear.set(y, m);
      m[key] = Number(r.get(`POPESTIMATE${y}`));
    }
  }
  for (const [st, byYear] of cells) {
    const [level, geoid, name] = st === "00" ? ["nation", "US", "United States"] : ["state", st, FIPS_NAME[st]];
    if (!LEVELS.includes(level) || !name) continue;
    for (const [y, m] of byYear) {
      const counts = Object.fromEntries(
        Object.entries(CODE_GROUPS).map(([g, [o, races]]) => [g, races.reduce((t, r) => t + (m[`${o}:${r}`] ?? 0), 0)]),
      );
      emitGroups(level, geoid, name, y, m["0:0"], counts, { file: "st-est00int-alldata" });
    }
  }
  console.log(`  2000–2009: ${cells.size} areas`);
}

// 2010 on: county race files, summed to states and the nation.
async function loadCountyRace() {
  const sums = new Map(); // geoid -> year -> {total, counts}
  const add = (geoid, name, level, y, total, counts) => {
    const k = `${level}:${geoid}`;
    const e = sums.get(k) ?? { level, geoid, name, years: new Map() };
    sums.set(k, e);
    const t = e.years.get(y) ?? { total: 0, counts: Object.fromEntries(Object.keys(CC_GROUPS).map((g) => [g, 0])) };
    e.years.set(y, t);
    t.total += total;
    for (const g of Object.keys(CC_GROUPS)) t.counts[g] += counts[g];
  };
  for (const [key, vintage] of [["cc2020", 2020], ["ccLatest", VINTAGE]]) {
    const text = await cached(FILES[key]);
    let n = 0;
    for (const r of csvRows(text, (c, i) => c[i.AGEGRP] === "0" && c[i.SUMLEV] === "050")) {
      const y = ccYear[key](Number(r.get("YEAR")));
      if (!y) continue;
      const st = r.get("STATE");
      const counts = Object.fromEntries(
        Object.entries(CC_GROUPS).map(([g, prefixes]) => [g, prefixes.reduce((t, p) => t + Number(r.get(`${p}_MALE`)) + Number(r.get(`${p}_FEMALE`)), 0)]),
      );
      const total = Number(r.get("TOT_POP"));
      const meta = { vintage };
      if (LEVELS.includes("county")) {
        emitGroups("county", st + r.get("COUNTY"), `${r.get("CTYNAME")}, ${r.get("STNAME")}`, y, total, counts, meta, {
          countsToo: false, groups: COUNTY_GROUPS,
        });
      }
      add(st, r.get("STNAME"), "state", y, total, counts);
      add("US", "United States", "nation", y, total, counts);
      n++;
    }
    console.log(`  V${vintage} county race: ${n} county-years`);
  }
  for (const { level, geoid, name, years } of sums.values()) {
    if (!LEVELS.includes(level)) continue;
    for (const [y, { total, counts }] of years) {
      emitGroups(level, geoid, name, y, total, counts, { vintage: y >= 2020 ? VINTAGE : 2020, summed_from: "county" });
    }
  }
}

// Median of single-year ages (85 = 85 and over), interpolated within the
// median year of age.
function medianAge(byAge) {
  const total = byAge.reduce((a, b) => a + b, 0);
  if (!total) return NaN;
  let cum = 0;
  for (let age = 0; age < byAge.length; age++) {
    if (cum + byAge[age] >= total / 2) return round(age + (total / 2 - cum) / byAge[age], 1);
    cum += byAge[age];
  }
  return NaN;
}

// 2010 on, nation + state: median age by group and age shares from the
// single-year-of-age state files (SEX 0 rows).
async function loadStateAges() {
  const ages = new Map(); // geoid -> year -> group -> number[86]
  const bump = (geoid, y, g, age, v) => {
    const byYear = ages.get(geoid) ?? new Map();
    ages.set(geoid, byYear);
    const groups = byYear.get(y) ?? {};
    byYear.set(y, groups);
    (groups[g] ??= new Array(86).fill(0))[age] += v;
  };
  for (const [key, from, to, vintage] of [["sc2020", 2010, 2019, 2020], ["scLatest", 2020, VINTAGE, VINTAGE]]) {
    const text = await cached(FILES[key]);
    for (const r of csvRows(text, (c, i) => c[i.SEX] === "0" && c[i.SUMLEV] === "040")) {
      const origin = Number(r.get("ORIGIN"));
      const race = Number(r.get("RACE"));
      const age = Number(r.get("AGE"));
      for (const [g, [o, races]] of Object.entries(MEDIAN_GROUPS)) {
        if (o !== origin || !races.includes(race)) continue;
        for (let y = from; y <= to; y++) {
          const v = Number(r.get(`POPESTIMATE${y}`));
          bump(r.get("STATE"), y, g, age, v);
          bump("US", y, g, age, v);
        }
      }
    }
    console.log(`  V${vintage} state ages loaded`);
  }
  for (const [geoid, byYear] of ages) {
    const [level, name] = geoid === "US" ? ["nation", "United States"] : ["state", FIPS_NAME[geoid]];
    if (!LEVELS.includes(level) || !name) continue;
    for (const [y, groups] of byYear) {
      const meta = { vintage: y >= 2020 ? VINTAGE : 2020 };
      for (const [g, byAge] of Object.entries(groups)) row(level, geoid, name, g ? `median_age_${g}` : "median_age", y, medianAge(byAge), "years", meta);
      const all = groups[""];
      const total = all.reduce((a, b) => a + b, 0);
      row(level, geoid, name, "share_under_18", y, round((all.slice(0, 18).reduce((a, b) => a + b, 0) / total) * 100), "percent", meta);
      row(level, geoid, name, "share_65_plus", y, round((all.slice(65).reduce((a, b) => a + b, 0) / total) * 100), "percent", meta);
    }
  }
}

// 2010 on, counties: Census's published median age and age-group totals.
async function loadCountyAges() {
  for (const [key, yearOf, vintage] of [["age2020", ccYear.cc2020, 2020], ["ageLatest", ccYear.ccLatest, VINTAGE]]) {
    const text = await cached(FILES[key]);
    let n = 0;
    for (const r of csvRows(text, (c, i) => c[i.SUMLEV] === "050")) {
      const y = yearOf(Number(r.get("YEAR")));
      if (!y) continue;
      const geoid = r.get("STATE") + r.get("COUNTY");
      if (!FIPS_NAME[r.get("STATE")]) continue; // Puerto Rico municipios
      const name = `${r.get("CTYNAME")}, ${r.get("STNAME")}`;
      const pop = Number(r.get("POPESTIMATE"));
      const meta = { vintage };
      row("county", geoid, name, "median_age", y, Number(r.get("MEDIAN_AGE_TOT")), "years", meta);
      row("county", geoid, name, "share_under_18", y, round(((pop - Number(r.get("AGE18PLUS_TOT"))) / pop) * 100), "percent", meta);
      row("county", geoid, name, "share_65_plus", y, round((Number(r.get("AGE65PLUS_TOT")) / pop) * 100), "percent", meta);
      n++;
    }
    console.log(`  V${vintage} county ages: ${n} county-years`);
  }
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  if (LEVELS.includes("nation") || LEVELS.includes("state")) {
    await load1990s();
    await load2000s();
    await loadStateAges();
  }
  await loadCountyRace();
  if (LEVELS.includes("county")) await loadCountyAges();
  console.log(`  ${out.length.toLocaleString()} rows`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"], { batchSize: 1000 });
  return { inserted, cursor: `V${VINTAGE}` };
});
