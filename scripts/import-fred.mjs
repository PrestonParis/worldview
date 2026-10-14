// Imports economy, housing, energy-price, and college-cost series from FRED
// (Federal Reserve Bank of St. Louis) into `area_stats`. FRED republishes
// BLS, BEA, Census, Federal Reserve, and other agencies' series unchanged;
// its keyless CSV endpoint (fredgraph.csv) serves any series, and can
// aggregate to a lower frequency (fq/fam).
//
//   fred-economy        jobs, unemployment, inflation, wages, GDP, income,
//                       rates, sentiment, recessions; states: unemployment,
//                       per capita income, minimum wage
//   fred-housing        home prices, mortgage rates, starts, homeownership,
//                       vacancy, rent inflation; states: FHFA prices, ownership
//   fred-energy-prices  gasoline, electricity, crude oil, natural gas
//   fred-education      student loans, college tuition prices
//
// Periods: monthly "2026-08", quarterly "2026-Q2", annual "2026".
//
// Usage:
//   node scripts/import-fred.mjs [--only=economy,housing,energy,education,states]
//   ENV_FILE=.env.cloud node scripts/import-fred.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, parseCsv, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const ONLY = new Set(arg("only", "economy,housing,energy,education,states").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));
const STATES = Object.keys(STATE_FIPS).filter((abbr) => STATE_NAMES[abbr] && Number(STATE_FIPS[abbr]) < 60);

// [FRED id, metric, unit, frequency, options]
//   freq     M | Q | A — the frequency stored (FRED aggregates with fq)
//   yoy      also store the 12-month (or 4-quarter, 1-year) percent change
//            under this metric, instead of (or with `keep`, besides) the level
//   scale    multiply values (FRED reports thousands, billions, dollars/kWh)
//   fam      FRED aggregation method when converting (avg | eop)
//   from     first date requested
const NATION = {
  "fred-economy": [
    ["UNRATE", "unemployment_rate", "percent", "M"],
    ["PAYEMS", "payroll_jobs", "jobs", "M", { scale: 1000 }],
    ["CIVPART", "labor_force_participation", "percent", "M"],
    ["LNS12300060", "prime_age_employment", "percent", "M"],
    ["CPIAUCSL", "cpi", "index", "M", { yoy: "inflation_rate", keep: true }],
    ["CPILFESL", "core_inflation_rate", "percent", "M", { yoy: "core_inflation_rate" }],
    ["CES0500000003", "avg_hourly_earnings", "usd_cents", "M"],
    ["LES1252881600Q", "real_median_weekly_earnings", "usd", "Q"],
    ["A191RL1Q225SBEA", "gdp_growth", "percent", "Q"],
    ["A939RX0Q048SBEA", "real_gdp_per_capita", "usd", "Q"],
    ["MEHOINUSA672N", "real_median_household_income", "usd", "A"],
    ["MEHOINUSA646N", "median_household_income", "usd", "A"],
    ["UMCSENT", "consumer_sentiment", "index", "M"],
    ["FEDFUNDS", "fed_funds_rate", "percent", "M"],
    ["USREC", "recession", "flag", "M", { from: "1945-01-01" }],
    ["FEDMINNFRWG", "federal_minimum_wage", "usd_cents", "A", { fam: "eop" }],
  ],
  "fred-housing": [
    ["CSUSHPINSA", "home_price_index", "index", "M", { yoy: "home_price_growth", keep: true }],
    ["MSPUS", "median_home_sale_price", "usd", "Q"],
    ["MORTGAGE30US", "mortgage_rate_30y", "percent", "M", { fam: "avg" }],
    ["HOUST", "housing_starts", "units", "M", { scale: 1000 }],
    ["RHORUSQ156N", "homeownership_rate", "percent", "Q"],
    ["RRVRUSQ156N", "rental_vacancy_rate", "percent", "Q"],
    ["CUSR0000SEHA", "rent_inflation", "percent", "M", { yoy: "rent_inflation" }],
  ],
  "fred-energy-prices": [
    ["APU000074714", "gas_price", "usd_cents", "M"],
    ["APU000072610", "electricity_price", "cents", "M", { scale: 100 }],
    ["MCOILWTICO", "oil_price", "usd_cents", "M"],
    ["MHHNGSP", "natural_gas_price", "usd_cents", "M"],
  ],
  "fred-education": [
    ["SLOAS", "student_loans", "usd", "Q", { scale: 1e6 }], // millions
    ["CUUR0000SEEB", "tuition_cpi", "index", "M"],
  ],
};

// Per state: [dataset, id(abbr), metric, unit, freq, options]. `optional`
// series don't exist for every state (no state minimum wage law).
const STATE_SERIES = [
  ["fred-economy", (s) => `${s}UR`, "unemployment_rate", "percent", "M", { from: "2015-01-01" }],
  ["fred-economy", (s) => `${s}UR`, "unemployment_rate_annual", "percent", "A", { fam: "avg" }],
  ["fred-economy", (s) => `${s}PCPI`, "per_capita_income", "usd", "A", { from: "1990-01-01" }],
  ["fred-economy", (s) => `STTMINWG${s}`, "state_minimum_wage", "usd_cents", "A", { optional: true, from: "1990-01-01" }],
  ["fred-housing", (s) => `${s}STHPI`, "home_price_index", "index", "A", { fam: "avg", from: "1990-01-01", yoy: "home_price_growth", keep: true }],
  ["fred-housing", (s) => `${s}HOWN`, "homeownership_rate", "percent", "A", { from: "1990-01-01" }],
];

const FREQ = { M: "Monthly", Q: "Quarterly", A: "Annual" };

async function fetchSeries(id, freq, { fam, from, optional } = {}) {
  const params = new URLSearchParams({ id });
  if (fam) {
    params.set("fq", FREQ[freq]);
    params.set("fam", fam);
  }
  if (from) params.set("cosd", from);
  let res;
  try {
    res = await fetchRetry(`https://fred.stlouisfed.org/graph/fredgraph.csv?${params}`, {}, { label: `FRED ${id}` });
  } catch (err) {
    if (optional && /-> 404/.test(err.message)) return null;
    throw err;
  }
  const rows = parseCsv(await res.text());
  if (rows.length && !(id in rows[0])) throw new Error(`FRED ${id}: unexpected columns ${Object.keys(rows[0]).join(",")}`);
  await sleep(250);
  return rows
    .filter((r) => r[id] !== "" && r[id] !== ".")
    .map((r) => ({ date: r.observation_date, value: Number(r[id]) }))
    .filter((p) => Number.isFinite(p.value));
}

const periodOf = (date, freq) => {
  const [y, mo] = date.split("-");
  if (freq === "M") return `${y}-${mo}`;
  if (freq === "Q") return `${y}-Q${Math.floor((Number(mo) - 1) / 3) + 1}`;
  return y;
};

function toRows(source, points, metric, unit, freq, geo, { yoy, keep, scale = 1 } = {}, id) {
  const rows = [];
  const base = { source, ...geo, metadata: { series: id } };
  if (!yoy || keep) {
    for (const p of points) {
      rows.push({ ...base, metric, period: periodOf(p.date, freq), period_start: p.date, value: Math.round(p.value * scale * 1e4) / 1e4, unit });
    }
  }
  if (yoy) {
    // Only where the prior point is exactly one year earlier.
    const byDate = new Map(points.map((p) => [p.date, p.value]));
    for (const p of points) {
      const [y, rest] = [Number(p.date.slice(0, 4)), p.date.slice(4)];
      const prior = byDate.get(`${y - 1}${rest}`);
      if (!prior) continue;
      rows.push({ ...base, metric: yoy, period: periodOf(p.date, freq), period_start: p.date, value: Math.round((p.value / prior - 1) * 1e4) / 1e2, unit: "percent" });
    }
  }
  return rows;
}

const US = { geo_level: "nation", geoid: "US", geo_name: "United States" };
const TOPICS = { economy: "fred-economy", housing: "fred-housing", energy: "fred-energy-prices", education: "fred-education" };

await runImport("fred", async (pg) => {
  let inserted = 0;
  for (const [topic, slug] of Object.entries(TOPICS)) {
    if (!ONLY.has(topic)) continue;
    await registerDataset(pg, slug);
    const rows = [];
    for (const [id, metric, unit, freq, opts = {}] of NATION[slug]) {
      const points = await fetchSeries(id, freq, opts);
      if (!points.length) throw new Error(`FRED ${id}: no observations`);
      rows.push(...toRows(slug, points, metric, unit, freq, US, opts, id));
    }
    inserted += await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
    console.log(`  ${slug}: ${rows.length} rows`);
  }

  if (ONLY.has("states")) {
    for (const slug of new Set(STATE_SERIES.map((s) => s[0]))) await registerDataset(pg, slug);
    const rows = [];
    const missing = [];
    for (const abbr of STATES) {
      const geo = { geo_level: "state", geoid: STATE_FIPS[abbr], geo_name: STATE_NAMES[abbr] };
      for (const [slug, idOf, metric, unit, freq, opts] of STATE_SERIES) {
        const points = await fetchSeries(idOf(abbr), freq, opts);
        if (!points?.length) {
          if (!opts.optional) throw new Error(`FRED ${idOf(abbr)}: no observations`);
          missing.push(idOf(abbr));
          continue;
        }
        rows.push(...toRows(slug, points, metric, unit, freq, geo, opts, idOf(abbr)));
      }
      console.log(`  ${abbr}`);
    }
    if (missing.length) console.log(`  no series (state has no minimum wage law): ${missing.join(", ")}`);
    inserted += await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
    console.log(`  states: ${rows.length} rows`);
  }
  return { inserted };
});
