// Builds the state and city demographic series behind /demographics and
// writes them to public/data/demographics/ (states.json + cities/<FIPS>.json).
//
//   Sex, race   states: Census population estimates 2010–2025 (Vintage 2020
//               + Vintage 2025 ALLDATA6). cities: ACS 1-year 2021–2024 for
//               every place the ACS publishes (65,000+ residents).
//   Religion    states: Pew Religious Landscape Study 2014 + 2023–24
//               (data/demographics/pew-rls-states.json).
//   Orientation states: national Gallup trend scaled by each state's
//               2015–16 Gallup LGBT share (data/demographics/gallup-lgbt-states.json).
//
// Projections: states take the national projection's change (central, low,
// high) proportionally per category, widened by the state's own damped
// trend; cities take their state's projected change. See
// src/lib/demographics/regional.ts.
//
// Census bulk files need no API key; they are cached in .cache/demographics.
//
// Usage: node scripts/build-demographics.mjs

import fs from "node:fs";
import path from "node:path";
import { fetchRetry } from "./lib/bulk.mjs";
import {
  demographicSeries,
  interpolateAnchors,
  normalize,
} from "../src/lib/demographics/forecast.ts";
import { packSeries, projectRegion, PROJECTION_END } from "../src/lib/demographics/regional.ts";

const CACHE = ".cache/demographics";
const OUT = "public/data/demographics";
const CENSUS = "https://www2.census.gov";

const FILES = {
  est2020: `${CENSUS}/programs-surveys/popest/datasets/2010-2020/state/asrh/SC-EST2020-ALLDATA6.csv`,
  est2025: `${CENSUS}/programs-surveys/popest/datasets/2020-2025/state/asrh/sc-est2025-alldata6.csv`,
  gazetteer: `${CENSUS}/geo/docs/maps-data/data/gazetteer/2024_Gazetteer/2024_Gaz_place_national.zip`,
};
const ACS_YEARS = [2021, 2022, 2023, 2024];
const acsUrl = (year, table) =>
  `${CENSUS}/programs-surveys/acs/summary_file/${year}/table-based-SF/data/1YRData/acsdt1y${year}-${table}.dat`;

async function cached(url) {
  const file = path.join(CACHE, path.basename(url));
  if (!fs.existsSync(file)) {
    console.log(`  downloading ${path.basename(url)}`);
    const res = await fetchRetry(url, { timeoutMs: 600_000 });
    fs.mkdirSync(CACHE, { recursive: true });
    fs.writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  }
  return file;
}

const national = Object.fromEntries(demographicSeries.map((series) => [series.id, series]));
const categoriesOf = (id) => national[id].categories.map((category) => category.id);
const share = (part, total) => (total > 0 ? (part / total) * 100 : 0);

// ---------------------------------------------------------------- states

const RACE_KEYS = ["nhWhite", "nhBlack", "nhAian", "nhAsian", "nhNhpi", "nhMultiracial"];

// state FIPS -> year -> { total, male, female, hispanic, nhWhite, ... }
function readStateEstimates(file, columns, counts) {
  const [header, ...lines] = fs.readFileSync(file, "latin1").trim().split(/\r?\n/);
  const cols = header.split(",");
  const index = Object.fromEntries(cols.map((name, i) => [name, i]));
  const names = {};
  for (const line of lines) {
    const row = line.split(",");
    const state = row[index.STATE];
    const sex = Number(row[index.SEX]);
    const origin = Number(row[index.ORIGIN]);
    const race = Number(row[index.RACE]);
    names[state] = row[index.NAME];
    for (const [column, year] of columns) {
      const value = Number(row[index[column]]);
      const bucket = ((counts[state] ??= {})[year] ??= {
        total: 0, male: 0, female: 0, hispanic: 0,
        ...Object.fromEntries(RACE_KEYS.map((key) => [key, 0])),
      });
      if (origin !== 0) {
        if (sex === 0 && origin === 1) bucket[RACE_KEYS[race - 1]] += value;
        if (sex === 0 && origin === 2) bucket.hispanic += value;
        continue;
      }
      if (sex === 0) bucket.total += value;
      if (sex === 1) bucket.male += value;
      if (sex === 2) bucket.female += value;
    }
  }
  return names;
}

function censusHistory(byYear, dimension) {
  return Object.entries(byYear)
    .map(([year, counts]) => ({
      year: Number(year),
      values: normalize(Object.fromEntries(
        categoriesOf(dimension).map((key) => [key, share(counts[key], counts.total)]),
      )),
    }))
    .sort((a, b) => a.year - b.year);
}

function religionHistory(record) {
  const keys = ["christian", "unaffiliated", "otherReligions"];
  const composition = (values) => {
    const known = keys.reduce((sum, key) => sum + (values[key] ?? 0), 0);
    return {
      christian: values.christian,
      unaffiliated: values.unaffiliated,
      otherReligions: values.otherReligions,
      notReported: values.notReported ?? Math.max(0, 100 - known),
    };
  };
  return interpolateAnchors(
    [
      { year: 2014, values: composition(record["2014"]) },
      { year: 2024, values: composition(record["2024"]) },
    ],
    2014,
    2024,
  );
}

// The national orientation series with the LGBT categories scaled by
// `index` (state share / U.S. share); "straight" absorbs the difference.
function scaledOrientation(index) {
  const lgbt = ["gayLesbian", "bisexual", "other"];
  const scale = (values, notReported) => {
    const out = Object.fromEntries(lgbt.map((key) => [key, values[key] * index]));
    out.notReported = notReported;
    out.straight = Math.max(0, 100 - lgbt.reduce((sum, key) => sum + out[key], 0) - notReported);
    return out;
  };
  return national.orientation.points.map((point) => {
    const values = normalize(scale(point.values, point.values.notReported));
    if (!point.low || !point.high) return { year: point.year, values };
    // Straight is lowest where LGBT identification is highest, and vice versa.
    const high = scale(point.high, point.high.notReported);
    const low = scale(point.low, point.low.notReported);
    high.straight = Math.max(0, 100 - lgbt.reduce((s, k) => s + low[k], 0) - point.low.notReported);
    low.straight = Math.max(0, 100 - lgbt.reduce((s, k) => s + high[k], 0) - point.high.notReported);
    return { year: point.year, values, low, high };
  });
}

const STATE_META = {
  sex: {
    basis: "Census estimates 2010–2025; projected with the national Census scenarios and the state's own trend",
    sources: [
      { label: "U.S. Census Bureau — State population by characteristics, 2010–2020", href: "https://www.census.gov/programs-surveys/popest/technical-documentation/research/evaluation-estimates/2020-evaluation-estimates/2010s-state-detail.html" },
      { label: "U.S. Census Bureau — State population by characteristics, 2020–2025", href: "https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-detail.html" },
      { label: "U.S. Census Bureau — 2023 National Population Projections", href: "https://www.census.gov/data/datasets/2023/demo/popproj/2023-popproj.html" },
    ],
  },
  race: {
    basis: "Census estimates 2010–2025; projected with the national Census scenarios and the state's own trend",
    sources: [
      { label: "U.S. Census Bureau — State population by characteristics, 2010–2020", href: "https://www.census.gov/programs-surveys/popest/technical-documentation/research/evaluation-estimates/2020-evaluation-estimates/2010s-state-detail.html" },
      { label: "U.S. Census Bureau — State population by characteristics, 2020–2025", href: "https://www.census.gov/data/tables/time-series/demo/popest/2020s-state-detail.html" },
      { label: "U.S. Census Bureau — 2023 National Population Projections", href: "https://www.census.gov/data/datasets/2023/demo/popproj/2023-popproj.html" },
    ],
  },
  orientation: {
    basis: "National Gallup trend scaled by the state's 2015–16 Gallup LGBT share relative to the U.S.",
    sources: [
      { label: "Gallup — Vermont Leads States in LGBT Identification (2015–16)", href: "https://news.gallup.com/poll/203513/vermont-leads-states-lgbt-identification.aspx" },
      { label: "Gallup — U.S. LGBTQ+ identification trend, 2012–2025", href: "https://news.gallup.com/poll/702206/lgbtq-identification-holds.aspx" },
    ],
  },
  religion: {
    basis: "Pew state samples, 2014 and 2023–24; projected with the national Pew scenarios and the state's own trend",
    sources: [
      { label: "Pew Research Center — Religious Landscape Study, by state", href: "https://www.pewresearch.org/religious-landscape-study/database/" },
      { label: "Pew Research Center — U.S. religious projections", href: "https://www.pewresearch.org/religion/2022/09/13/modeling-the-future-of-religion-in-america/" },
    ],
  },
};

const CITY_META = {
  sex: {
    basis: "ACS 1-year estimates 2021–2024; projected with the state's projected change",
    sources: [
      { label: "U.S. Census Bureau — ACS 1-year, Table B01001", href: "https://www.census.gov/programs-surveys/acs/data/summary-file.html" },
    ],
  },
  race: {
    basis: "ACS 1-year estimates 2021–2024 (“some other race” excluded); projected with the state's projected change",
    sources: [
      { label: "U.S. Census Bureau — ACS 1-year, Table B03002", href: "https://www.census.gov/programs-surveys/acs/data/summary-file.html" },
    ],
  },
};

// ---------------------------------------------------------------- cities

function readAcs(file, columns) {
  const [header, ...lines] = fs.readFileSync(file, "utf8").trim().split(/\r?\n/);
  const cols = header.split("|");
  const index = Object.fromEntries(cols.map((name, i) => [name, i]));
  const out = {};
  for (const line of lines) {
    if (!line.startsWith("1600000US")) continue;
    const row = line.split("|");
    out[row[0].slice(9)] = Object.fromEntries(
      Object.entries(columns).map(([key, column]) => [key, Number(row[index[column]])]),
    );
  }
  return out;
}

function cleanPlaceName(name) {
  return name
    .replace(/\s+\(balance\)$/, "")
    .replace(/\s+(?:[a-z][a-z-]*\s*)+$/, "")
    .replace(/\s+CDP$/, "")
    .trim();
}

// ---------------------------------------------------------------- main

console.log("Demographics: states + cities");
const counts = {};
readStateEstimates(
  await cached(FILES.est2020),
  Array.from({ length: 10 }, (_, i) => [`POPESTIMATE${2010 + i}`, 2010 + i]),
  counts,
);
const stateNames = readStateEstimates(
  await cached(FILES.est2025),
  Array.from({ length: 6 }, (_, i) => [`POPESTIMATE${2020 + i}`, 2020 + i]),
  counts,
);

const pew = JSON.parse(fs.readFileSync("data/demographics/pew-rls-states.json", "utf8")).states;
const gallup = JSON.parse(fs.readFileSync("data/demographics/gallup-lgbt-states.json", "utf8")).states;
const gallupUs =
  Object.entries(gallup).reduce((sum, [fips, row]) => sum + row.lgbtPercent * counts[fips][2016].total, 0) /
  Object.keys(gallup).reduce((sum, fips) => sum + counts[fips][2016].total, 0);

const gazetteer = await cached(FILES.gazetteer);
const { execFileSync } = await import("node:child_process");
const gazText = execFileSync("unzip", ["-p", gazetteer], { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
const [gazHeader, ...gazLines] = gazText.trim().split(/\r?\n/);
const gazCols = gazHeader.split("\t").map((name) => name.trim());
const places = Object.fromEntries(
  gazLines.map((line) => {
    const row = Object.fromEntries(line.split("\t").map((value, i) => [gazCols[i], value.trim()]));
    return [row.GEOID, row];
  }),
);
const STATE_ABBR = {};
for (const row of Object.values(places)) STATE_ABBR[row.GEOID.slice(0, 2)] = row.USPS;

const acs = {};
for (const year of ACS_YEARS) {
  const sex = readAcs(await cached(acsUrl(year, "b01001")), { total: "B01001_E001", male: "B01001_E002", female: "B01001_E026" });
  const race = readAcs(await cached(acsUrl(year, "b03002")), {
    nhWhite: "B03002_E003", nhBlack: "B03002_E004", nhAian: "B03002_E005", nhAsian: "B03002_E006",
    nhNhpi: "B03002_E007", nhMultiracial: "B03002_E009", hispanic: "B03002_E012",
  });
  for (const [geoid, values] of Object.entries(sex)) ((acs[geoid] ??= {})[year] = { ...values, ...race[geoid] });
}

const stateRegions = [];
const cityFiles = {};
const stateIds = Object.keys(counts).filter((fips) => Number(fips) < 60).sort();

for (const fips of stateIds) {
  const byYear = counts[fips];
  const series = {};
  const projected = {};
  for (const dimension of ["sex", "race"]) {
    projected[dimension] = projectRegion({
      history: censusHistory(byYear, dimension),
      observedThrough: 2025,
      reference: { points: national[dimension].points, scenarios: national[dimension].scenarios },
      includeTrend: true,
    });
    series[dimension] = packSeries(projected[dimension].points, 2025, categoriesOf(dimension));
  }
  if (pew[fips]) {
    const { points } = projectRegion({
      history: religionHistory(pew[fips]),
      observedThrough: 2024,
      reference: { points: national.religion.points, scenarios: national.religion.scenarios },
      includeTrend: true,
      // Pew's state pages give no "don't know" share; it is the rounding
      // remainder, so it has no trend to extend.
      holdInTrend: ["notReported"],
    });
    series.religion = packSeries(points, 2024, ["christian", "unaffiliated", "otherReligions", "notReported"]);
  }
  if (gallup[fips]) {
    series.orientation = packSeries(
      scaledOrientation(gallup[fips].lgbtPercent / gallupUs),
      national.orientation.observedThrough,
      categoriesOf("orientation"),
    );
  }
  stateRegions.push({
    id: fips,
    name: stateNames[fips],
    abbr: STATE_ABBR[fips],
    population: byYear[2025].total,
    series,
  });

  const cities = [];
  for (const [geoid, years] of Object.entries(acs)) {
    if (geoid.slice(0, 2) !== fips || !years[2024] || !places[geoid]) continue;
    const citySeries = {};
    for (const dimension of ["sex", "race"]) {
      const keys = categoriesOf(dimension);
      const observed = Object.entries(years)
        .filter(([, values]) => keys.every((key) => Number.isFinite(values[key])))
        .map(([year, values]) => {
          const total = keys.reduce((sum, key) => sum + values[key], 0);
          return { year: Number(year), values: Object.fromEntries(keys.map((key) => [key, share(values[key], total)])) };
        });
      if (!observed.some((point) => point.year === 2024)) continue;
      const history = interpolateAnchors(observed, observed[0].year, 2024);
      const { points } = projectRegion({
        history,
        observedThrough: 2024,
        reference: projected[dimension],
        includeTrend: false,
      });
      citySeries[dimension] = packSeries(points, 2024, keys);
    }
    const place = places[geoid];
    cities.push({
      id: geoid,
      name: cleanPlaceName(place.NAME),
      stateId: fips,
      lat: Number(place.INTPTLAT),
      lon: Number(place.INTPTLONG),
      population: years[2024].total,
      series: citySeries,
    });
  }
  cities.sort((a, b) => b.population - a.population);
  cityFiles[fips] = cities;
}

fs.mkdirSync(path.join(OUT, "cities"), { recursive: true });
fs.writeFileSync(
  path.join(OUT, "states.json"),
  JSON.stringify({ dimensions: STATE_META, regions: stateRegions }),
);
let cityCount = 0;
for (const [fips, regions] of Object.entries(cityFiles)) {
  cityCount += regions.length;
  fs.writeFileSync(
    path.join(OUT, "cities", `${fips}.json`),
    JSON.stringify({ dimensions: CITY_META, regions }),
  );
}
console.log(`  ${stateRegions.length} states, ${cityCount} cities, through ${PROJECTION_END}`);
console.log(`  Gallup 2015–16 U.S. LGBT share (population-weighted): ${gallupUs.toFixed(2)}%`);
