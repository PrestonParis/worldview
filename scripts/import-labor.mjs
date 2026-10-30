// Imports union membership and minimum wages into `area_stats`:
//
//   unionstats         Hirsch–Macpherson Union Membership and Coverage
//                      Database (CPS): union members and workers covered by
//                      a union contract, count and share of wage and salary
//                      workers — nation since 1980 (by sector and worker group
//                      as geo_level 'group': public, private, police,
//                      manufacturing, Black men, college graduates, …) and
//                      every state since 1983 (total, public, private,
//                      private manufacturing, private construction).
//   dol-minimum-wage   state minimum wage rates since 1968 from the
//                      Department of Labor's history table, the federal
//                      (FLSA) rate as the nation, and the effective minimum
//                      (the higher of the state and federal rates).
//
// The unionstats files are Stata .dta (read with scripts/lib/stata.mjs).
//
// Sources: https://www.unionstats.com/ and
// https://www.dol.gov/agencies/whd/state/minimum-wage/history
//
// Usage:
//   node scripts/import-labor.mjs [--only=unions,minwage]
//   ENV_FILE=.env.cloud node scripts/import-labor.mjs

import { arg, fetchRetry, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { decodeEntities } from "./lib/html.mjs";
import { readDta } from "./lib/stata.mjs";

const ONLY = new Set(arg("only", "unions,minwage").split(","));
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const CONFLICT = ["source", "metric", "geo_level", "geoid", "period"];
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));
const row = (source, level, geoid, name, metric, year, value, unit) => ({
  source, metric, geo_level: level, geoid, geo_name: name, period: String(year), period_start: `${year}-01-01`, value, unit, metadata: {},
});

const UNION_BASE = "https://www.unionstats.com";
// National files: file stem → [group id, name] (members_all is the nation).
const UNION_GROUPS = {
  all: ["US", "United States"], public: ["sector_public", "Public sector"], priv: ["sector_private", "Private sector"],
  fed: ["sector_federal", "Federal government"], localg: ["sector_local_government", "Local government"],
  postal: ["sector_postal", "Postal Service"], police: ["occupation_police", "Police"], priv_manuf: ["industry_private_manufacturing", "Private manufacturing"],
  priv_const: ["industry_private_construction", "Private construction"], trans_comm_util: ["industry_transport_utilities", "Transportation, communications, and utilities"],
  whole_ret: ["industry_wholesale_retail", "Wholesale and retail trade"], serv: ["industry_services", "Services"], fire: ["industry_finance", "Finance, insurance, and real estate"],
  male: ["sex_male", "Men"], fem: ["sex_female", "Women"], wh_male: ["white_men", "White men"], wh_fem: ["white_women", "White women"],
  bl_male: ["black_men", "Black men"], bl_fem: ["black_women", "Black women"], hisp_male: ["hispanic_men", "Hispanic men"], hisp_fem: ["hispanic_women", "Hispanic women"],
  coll_plus: ["college_graduates", "College graduates"], less_th_coll: ["no_college_degree", "No college degree"],
};
const STATE_SECTORS = { Total: "", Public: "_public", Private: "_private", "Priv. Manufacturing": "_private_manufacturing", "Priv. Construction": "_private_construction" };

async function dta(path) {
  return readDta(Buffer.from(await (await fetchRetry(`${UNION_BASE}/${path}`)).arrayBuffer()), ["year", "state2", "sector", "empl", "member", "covered", "pctmem", "pctcov"]);
}
const pct = (v) => (v === null ? null : Math.round(v * 1e4) / 100);
const thousands = (v) => (v === null ? null : Math.round(v * 1000));

async function importUnions(pg) {
  const source = "unionstats";
  await registerDataset(pg, source);
  const out = [];
  const add = (level, geoid, name, suffix, d, i) => {
    const y = d.columns.year[i];
    for (const [metric, v, unit] of [
      [`union_membership_rate${suffix}`, pct(d.columns.pctmem[i]), "percent"],
      [`union_coverage_rate${suffix}`, pct(d.columns.pctcov[i]), "percent"],
      [`union_members${suffix}`, thousands(d.columns.member[i]), "people"],
      [`union_covered${suffix}`, thousands(d.columns.covered[i]), "people"],
      [`wage_salary_employment${suffix}`, thousands(d.columns.empl[i]), "people"],
    ]) if (v !== null) out.push(row(source, level, geoid, name, metric, y, v, unit));
  };
  for (const [stem, [geoid, name]] of Object.entries(UNION_GROUPS)) {
    const d = await dta(`members/dta/members_${stem}.dta`);
    for (let i = 0; i < d.n; i++) add(geoid === "US" ? "nation" : "group", geoid, name, "", d, i);
  }
  const s = await dta("state/dta/state_1983_2025.dta");
  for (let i = 0; i < s.n; i++) {
    const fips = STATE_FIPS[s.columns.state2[i]];
    const suffix = STATE_SECTORS[s.columns.sector[i]];
    if (fips && suffix !== undefined) add("state", fips, FIPS_TO_NAME[fips], suffix, s, i);
  }
  if (out.filter((r) => r.geo_level === "state" && r.metric === "union_membership_rate").length < 51 * 40) throw new Error("unionstats: state file shorter than expected — layout changed?");
  console.log(`  unionstats: ${out.length} rows`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

// "2.00-7.25(g)" → 7.25; "1.25/day(b)" → null (not an hourly rate); "..." → null
const hourly = (cell) => {
  if (/\/(day|wk|week)/i.test(cell)) return null;
  const nums = [...cell.matchAll(/\d+\.\d+/g)].map((m) => Number(m[0]));
  return nums.length ? Math.max(...nums) : null;
};

async function importMinimumWage(pg) {
  const source = "dol-minimum-wage";
  await registerDataset(pg, source);
  const html = await (await fetchRetry("https://www.dol.gov/agencies/whd/state/minimum-wage/history")).text();
  const cells = (tr) => [...tr.matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) => decodeEntities(c[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
  const state = new Map(); // `${fips}|${year}` → rate
  const federal = new Map();
  for (const [table] of html.matchAll(/<table[\s\S]*?<\/table>/g)) {
    const rows = [...table.matchAll(/<tr[\s\S]*?<\/tr>/g)].map((m) => cells(m[0]));
    const years = rows[0].slice(1).map((h) => h.match(/\d{4}/)?.[0]);
    for (const r of rows.slice(1)) {
      const fips = STATE_FIPS[STATE_NAME_TO_ABBR[r[0]]];
      r.slice(1).forEach((c, i) => {
        const y = years[i];
        const v = hourly(c);
        if (!y || v === null) return;
        if (/^Federal/.test(r[0])) federal.set(y, v);
        else if (fips) state.set(`${fips}|${y}`, v);
      });
    }
  }
  if (federal.size < 30) throw new Error(`DOL history: only ${federal.size} federal years — layout changed?`);
  const out = [];
  for (const [y, v] of federal) out.push(row(source, "nation", "US", "United States", "federal_minimum_wage", y, v, "usd"));
  const fipsList = Object.keys(FIPS_TO_NAME).filter((f) => f && Number(f) <= 56);
  for (const y of federal.keys()) {
    for (const fips of fipsList) {
      const v = state.get(`${fips}|${y}`);
      if (v !== undefined) out.push(row(source, "state", fips, FIPS_TO_NAME[fips], "state_minimum_wage", y, v, "usd"));
      out.push(row(source, "state", fips, FIPS_TO_NAME[fips], "effective_minimum_wage", y, Math.max(v ?? 0, federal.get(y)), "usd"));
    }
  }
  console.log(`  dol-minimum-wage: ${out.length} rows, ${[...federal.keys()].sort()[0]}–${[...federal.keys()].sort().at(-1)}`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

await runImport("labor", async (pg) => {
  let inserted = 0;
  if (ONLY.has("unions")) inserted += await importUnions(pg);
  if (ONLY.has("minwage")) inserted += await importMinimumWage(pg);
  return { inserted };
});
