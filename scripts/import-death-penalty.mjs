// Imports the death penalty into `area_stats`:
//
//   dpic-executions   every execution since 1976 from the Death Penalty
//                     Information Center's execution database, counted by year
//                     for the nation, each state, and each county where the
//                     crime was prosecuted (counties: total only) — by race and
//                     sex of the person executed, method, whether any victim
//                     was White, juveniles, foreign nationals, volunteers,
//                     veterans, and federal executions. The current year is
//                     partial (metadata.through).
//   dpic-status       whether each state has the death penalty, the year it
//                     was abolished, and the year a governor's hold on
//                     executions began (as of the import; DPIC state page)
//   bjs-capital-punishment  BJS Capital Punishment statistical tables: death
//                     row population since 1953 (by race since 1968),
//                     admissions and removals since 1973, executions since
//                     1930, and death row by state and race at year end
//
// Sources: https://deathpenaltyinfo.org/facts-and-research/data/executions,
// https://deathpenaltyinfo.org/state-and-federal-info/state-by-state,
// https://bjs.ojp.gov/library/publications/capital-punishment-2023-statistical-tables
//
// Usage:
//   node scripts/import-death-penalty.mjs [--only=executions,status,bjs] [--bjs-report=cp23st]
//   ENV_FILE=.env.cloud node scripts/import-death-penalty.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, num, parseCsv, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { decodeEntities } from "./lib/html.mjs";

const ONLY = new Set(arg("only", "executions,status,bjs").split(","));
const BJS_REPORT = arg("bjs-report", "cp23st");
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const CONFLICT = ["source", "metric", "geo_level", "geoid", "period"];
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
  timeoutMs: 300_000,
};
const geo = (fips) => (fips === "US" ? ["nation", "US", "United States"] : ["state", fips, FIPS_TO_NAME[fips]]);
const row = (source, [level, geoid, name], metric, year, value, unit, metadata = {}) => ({
  source, metric, geo_level: level, geoid, geo_name: name, period: String(year), period_start: `${year}-01-01`, value, unit, metadata,
});

const RACES = { White: "white", Black: "black", "Latino/a": "latino", "American Indian or Alaska Native": "native_american", Asian: "asian" };
const METHODS = { "Lethal Injection": "lethal_injection", Electrocution: "electrocution", Gas: "gas", "Firing Squad": "firing_squad", Hanging: "hanging" };

async function importExecutions(pg) {
  const source = "dpic-executions";
  await registerDataset(pg, source);
  const rows = parseCsv(await (await fetchRetry("https://deathpenaltyinfo.org/query/executions.csv", BROWSER)).text());
  const counts = new Map(); // `${level}|${geoid}|${name}|${year}|${metric}`
  let through = "";
  const bump = (g, year, metric) => {
    const k = [...g, year, metric].join("|");
    counts.set(k, (counts.get(k) ?? 0) + 1);
  };
  for (const r of rows) {
    const year = r["Execution Year"];
    if (!/^\d{4}$/.test(year)) continue;
    const [mm, dd, yyyy] = r["Execution Date"].split("/");
    const iso = `${yyyy}-${mm}-${dd}`;
    if (iso > through) through = iso;
    const metrics = ["executions", `executions_${RACES[r.Race] ?? "other_race"}`];
    if (r.Sex === "Female") metrics.push("executions_women");
    if (METHODS[r.Method]) metrics.push(`executions_${METHODS[r.Method]}`);
    if (r["Victim Races Includes White"] === "Yes") metrics.push("executions_white_victim");
    if (r.Juvenile === "Yes") metrics.push("executions_juvenile_offender");
    if (r["Foreign National"] === "Yes") metrics.push("executions_foreign_national");
    if (r.Volunteer === "Yes") metrics.push("executions_volunteer");
    if (r["Military Veteran"] === "Yes") metrics.push("executions_veteran");
    const federal = /federal/i.test(r.Jurisdiction);
    if (federal) metrics.push("executions_federal");
    for (const m of metrics) bump(geo("US"), year, m);
    const fips = STATE_FIPS[r["State Abbreviation"]];
    if (!federal && fips) {
      for (const m of metrics) bump(geo(fips), year, m);
      const county = r["County FIPS"]?.padStart(5, "0");
      if (/^\d{5}$/.test(county)) bump(["county", county, `${r.County}, ${r["State Abbreviation"]}`], year, "executions");
    }
  }
  const latest = through.slice(0, 4);
  const out = [...counts].map(([k, value]) => {
    const [level, geoid, name, year, metric] = k.split("|");
    return row(source, [level, geoid, name], metric, year, value, "people", year === latest ? { partial: true, through } : {});
  });
  if (!out.some((r) => r.geoid === "48" && r.metric === "executions")) throw new Error("DPIC: no Texas executions — layout changed?");
  console.log(`  dpic-executions: ${out.length} rows, 1977–${latest} (through ${through})`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

async function importStatus(pg) {
  const source = "dpic-status";
  await registerDataset(pg, source);
  const html = await (await fetchRetry("https://deathpenaltyinfo.org/state-and-federal-info/state-by-state", BROWSER)).text();
  const lines = decodeEntities(html.replace(/<[^>]+>/g, "\n")).split("\n").map((l) => l.trim()).filter(Boolean);
  const year = new Date().getFullYear();
  const out = [];
  let section = null;
  const seen = new Set();
  for (const line of lines) {
    if (/^States With the Death Penalty \(\d+\)/.test(line)) section = "with";
    else if (/^States Without The Death Penalty \(\d+\)/i.test(line)) section = "without";
    else if (/^Death Penalty States With an Executive Hold/i.test(line)) section = "hold";
    else if (/^Sources$/.test(line)) section = null;
    const m = /^([A-Z][A-Za-z .]+?)(?: \((\d{4})\))?$/.exec(line);
    const fips = m && STATE_FIPS[STATE_NAME_TO_ABBR[m[1]]];
    if (!section || !fips) continue;
    const key = `${section}|${fips}`;
    if (seen.has(key) || (section !== "with" && !m[2])) continue;
    seen.add(key);
    if (section === "with") out.push(row(source, geo(fips), "has_death_penalty", year, 1, "boolean"));
    if (section === "without") {
      out.push(row(source, geo(fips), "has_death_penalty", year, 0, "boolean"));
      out.push(row(source, geo(fips), "abolition_year", year, Number(m[2]), "year"));
    }
    if (section === "hold") out.push(row(source, geo(fips), "executive_hold_since", year, Number(m[2]), "year"));
  }
  const states = out.filter((r) => r.metric === "has_death_penalty").length;
  if (states < 50) throw new Error(`DPIC status: only ${states} states classified — page layout changed?`);
  console.log(`  dpic-status: ${out.length} rows (${out.filter((r) => r.metric === "has_death_penalty" && r.value === 1).length} states with the death penalty)`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

async function importBjs(pg) {
  const source = "bjs-capital-punishment";
  await registerDataset(pg, source);
  const dir = mkdtempSync(join(tmpdir(), "cp-"));
  writeFileSync(join(dir, "cp.zip"), Buffer.from(await (await fetchRetry(`https://bjs.ojp.gov/document/${BJS_REPORT}.zip`, BROWSER)).arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", "-j", join(dir, "cp.zip"), "-d", dir]);
  const prefix = BJS_REPORT.replace(/st$/, "");
  // Positional columns: give parseCsv a synthetic header (c0, c1, …).
  const table = (name) => parseCsv(`${Array.from({ length: 30 }, (_, i) => `c${i}`).join(",")}\n${readFileSync(join(dir, `${prefix}st${name}.csv`), "latin1")}`)
    .map((r) => Array.from({ length: 30 }, (_, i) => r[`c${i}`]));
  const n = (s) => num(String(s ?? "").replace(/,/g, "").trim());
  const out = [];
  const series = (name, cols) => {
    for (const r of table(name)) {
      if (!/^\d{4}$/.test(String(r[0]).trim())) continue;
      for (const [i, metric] of cols) if (n(r[i]) !== null) out.push(row(source, geo("US"), metric, r[0].trim(), n(r[i]), "people"));
    }
  };
  series("at01", [[1, "death_row"]]);
  series("at02", [[1, "death_row_admissions"], [2, "death_row_removals"]]);
  series("at03", [[1, "death_row_white"], [2, "death_row_black"], [3, "death_row_other_race"]]);
  series("at04", [[1, "executions"]]);
  // Table 2: death row at the end of the prior year and this year, by state
  // and race (columns: total, White, Black, Hispanic per block).
  const t2 = table("t02");
  const year = Number(/(\d{4})\D*$/.exec(t2.find((r) => /^Table 2\./.test(r[0]))?.[0] ?? "")?.[1]);
  for (const r of t2) {
    const label = String(r[1] || r[0]).replace(/\/[a-z]$/, "").trim();
    const fips = label === "U.S. total" ? "US" : STATE_FIPS[STATE_NAME_TO_ABBR[label]];
    if (!fips) continue;
    for (const [offset, y] of [[2, year - 1], [22, year]]) {
      [["death_row", 0], ["death_row_white", 1], ["death_row_black", 2], ["death_row_hispanic", 3]].forEach(([metric, k]) => {
        const v = n(r[offset + k]);
        if (v !== null && !(fips === "US" && metric !== "death_row_hispanic")) out.push(row(source, geo(fips), metric, y, v, "people"));
      });
    }
  }
  if (!out.some((r) => r.geoid === "06" && r.metric === "death_row")) throw new Error("BJS capital punishment: no California death row — layout changed?");
  console.log(`  bjs-capital-punishment: ${out.length} rows (${BJS_REPORT})`);
  return upsertRows(pg, "area_stats", COLUMNS, out, CONFLICT);
}

await runImport("death-penalty", async (pg) => {
  let inserted = 0;
  if (ONLY.has("executions")) inserted += await importExecutions(pg);
  if (ONLY.has("status")) inserted += await importStatus(pg);
  if (ONLY.has("bjs")) inserted += await importBjs(pg);
  return { inserted };
});
