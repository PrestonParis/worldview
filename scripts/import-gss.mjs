// Imports the General Social Survey (NORC, 1972–) into `area_stats`
// (source gss): the weighted percent of U.S. adults giving a key answer to
// ~90 long-running questions — abortion, guns, the death penalty, spending
// priorities, confidence in institutions, free speech, race, religion,
// immigration, ideology and party (item list: scripts/lib/gss-items.mjs).
//
//   geo_level 'nation', geoid US                    every survey year
//   geo_level 'group', geoid party_republican, …    same, by party, ideology,
//       race, sex, age, and education (cells under 50 respondents skipped)
//
// Percents use the post-stratification weight WTSSPS and exclude don't-know,
// no-answer and not-asked responses. metadata.n is the unweighted count.
//
// Source: the cumulative Stata file at https://gss.norc.org/us/en/gss/get-the-data.html
// (~600 MB unzipped; pass --file= to reuse a downloaded .dta or .zip).
//
// Usage:
//   node scripts/import-gss.mjs [--file=GSS_stata.zip]
//   ENV_FILE=.env.cloud node scripts/import-gss.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { GSS_ITEMS } from "./lib/gss-items.mjs";
import { readDta } from "./lib/stata.mjs";

const SOURCE = "gss";
const URL = "https://gss.norc.org/content/dam/gss/get-the-data/documents/stata/GSS_stata.zip";
const MIN_N = 50;

// Breakdown groups: [geoid, name, variable, predicate]
const GROUPS = [
  ["party_democrat", "Democrats", "partyid", (v) => v >= 0 && v <= 2],
  ["party_independent", "Independents", "partyid", (v) => v === 3],
  ["party_republican", "Republicans", "partyid", (v) => v >= 4 && v <= 6],
  ["ideology_liberal", "Liberals", "polviews", (v) => v <= 3],
  ["ideology_moderate", "Moderates", "polviews", (v) => v === 4],
  ["ideology_conservative", "Conservatives", "polviews", (v) => v >= 5],
  ["race_white", "White", "race", (v) => v === 1],
  ["race_black", "Black", "race", (v) => v === 2],
  ["sex_male", "Men", "sex", (v) => v === 1],
  ["sex_female", "Women", "sex", (v) => v === 2],
  ["age_18_34", "Ages 18–34", "age", (v) => v < 35],
  ["age_35_64", "Ages 35–64", "age", (v) => v >= 35 && v < 65],
  ["age_65_plus", "Ages 65+", "age", (v) => v >= 65],
  ["degree_bachelor_plus", "Bachelor's degree or more", "degree", (v) => v >= 3],
  ["degree_less_than_bachelor", "No bachelor's degree", "degree", (v) => v <= 2],
];

async function loadDta() {
  const file = arg("file", null);
  if (file?.endsWith(".dta")) return readFileSync(file);
  const dir = mkdtempSync(join(tmpdir(), "gss-"));
  const zip = file ?? join(dir, "GSS_stata.zip");
  if (!file) {
    console.log(`  downloading ${URL}`);
    writeFileSync(zip, Buffer.from(await (await fetchRetry(URL, { timeoutMs: 1_800_000 })).arrayBuffer()));
  }
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  const find = (d) => readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? find(join(d, e.name)) : e.name.endsWith(".dta") ? [join(d, e.name)] : []);
  const dta = find(dir)[0];
  if (!dta) throw new Error("no .dta in the GSS zip");
  return readFileSync(dta);
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const buf = await loadDta();
  const vars = [...new Set(["year", "wtssps", "wtssall", ...GROUPS.map((g) => g[2]), ...GSS_ITEMS.map((i) => i[1])])];
  const d = readDta(buf, vars);
  if (d.missing.length) console.log(`  not in this release: ${d.missing.join(", ")}`);
  const { year, wtssps, wtssall } = d.columns;
  const weight = (r) => wtssps[r] ?? wtssall[r] ?? 1;
  const latest = Math.max(...year.filter(Number.isFinite));

  const out = [];
  const add = (geoLevel, geoid, name, metric, y, acc) =>
    out.push({
      source: SOURCE, metric, geo_level: geoLevel, geoid, geo_name: name, period: String(y),
      period_start: `${y}-01-01`, value: Math.round((1000 * acc.yes) / acc.w) / 10, unit: "percent",
      metadata: { n: acc.n },
    });

  for (const [metric, v, yes] of GSS_ITEMS) {
    const col = d.columns[v];
    if (!col) continue;
    const yesSet = new Set(yes);
    const nation = new Map();
    const groups = new Map();
    const bump = (map, key, r, hit) => {
      const acc = map.get(key) ?? { w: 0, yes: 0, n: 0 };
      const w = weight(r);
      acc.w += w;
      acc.n += 1;
      if (hit) acc.yes += w;
      map.set(key, acc);
    };
    const labels = d.labels[v] ?? {};
    for (let r = 0; r < d.n; r++) {
      const x = col[r];
      // Extended-missing codes are already null; also drop "other"/"refused"-style codes
      // that the labels mark as non-substantive.
      if (x === null || /refused|don't know|no answer|^other$/i.test(labels[x] ?? "")) continue;
      const hit = yesSet.has(x);
      bump(nation, year[r], r, hit);
      for (const [gid, , gv, pred] of GROUPS) {
        if (gv === v) continue;
        const g = d.columns[gv]?.[r];
        if (g !== null && g !== undefined && pred(g)) bump(groups, `${gid}|${year[r]}`, r, hit);
      }
    }
    for (const [y, acc] of nation) if (acc.n >= MIN_N) add("nation", "US", "United States", metric, y, acc);
    for (const [key, acc] of groups) {
      if (acc.n < MIN_N) continue;
      const [gid, y] = key.split("|");
      add("group", gid, GROUPS.find((g) => g[0] === gid)[1], metric, y, acc);
    }
  }
  const metrics = new Set(out.map((r) => r.metric));
  for (const want of ["abortion_any_reason", "confidence_supreme_court", "party_republican"]) {
    if (!metrics.has(want)) throw new Error(`GSS file has no ${want} values — variable renamed?`);
  }
  console.log(`  ${out.length} rows, ${metrics.size} metrics, 1972–${latest}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: String(latest) };
});
