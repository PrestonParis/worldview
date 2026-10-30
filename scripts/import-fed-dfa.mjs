// Imports the Federal Reserve's Distributional Financial Accounts into
// `area_stats` (source fed-dfa): household wealth by group, quarterly from
// 1989:Q3.
//
//   geo_level 'group', geoid <dimension>_<group>:
//     wealth_top_0_1, wealth_next_0_9 (99–99.9th), wealth_next_9, wealth_next_40, wealth_bottom_50
//     income_top_1, income_80_99, income_60_80, income_40_60, income_20_40, income_bottom_20
//     race_white, race_black, race_hispanic, race_other
//     generation_silent, generation_boomer, generation_gen_x, generation_millennial
//     age_under_40, age_40_54, age_55_69, age_70_plus
//     education_college, education_some_college, education_high_school, education_no_high_school
//
//   metrics: net_worth, assets, real_estate, corporate_equities, pension_dc,
//   pension_db, private_business, liabilities, home_mortgages, consumer_credit,
//   … in millions of dollars; the same with _share as percent of the U.S.
//   total; households; net_worth_per_household (dollars); wealth_cutoff
//   (minimum net worth to be in the group, wealth dimension only).
//
// Source: https://www.federalreserve.gov/releases/z1/dataviz/dfa/ (dfa.zip).
//
// Usage:
//   node scripts/import-fed-dfa.mjs
//   ENV_FILE=.env.cloud node scripts/import-fed-dfa.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fetchRetry, num, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "fed-dfa";
const URL = "https://www.federalreserve.gov/releases/z1/dataviz/download/zips/dfa.zip";

const DIMENSIONS = {
  networth: ["wealth", { TopPt1: "top_0_1", RemainingTop1: "next_0_9", Next9: "next_9", Next40: "next_40", Bottom50: "bottom_50" }],
  income: ["income", { pct99to100: "top_1", pct80to99: "80_99", pct60to80: "60_80", pct40to60: "40_60", pct20to40: "20_40", pct00to20: "bottom_20" }],
  race: ["race", { White: "white", Black: "black", Hispanic: "hispanic", Other: "other" }],
  generation: ["generation", { Silent: "silent", BabyBoom: "boomer", GenX: "gen_x", Millennial: "millennial" }],
  age: ["age", { ageunder40: "under_40", age40to54: "40_54", age55to69: "55_69", age70plus: "70_plus" }],
  education: ["education", { College: "college", SomeCollege: "some_college", HS: "high_school", NoHS: "no_high_school" }],
};
const NAMES = {
  wealth_top_0_1: "Top 0.1% by wealth", wealth_next_0_9: "99th–99.9th percentile by wealth", wealth_next_9: "90th–99th percentile by wealth",
  wealth_next_40: "50th–90th percentile by wealth", wealth_bottom_50: "Bottom 50% by wealth",
  income_top_1: "Top 1% by income", income_80_99: "80th–99th percentile by income", income_60_80: "60th–80th percentile by income",
  income_40_60: "40th–60th percentile by income", income_20_40: "20th–40th percentile by income", income_bottom_20: "Bottom 20% by income",
  race_white: "White", race_black: "Black", race_hispanic: "Hispanic", race_other: "Other races",
  generation_silent: "Silent Generation and earlier", generation_boomer: "Baby Boomers", generation_gen_x: "Generation X", generation_millennial: "Millennials and later",
  age_under_40: "Under 40", age_40_54: "Ages 40–54", age_55_69: "Ages 55–69", age_70_plus: "Ages 70+",
  education_college: "College degree", education_some_college: "Some college", education_high_school: "High school diploma", education_no_high_school: "No high school diploma",
};
// Summary-file column → metric
const COLUMNS_MAP = {
  "Net worth": "net_worth", Assets: "assets", "Real estate": "real_estate", "Consumer durables": "consumer_durables",
  "Corporate equities and mutual fund shares": "corporate_equities", "DB pension entitlements": "pension_db",
  "DC pension entitlements": "pension_dc", "Unincorporated businesses": "private_business", "Other assets": "other_assets",
  Liabilities: "liabilities", "Home mortgages": "home_mortgages", "Consumer credit": "consumer_credit", "Other liabilities": "other_liabilities",
};

const period = (d) => d.replace(":", "-"); // 1989:Q3 → 1989-Q3
const periodStart = (d) => {
  const [y, q] = d.split(":Q");
  return `${y}-${String((Number(q) - 1) * 3 + 1).padStart(2, "0")}-01`;
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const dir = mkdtempSync(join(tmpdir(), "dfa-"));
  writeFileSync(join(dir, "dfa.zip"), Buffer.from(await (await fetchRetry(URL)).arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", join(dir, "dfa.zip"), "-d", dir]);
  const csv = (name) => parseCsv(readFileSync(join(dir, name), "utf8"));

  const out = [];
  let latest = null;
  const add = (geoid, metric, date, value, unit) => {
    if (value === null) return;
    out.push({
      source: SOURCE, metric, geo_level: "group", geoid, geo_name: NAMES[geoid], period: period(date),
      period_start: periodStart(date), value, unit, metadata: {},
    });
  };
  for (const [file, [dim, cats]] of Object.entries(DIMENSIONS)) {
    const id = (cat) => `${dim}_${cats[cat]}`;
    for (const r of csv(`dfa-${file}-levels.csv`)) {
      if (!cats[r.Category]) throw new Error(`DFA ${file}: unknown category ${r.Category}`);
      for (const [col, metric] of Object.entries(COLUMNS_MAP)) add(id(r.Category), metric, r.Date, num(r[col]), "usd_millions");
      if (!latest || r.Date > latest) latest = r.Date;
    }
    for (const r of csv(`dfa-${file}-shares.csv`)) {
      for (const [col, metric] of Object.entries(COLUMNS_MAP)) add(id(r.Category), `${metric}_share`, r.Date, num(r[col]), "percent");
    }
    for (const r of csv(`dfa-${file}-levels-detail.csv`)) {
      const households = num(r["Household count"]);
      const worth = num(r["Net worth"]);
      add(id(r.Category), "households", r.Date, households, "households");
      if (households && worth !== null) add(id(r.Category), "net_worth_per_household", r.Date, Math.round((worth * 1e6) / households), "usd");
      if (dim === "wealth") add(id(r.Category), "wealth_cutoff", r.Date, num(r["Minimum Wealth Cutoff"]), "usd");
    }
  }
  if (!out.some((r) => r.geoid === "wealth_top_0_1" && r.metric === "net_worth_share")) throw new Error("DFA: no top 0.1% wealth share — layout changed?");
  console.log(`  ${out.length} rows, 1989-Q3–${period(latest)}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: period(latest) };
});
