// Imports FBI Crime Data Explorer monthly offenses for the police
// departments of large U.S. cities into `area_stats`, plus each agency's
// annual staffing. source = 'fbi-cde-cities', geo_level = 'agency', geoid =
// the agency ORI, geo_name = the city ("Atlanta"). metadata.state is the
// state abbreviation, metadata.population the agency's population that
// month, metadata.reported whether the agency reported that month.
//
// The city list is every incorporated place over --min-pop residents in
// the latest ACS 1-year estimates (Census API); each is matched to its
// municipal police department through the CDE agency directory, with
// overrides for consolidated and metropolitan departments. Census-
// designated places without their own department are skipped.
//
// Usage:
//   node scripts/import-fbi-cities.mjs [--min-pop=100000] [--from=2015] [--offenses=V,P,HOM] [--states=GA]
//     [--concurrency=3] [--match-only]
//   ENV_FILE=.env.cloud node scripts/import-fbi-cities.mjs

import { STATE_FIPS, arg, fetchJson, flag, num, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const OFFENSES = {
  V: "violent_crime", P: "property_crime", HOM: "homicide", RPE: "rape", ROB: "robbery",
  ASS: "aggravated_assault", BUR: "burglary", LAR: "larceny", MVT: "motor_vehicle_theft",
};
const MIN_POP = Number(arg("min-pop", "100000"));
const FROM = Number(arg("from", "2015"));
const ONLY_STATES = arg("states", "").toUpperCase().split(",").filter(Boolean);
const ONLY_OFFENSES = arg("offenses", "").toUpperCase().split(",").filter(Boolean);
const MATCH_ONLY = flag("match-only");
// Cities fetched at once; each makes one request at a time, and the API
// allows about 10 a second.
const CONCURRENCY = Number(arg("concurrency", "3"));
const ACS_YEAR = arg("acs-year", "2024");
const now = new Date();
const TO = `${String(now.getMonth() + 1).padStart(2, "0")}-${now.getFullYear()}`;
const FIPS_TO_ABBR = Object.fromEntries(Object.entries(STATE_FIPS).map(([a, f]) => [f, a]));
const CDE = "https://api.usa.gov/crime/fbi/cde";

// Census place name (as cleaned below) + state -> agency name in the CDE
// directory, for departments not named "<City> Police Department".
const OVERRIDES = {
  "New York|NY": "New York City Police Department",
  "Las Vegas|NV": "Las Vegas Metropolitan Police Department",
  "Nashville-Davidson|TN": "Metropolitan Nashville Police Department",
  "Louisville/Jefferson County|KY": "Louisville Metro Police Department",
  "Charlotte|NC": "Charlotte-Mecklenburg Police Department",
  "Lexington-Fayette|KY": "Lexington Police Department",
  "Urban Honolulu|HI": "Honolulu Police Department",
  "Jacksonville|FL": "Jacksonville Sheriff's Office",
  "Augusta-Richmond County|GA": "Augusta-Richmond County Sheriff's Office",
  "Athens-Clarke County|GA": "Athens-Clarke County Police Department",
  "Macon-Bibb County|GA": "Bibb County Sheriff's Office",
  "West Valley City|UT": "West Valley Police Department",
  "Columbus|GA": "Columbus Police Department",
  "Arlington|VA": "Arlington County Police Department",
  "Anchorage|AK": "Anchorage Police Department",
  "Boise City|ID": "Boise Police Department",
  "San Buenaventura (Ventura)|CA": "Ventura Police Department",
};

// How consolidated places are usually named.
const DISPLAY = {
  "Nashville-Davidson": "Nashville", "Louisville/Jefferson County": "Louisville", "Urban Honolulu": "Honolulu",
  "Lexington-Fayette": "Lexington", "Augusta-Richmond County": "Augusta", "Athens-Clarke County": "Athens",
  "Macon-Bibb County": "Macon", "Boise City": "Boise", "San Buenaventura (Ventura)": "Ventura",
};

// "Nashville-Davidson metropolitan government (balance), Tennessee" -> "Nashville-Davidson"
const cleanPlace = (name) =>
  name
    .replace(/,.*$/, "")
    .replace(/ \(balance\)$/, "")
    .replace(/ (city|town|village|municipality|borough|CDP|urban county|metropolitan government|metro government|unified government|consolidated government)$/i, "")
    .trim();
const norm = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

async function cde(path, key, label) {
  return fetchJson(`${CDE}/${path}${path.includes("?") ? "&" : "?"}API_KEY=${key}`, {}, { label });
}

async function largeCities() {
  const key = process.env.CENSUS_API_KEY;
  const rows = await fetchJson(
    `https://api.census.gov/data/${ACS_YEAR}/acs/acs1?get=NAME,B01003_001E&for=place:*${key ? `&key=${key}` : ""}`,
    {},
    { label: "census places" },
  );
  return rows
    .slice(1)
    .map(([name, pop, st]) => ({ raw: name, name: cleanPlace(name), cdp: / CDP,/.test(name), pop: Number(pop), state: FIPS_TO_ABBR[st] }))
    .filter((c) => c.state && c.pop >= MIN_POP && c.state !== "PR" && (!ONLY_STATES.length || ONLY_STATES.includes(c.state)))
    .sort((a, b) => b.pop - a.pop);
}

function matchAgency(city, agencies) {
  const override = OVERRIDES[`${city.name}|${city.state}`];
  if (override) return agencies.find((a) => norm(a.agency_name) === norm(override)) ?? null;
  if (city.cdp) return null; // no municipal department
  const local = agencies.filter((a) => a.agency_type_name === "City");
  const want = norm(`${city.name} Police Department`);
  return (
    local.find((a) => norm(a.agency_name) === want) ??
    local.find((a) => norm(a.agency_name).startsWith(norm(city.name)) && /police/i.test(a.agency_name)) ??
    null
  );
}

function monthRows(series, metric, unit, base, { through, population, participated }) {
  return Object.entries(series ?? {}).flatMap(([mmYYYY, value]) => {
    const [mm, yyyy] = mmYYYY.split("-");
    const period = `${yyyy}-${mm}`;
    if (period > through || num(value) === null) return [];
    return [{
      ...base, metric, period, period_start: `${period}-01`, value: num(value), unit,
      metadata: { ...base.metadata, population: num(population?.[mmYYYY]), reported: (num(participated?.[mmYYYY]) ?? 0) > 0 },
    }];
  });
}

await runImport("fbi-cde-cities", async (pg) => {
  await registerDataset(pg, "fbi-cde-cities");
  const key = process.env.FBI_API_KEY || process.env.FEC_API_KEY || process.env.CONGRESS_GOV_API_KEY || "DEMO_KEY";
  const delay = key === "DEMO_KEY" ? 120_000 : 150;

  const cities = await largeCities();
  const directory = {};
  for (const st of [...new Set(cities.map((c) => c.state))]) {
    directory[st] = Object.values(await cde(`agency/byStateAbbr/${st}`, key, `agencies ${st}`)).flat();
    await sleep(delay);
  }
  const matched = [];
  for (const c of cities) {
    const a = matchAgency(c, directory[c.state]);
    if (a) matched.push({ ...c, ori: a.ori, agency: a.agency_name });
    else console.log(`  no department matched: ${c.raw} (${c.pop.toLocaleString()})`);
  }
  console.log(`${matched.length} of ${cities.length} places over ${MIN_POP.toLocaleString()} matched to a department`);
  if (MATCH_ONLY) {
    for (const m of matched) console.log(`  ${m.state} ${m.name} -> ${m.ori} ${m.agency}`);
    return { skipped: cities.length - matched.length };
  }

  const offenses = Object.keys(OFFENSES).filter((o) => !ONLY_OFFENSES.length || ONLY_OFFENSES.includes(o));
  let total = 0;
  const importCity = async (c) => {
    const base = { source: "fbi-cde-cities", geo_level: "agency", geoid: c.ori, geo_name: DISPLAY[c.name] ?? c.name, metadata: { state: c.state } };
    const rows = [];
    for (const off of offenses) {
      const d = await cde(`summarized/agency/${c.ori}/${off}?from=01-${FROM}&to=${TO}`, key, `fbi ${c.ori} ${off}`);
      await sleep(delay);
      const label = Object.keys(d.offenses?.actuals ?? {}).find((k) => k.endsWith(" Offenses"))?.replace(/ Offenses$/, "");
      if (!label) continue;
      const [mm, yyyy] = String(d.cde_properties?.max_data_date?.UCR ?? "").split("/");
      const opts = {
        through: yyyy ? `${yyyy}-${mm}` : "9999-12",
        population: d.populations?.population?.[label],
        participated: d.populations?.participated_population?.[label],
      };
      const metric = OFFENSES[off];
      rows.push(
        ...monthRows(d.offenses.actuals[`${label} Offenses`], `${metric}_count`, "offenses", base, opts),
        ...monthRows(d.offenses.rates?.[`${label} Offenses`], `${metric}_rate`, "per_100k", base, opts),
        ...monthRows(d.offenses.actuals[`${label} Clearances`], `${metric}_clearances`, "clearances", base, opts),
      );
    }
    // Staffing: annual, per 1,000 residents, plus sworn officers.
    const pe = await cde(`pe/agency/${c.ori}?from=${FROM}&to=${now.getFullYear()}`, key, `pe ${c.ori}`);
    await sleep(delay);
    const per1000 = pe.rates?.["Law Enforcement Employees per 1,000 People"] ?? {};
    for (const [year, v] of Object.entries(per1000)) {
      const officers = (num(pe.actuals?.["Male Officers"]?.[year]) ?? 0) + (num(pe.actuals?.["Female Officers"]?.[year]) ?? 0);
      const yearBase = { ...base, period: year, period_start: `${year}-01-01` };
      if (num(v) !== null) rows.push({ ...yearBase, metric: "employees_per_1000", value: num(v), unit: "per_1000" });
      if (officers) rows.push({ ...yearBase, metric: "officers", value: officers, unit: "people" });
    }
    if (rows.length) {
      total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows.map((r) => ({ metadata: null, ...r })), [
        "source", "metric", "geo_level", "geoid", "period",
      ]);
    }
    console.log(`  ${c.state} ${c.name} (${c.ori}) done — ${rows.length} rows`);
  };
  const queue = [...matched];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      for (let c = queue.shift(); c; c = queue.shift()) await importCity(c);
    }),
  );
  return { inserted: total, skipped: cities.length - matched.length };
});
