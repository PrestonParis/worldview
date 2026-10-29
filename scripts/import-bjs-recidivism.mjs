// Imports BJS's recidivism study of state prisoners released in 2012 (34
// states, 5-year follow-up) into `area_stats` (source bjs-recidivism),
// period = release cohort '2012', geo_level 'group' (geoid = released group:
// all, male, black_nh, age_24_or_younger, violent, robbery, …):
//
//   released                       prisoners released (rounded to 100)
//   arrested_year_<1-5>_pct        cumulative share arrested (Tables 4, 5)
//   convicted_year_<1-5>_pct       arrest led to a conviction (Table 7)
//   reimprisoned_year_<1-5>_pct    returned to prison (Table 8)
//
// Source: https://bjs.ojp.gov/library/publications/recidivism-prisoners-released-34-states-2012-5-year-follow-period-2012-2017
// (CSV tables, NCJ 255947) — free, no key.
//
// Usage:
//   node scripts/import-bjs-recidivism.mjs
//   ENV_FILE=.env.cloud node scripts/import-bjs-recidivism.mjs

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "bjs-recidivism";
const STUDY = "rpr34s125yfup1217";
const COHORT = "2012";
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
const TABLES = { t04: "arrested", t05: "arrested", t07: "convicted", t08: "reimprisoned" };

const cells = (line) => [...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)].map((m) => (m[2] ?? m[1]).trim()).slice(0, -1);
const num = (s) => (/^[\d,.]+$/.test(s ?? "") ? Number(s.replace(/,/g, "")) : null);
// "White/a*" -> white_nh; "25–39" -> age_25_39
const GROUP = {
  "all released prisoners": "all", "white": "white_nh", "black": "black_nh", "hispanic": "hispanic",
  "american indian/alaska native": "aian_nh", "asian/native hawaiian/other pacific islander": "asian_nhpi_nh", "other": "other_nh",
};
function groupOf(label) {
  const clean = label.replace(/\/[a-z](,[a-z])*\*?$|\*$/g, "").replace(/\*/g, "").trim();
  const lower = clean.toLowerCase();
  if (GROUP[lower]) return [GROUP[lower], clean];
  if (/^\d|or (older|younger)/.test(lower)) return [`age_${lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`, `Age ${clean}`];
  return [lower.replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, ""), clean];
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "bjs-recid-"));
  const zip = path.join(dir, "t.zip");
  fs.writeFileSync(zip, Buffer.from(await (await fetchRetry(`https://bjs.ojp.gov/BJS_PUB/${STUDY}/csv/${STUDY}.zip`, BROWSER)).arrayBuffer()));
  execFileSync("unzip", ["-q", "-o", zip, "-d", dir]);
  const out = [];
  for (const [t, measure] of Object.entries(TABLES)) {
    const lines = new TextDecoder("latin1").decode(fs.readFileSync(path.join(dir, `${STUDY}${t}.csv`))).split(/\r?\n/).map(cells);
    const head = lines.findIndex((r) => r.includes("Year 1"));
    if (head < 0) throw new Error(`${t}: no "Year 1" header`);
    const countCol = lines[head].findIndex((c) => /Number of released prisoners/.test(c));
    const yearCols = [1, 2, 3, 4, 5].map((y) => lines[head].indexOf(`Year ${y}`));
    let n = 0;
    for (const r of lines.slice(head + 1)) {
      if (/^"?(Note|Source|\*|a\/|b\/)/.test(r[0] ?? "")) break;
      // Tables 7 and 8 have no count column; labels run up to the first year.
      const label = r.slice(0, countCol >= 0 ? countCol : yearCols[0]).filter(Boolean).at(-1);
      const released = countCol >= 0 ? num(r[countCol]) : null;
      if (!label || num(r[yearCols[0]]) === null) continue; // section headings
      const [geoid, name] = groupOf(label);
      const base = { source: SOURCE, geo_level: "group", geoid, geo_name: name, period: COHORT, period_start: `${COHORT}-01-01`, metadata: { table: t, study: STUDY } };
      if (released !== null && measure === "arrested") out.push({ ...base, metric: "released", value: released, unit: "people" });
      yearCols.forEach((c, i) => {
        const v = num(r[c]);
        if (v !== null) out.push({ ...base, metric: `${measure}_year_${i + 1}_pct`, value: v, unit: "percent" });
      });
      n++;
    }
    if (n < 5) throw new Error(`${t}: only ${n} rows parsed`);
    console.log(`  ${t} ${measure}: ${n} groups`);
  }
  fs.rmSync(dir, { recursive: true, force: true });
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted };
});
