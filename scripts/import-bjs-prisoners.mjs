// Imports BJS "Prisoners in <year> — Statistical Tables" into `area_stats`
// (source bjs-prisoners):
//
//   imprisonment_rate_<group>   nation, per 100,000 residents of all ages,
//                               sentenced prisoners (Table 5; ten years):
//                               total, federal, state, male, female,
//                               white_nh, black_nh, hispanic, aian_nh, asian_nh
//   prisoners_<group>           every state + federal (geo_level
//                               'jurisdiction', geoid 'federal'), by race or
//                               Hispanic origin (Appendix table 1)
//   prisoners_citizen, prisoners_noncitizen, noncitizen_share
//                               in state or federal prisons, by jurisdiction
//                               (Table 22)
//
// Tables are found by title, so renumbering between editions is fine.
//
// Source: https://bjs.ojp.gov/library/publications/prisoners-2023-statistical-tables
// (p23st.zip of CSVs) — free, no key.
//
// Usage:
//   node scripts/import-bjs-prisoners.mjs [--report=p23st]
//   ENV_FILE=.env.cloud node scripts/import-bjs-prisoners.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "bjs-prisoners";
const REPORT = arg("report", "p23st");
const YEAR = 2000 + Number(REPORT.match(/\d+/)[0]);
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };

// One CSV line -> cells (quoted fields may hold commas).
const cells = (line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] ?? m[1]).trim()).slice(0, -1);
const num = (s) => (/^-?[\d,.]+$/.test(s ?? "") ? Number(s.replace(/,/g, "")) : null);
// "Colorado/e,i" -> Colorado; "Federal/b,c,d" -> Federal
const place = (s) => s.replace(/\/[a-z](,[a-z])*$/i, "").trim();
const FIPS = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [name, STATE_FIPS[abbr]]));

function geoOf(name) {
  if (name === "Federal") return { geo_level: "jurisdiction", geoid: "federal", geo_name: "Federal prisons" };
  if (FIPS[name]) return { geo_level: "state", geoid: FIPS[name], geo_name: name };
  return null;
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bjs-"));
  const zip = path.join(dir, `${REPORT}.zip`);
  fs.writeFileSync(zip, Buffer.from(await (await fetchRetry(`https://bjs.ojp.gov/document/${REPORT}.zip`, BROWSER)).arrayBuffer()));
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  const tables = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".csv"))
    .map((f) => new TextDecoder("latin1").decode(fs.readFileSync(path.join(dir, f))).split(/\r?\n/));
  const find = (re) => {
    const t = tables.find((lines) => lines.slice(0, 4).some((l) => re.test(l)));
    if (!t) throw new Error(`${REPORT}: no table matching ${re}`);
    return t.map(cells);
  };
  const out = [];
  const row = (geo, metric, period, value, unit) => {
    if (value === null) return;
    out.push({ source: SOURCE, metric, ...geo, period: String(period), period_start: `${period}-12-31`, value, unit, metadata: { report: REPORT } });
  };
  const NATION = { geo_level: "nation", geoid: "US", geo_name: "United States" };

  // Table 5: Year, '', Total, '', Federal, '', State, '', '', Male, '', Female, '', White, '', Black, '', Hispanic, '', AIAN, '', Asian
  const RATE_COLS = { 2: "total", 4: "federal", 6: "state", 9: "male", 11: "female", 13: "white_nh", 15: "black_nh", 17: "hispanic", 19: "aian_nh", 21: "asian_nh" };
  for (const r of find(/Imprisonment rates of U\.S\. residents of all ages/)) {
    if (!/^\d{4}$/.test(r[0])) continue;
    for (const [i, g] of Object.entries(RATE_COLS)) row(NATION, `imprisonment_rate_${g}`, r[0], num(r[i]), "per_100k");
  }

  // Appendix table 1: Jurisdiction, '', Total, White, Black, Hispanic, AIAN, Asian, NHPI, Two+, Other, Unknown, Did not report
  const RACE_COLS = { 2: "total", 3: "white_nh", 4: "black_nh", 5: "hispanic", 6: "aian_nh", 7: "asian_nh", 8: "nhpi_nh", 9: "multiracial_nh", 10: "other", 11: "race_unknown", 12: "race_not_reported" };
  for (const r of find(/^"?Appendix table 1\. Prisoners under the jurisdiction/)) {
    const geo = geoOf(place(r[0] || r[1] || ""));
    if (!geo) continue;
    for (const [i, g] of Object.entries(RACE_COLS)) row(geo, `prisoners_${g}`, YEAR, num(r[i]), "people");
  }

  // Table 22: Jurisdiction, '', Citizen total, male, female, '', Noncitizen total, male, female, percent
  for (const r of find(/Citizenship status of prisoners/)) {
    const geo = geoOf(place(r[0] || r[1] || ""));
    if (!geo) continue;
    row(geo, "prisoners_citizen", YEAR, num(r[2]), "people");
    row(geo, "prisoners_noncitizen", YEAR, num(r[6]), "people");
    row(geo, "noncitizen_share", YEAR, num(r[9]), "percent");
  }
  fs.rmSync(dir, { recursive: true, force: true });

  for (const want of ["imprisonment_rate_black_nh", "prisoners_hispanic", "noncitizen_share"]) {
    if (!out.some((r) => r.metric === want)) throw new Error(`${REPORT}: no ${want} rows — layout changed?`);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${REPORT}: ${out.length} rows`);
  return { inserted, cursor: REPORT };
});
