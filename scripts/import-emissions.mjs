// Imports greenhouse gas emissions into `area_stats`:
//
//   epa-ghg   EPA Inventory of U.S. Greenhouse Gas Emissions and Sinks, state
//             breakdown (1990–): gross emissions, net emissions after land
//             use and forests, by economic sector and by gas, for the nation
//             and every state, in million metric tons of CO₂ equivalent. The
//             nation also includes emissions EPA does not assign to a state
//             and the territories.
//   owid-co2  Our World in Data's CO₂ and greenhouse gas dataset (Global
//             Carbon Project, Jones et al.) for every country and the world:
//             territorial and consumption-based CO₂, per person, per GDP,
//             cumulative, share of the world, CO₂ by fuel, methane, nitrous
//             oxide, and all greenhouse gases (geo_level 'country', ISO3;
//             OWID_WRL for the world)
//
// Sources: https://www.epa.gov/ghgemissions/state-ghg-emissions-and-removals
// (--epa-url= for a newer release) and https://github.com/owid/co2-data
//
// Usage:
//   node scripts/import-emissions.mjs [--only=epa,owid] [--epa-url=...]
//   ENV_FILE=.env.cloud node scripts/import-emissions.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, num, parseCsv, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ONLY = new Set(arg("only", "epa,owid").split(","));
const EPA_URL = arg("epa-url", "https://www.epa.gov/system/files/other-files/2024-09/allstateghgdata90-22_v082924.zip");
const OWID_URL = "https://raw.githubusercontent.com/owid/co2-data/master/owid-co2-data.csv";
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const CONFLICT = ["source", "metric", "geo_level", "geoid", "period"];
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

const SECTORS = {
  Agriculture: "agriculture", Industry: "industry", Commercial: "commercial", "Electric Power Industry": "electric_power",
  Residential: "residential", Transportation: "transportation", "U.S. Territories": "territories",
};
const GASES = { CO2: "co2", CH4: "methane", N2O: "nitrous_oxide", HFC: "fluorinated", PFC: "fluorinated", SF6: "fluorinated", NF3: "fluorinated" };

async function importEpa(pg) {
  const source = "epa-ghg";
  await registerDataset(pg, source);
  const dir = mkdtempSync(join(tmpdir(), "epa-ghg-"));
  writeFileSync(join(dir, "s.zip"), Buffer.from(await (await fetchRetry(EPA_URL, { timeoutMs: 300_000 })).arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", "-j", join(dir, "s.zip"), "-d", dir]);
  const book = readXlsx(readFileSync(join(dir, readdirSync(dir).find((f) => /\.xlsx$/i.test(f)))));
  const rows = book["Data by Economic Sectors"];
  if (!rows) throw new Error("EPA workbook has no 'Data by Economic Sectors' sheet");
  const h = rows[0];
  const iSector = h.indexOf("econ_sector");
  const iGas = h.indexOf("ghg_category");
  const iGeo = h.indexOf("geo_ref");
  const years = h.map((c, i) => [i, /^Y(\d{4})$/.exec(c)?.[1]]).filter(([, y]) => y);
  const sums = new Map(); // `${geoid}|${year}|${metric}`
  const bump = (geoid, year, metric, v) => sums.set(`${geoid}|${year}|${metric}`, (sums.get(`${geoid}|${year}|${metric}`) ?? 0) + v);
  for (const r of rows.slice(1)) {
    const fips = STATE_FIPS[r[iGeo]];
    const state = fips && Number(fips) <= 56 ? fips : null;
    const lulucf = r[iSector] === "LULUCF Sector Net Total";
    for (const [i, year] of years) {
      const v = typeof r[i] === "number" ? r[i] : null;
      if (v === null) continue;
      const metrics = ["ghg_net"];
      if (lulucf) metrics.push("ghg_lulucf");
      else {
        metrics.push("ghg_gross");
        if (SECTORS[r[iSector]]) metrics.push(`ghg_${SECTORS[r[iSector]]}`);
        if (GASES[r[iGas]]) metrics.push(`ghg_gas_${GASES[r[iGas]]}`);
      }
      for (const m of metrics) {
        bump("US", year, m, v);
        if (state) bump(state, year, m, v);
      }
    }
  }
  const out = [...sums].map(([k, v]) => {
    const [geoid, year, metric] = k.split("|");
    return {
      source, metric, geo_level: geoid === "US" ? "nation" : "state", geoid, geo_name: geoid === "US" ? "United States" : FIPS_TO_NAME[geoid],
      period: year, period_start: `${year}-01-01`, value: Math.round(v * 1000) / 1000, unit: "mmt_co2e", metadata: {},
    };
  }).filter((r) => r.metric !== "ghg_territories" || r.geoid === "US");
  const us = out.find((r) => r.geoid === "US" && r.metric === "ghg_gross" && r.period === "2022")?.value;
  if (!us || us < 5000 || us > 8000) throw new Error(`EPA: implausible 2022 U.S. gross emissions ${us} — units or layout changed?`);
  console.log(`  epa-ghg: ${out.length} rows (U.S. 2022 gross ${Math.round(us)} Mt CO2e)`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

// OWID column → [metric, unit, scale]
const OWID = {
  co2: ["co2", "mmt_co2"], co2_per_capita: ["co2_per_capita", "t_co2"], consumption_co2: ["consumption_co2", "mmt_co2"],
  consumption_co2_per_capita: ["consumption_co2_per_capita", "t_co2"], co2_per_gdp: ["co2_per_gdp", "kg_co2_per_usd"],
  cumulative_co2: ["cumulative_co2", "mmt_co2"], share_global_co2: ["share_global_co2", "percent"],
  share_global_cumulative_co2: ["share_global_cumulative_co2", "percent"], coal_co2: ["coal_co2", "mmt_co2"],
  oil_co2: ["oil_co2", "mmt_co2"], gas_co2: ["gas_co2", "mmt_co2"], cement_co2: ["cement_co2", "mmt_co2"],
  land_use_change_co2: ["land_use_change_co2", "mmt_co2"], methane: ["methane", "mmt_co2e"], nitrous_oxide: ["nitrous_oxide", "mmt_co2e"],
  total_ghg: ["total_ghg", "mmt_co2e"], ghg_per_capita: ["ghg_per_capita", "t_co2e"], share_of_temperature_change_from_ghg: ["share_of_warming", "percent"],
};

async function importOwid(pg) {
  const source = "owid-co2";
  await registerDataset(pg, source);
  const rows = parseCsv(await (await fetchRetry(OWID_URL, { timeoutMs: 300_000 })).text());
  const out = [];
  for (const r of rows) {
    // Countries carry an ISO3 code; the world is the one aggregate kept.
    const geoid = /^[A-Z]{3}$/.test(r.iso_code) ? r.iso_code : r.country === "World" ? "OWID_WRL" : null;
    if (!geoid || Number(r.year) < 1850) continue;
    for (const [col, [metric, unit]] of Object.entries(OWID)) {
      const v = num(r[col]);
      if (v !== null) out.push({ source, metric, geo_level: "country", geoid, geo_name: r.country, period: r.year, period_start: `${r.year}-01-01`, value: v, unit, metadata: {} });
    }
  }
  if (!out.some((r) => r.geoid === "CHN" && r.metric === "co2")) throw new Error("OWID CO2: no China rows — columns changed?");
  console.log(`  owid-co2: ${out.length} rows, ${new Set(out.map((r) => r.geoid)).size} countries`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

await runImport("emissions", async (pg) => {
  let inserted = 0;
  if (ONLY.has("epa")) inserted += await importEpa(pg);
  if (ONLY.has("owid")) inserted += await importOwid(pg);
  return { inserted };
});
