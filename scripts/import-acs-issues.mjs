// Imports health insurance and housing cost measures from the ACS 1-year
// estimates into `area_stats` for the nation and every state, 2008 onward
// (health insurance from 2009, its first year in the API; no 2020 release):
//
//   census-acs1-health
//     uninsured_rate, uninsured_children_rate   (B27010)
//     medicaid_share   Medicaid/means-tested public coverage (C27007)
//     medicare_share   (C27006)
//
//   census-acs1-housing
//     median_gross_rent (B25064), median_home_value (B25077)
//     rent_burdened_share, severely_rent_burdened_share   30%+ / 50%+ of
//                      income on gross rent (B25070)
//     median_rent_share_of_income (B25071), owner_occupied_share (B25003)
//
// Cell positions are stable across years; a few labels are checked each year
// so a renumbering fails loudly instead of loading wrong cells.
//
// Usage:
//   node scripts/import-acs-issues.mjs [--years=2008-2024] [--only=health,housing]
//   ENV_FILE=.env.cloud node scripts/import-acs-issues.mjs

import { arg, checkCensusKey, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const [FROM, TO] = arg("years", "2008-2024").split("-").map(Number);
const YEARS = Array.from({ length: (TO ?? FROM) - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const ONLY = new Set(arg("only", "health,housing").split(","));
const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];

const range = (table, from, to) => Array.from({ length: to - from + 1 }, (_, i) => `${table}_${String(from + i).padStart(3, "0")}E`);
// Each sex has under-19 (under-18 before 2017), 19–64, and 65+ cells; the
// "with coverage" cells are 004, 007, 010 (male) and 014, 017, 020 (female).
const WITH_CELLS = (table) => ["004", "007", "010", "014", "017", "020"].map((c) => `${table}_${c}E`);
const UNINSURED = ["B27010_017E", "B27010_033E", "B27010_050E", "B27010_066E"];

const VARS = {
  health: ["B27010_001E", "B27010_002E", ...UNINSURED, "C27007_001E", ...WITH_CELLS("C27007"), "C27006_001E", ...WITH_CELLS("C27006")],
  housing: ["B25064_001E", "B25077_001E", ...range("B25070", 1, 11), "B25071_001E", "B25003_001E", "B25003_002E"],
};

// First ACS 1-year release in the API with each topic's tables.
const FIRST_YEAR = { health: 2009, housing: 2008 };

const CHECKS = {
  health: { B27010_017E: "No health insurance", B27010_066E: "No health insurance", C27007_020E: "With Medicaid", C27006_020E: "With Medicare" },
  housing: { B25070_007E: "30.0 to 34.9", B25070_010E: "50.0 percent or more", B25070_011E: "Not computed", B25003_002E: "Owner" },
};

async function checkLabels(year, topics) {
  for (const topic of topics) {
    for (const [name, want] of Object.entries(CHECKS[topic])) {
      const v = await fetchJson(`https://api.census.gov/data/${year}/acs/acs1/variables/${name}.json`, {}, { label: `${name} ${year}` });
      if (!v.label?.includes(want)) throw new Error(`${year} ${name}: label "${v.label}" lacks "${want}" — variables renumbered?`);
    }
  }
}

async function fetchYear(year, vars, key) {
  const rows = [];
  for (const geo of ["us:1", "state:*"]) {
    const merged = new Map();
    for (let i = 0; i < vars.length; i += 48) {
      const url = `https://api.census.gov/data/${year}/acs/acs1?get=NAME,${vars.slice(i, i + 48).join(",")}&for=${geo}&key=${key}`;
      const [header, ...data] = await fetchJson(url, {}, { label: `ACS1 ${year} ${geo}` });
      for (const d of data) {
        const r = Object.fromEntries(header.map((h, j) => [h, d[j]]));
        const id = r.state ?? "US";
        merged.set(id, { ...merged.get(id), ...r });
      }
    }
    rows.push(...merged.values());
  }
  return rows.filter((r) => r.state !== "72");
}

const sum = (r, names) => names.reduce((t, n) => t + (num(r[n]) ?? 0), 0);
const share = (part, whole) => (whole ? Math.round((part / whole) * 1e4) / 100 : null);

function toRows(year, r, topics) {
  const geoid = r.state ?? "US";
  const geo = { geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: r.NAME };
  const out = [];
  const add = (source, metric, value, unit) => {
    if (value === null || value === undefined || !Number.isFinite(value) || value < 0) return;
    out.push({ source, metric, ...geo, period: String(year), period_start: `${year}-01-01`, value, unit, metadata: null });
  };
  const v = (n) => num(r[n]);

  if (topics.includes("health")) {
    const H = "census-acs1-health";
    add(H, "uninsured_rate", share(sum(r, UNINSURED), v("B27010_001E")), "percent");
    add(H, "uninsured_children_rate", share(v("B27010_017E"), v("B27010_002E")), "percent");
    add(H, "medicaid_share", share(sum(r, WITH_CELLS("C27007")), v("C27007_001E")), "percent");
    add(H, "medicare_share", share(sum(r, WITH_CELLS("C27006")), v("C27006_001E")), "percent");
  }
  if (topics.includes("housing")) {
    const S = "census-acs1-housing";
    add(S, "median_gross_rent", v("B25064_001E"), "usd");
    add(S, "median_home_value", v("B25077_001E"), "usd");
    const computed = (v("B25070_001E") ?? 0) - (v("B25070_011E") ?? 0);
    add(S, "rent_burdened_share", share(sum(r, range("B25070", 7, 10)), computed), "percent");
    add(S, "severely_rent_burdened_share", share(v("B25070_010E"), computed), "percent");
    add(S, "median_rent_share_of_income", v("B25071_001E"), "percent");
    add(S, "owner_occupied_share", share(v("B25003_002E"), v("B25003_001E")), "percent");
  }
  return out;
}

await runImport("acs-issues", async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  const topics = [...ONLY].filter((t) => VARS[t]);
  for (const t of topics) await registerDataset(pg, t === "health" ? "census-acs1-health" : "census-acs1-housing");
  let inserted = 0;
  for (const year of YEARS) {
    const active = topics.filter((t) => year >= FIRST_YEAR[t]);
    if (!active.length) continue;
    await checkLabels(year, active);
    const out = (await fetchYear(year, active.flatMap((t) => VARS[t]), key)).flatMap((r) => toRows(year, r, active));
    inserted += await upsertRows(pg, "area_stats", COLUMNS, out, KEY);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted };
});
