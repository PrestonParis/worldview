// Imports CBP nationwide encounters (USBP apprehensions, OFO inadmissibles,
// Title 42 expulsions) into `area_stats`, monthly:
//   encounters_total            per state (FIPS geoid), per land-border
//                               region (geo_level 'border_region'), nation
//   encounters_<demographic>    nation (single adults, family units, UACs, ...)
//   encounters_by_citizenship   nation, geo_level 'citizenship', geoid = country
//
// CBP publishes rolling multi-year CSVs; the newest file supersedes earlier
// months, so files are applied oldest first. The download URL changes every
// month — the script scrapes the dataset page for current links and falls
// back to the known ones. cbp.gov rejects non-browser clients.
//
// Source: https://www.cbp.gov/document/stats/nationwide-encounters — free.
//
// Usage:
//   node scripts/import-cbp-encounters.mjs [--urls=<csv url>,<csv url>]
//   ENV_FILE=.env.cloud node scripts/import-cbp-encounters.mjs

import { STATE_FIPS, arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const PAGE = "https://www.cbp.gov/document/stats/nationwide-encounters";
const HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128 Safari/537.36",
  Accept: "text/html,text/csv,*/*",
  "Accept-Language": "en-US",
};
const FALLBACK = [
  "https://www.cbp.gov/sites/default/files/assets/documents/2023-Nov/nationwide-encounters-fy20-fy23-state.csv",
  "https://www.cbp.gov/sites/default/files/2026-09/nationwide-encounters-fy23-fy26-aug-state.csv",
];
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

async function discoverUrls() {
  try {
    const html = await (await fetchRetry(PAGE, { headers: HEADERS }, { attempts: 2 })).text();
    const links = [...html.matchAll(/href="([^"]*nationwide-encounters-fy\d\d-fy(\d\d)[^"]*-state[^"]*\.csv)"/g)];
    // Newest file per end-FY: the first link listed for each end year.
    const byEnd = new Map();
    for (const [, href, end] of links) if (!byEnd.has(end)) byEnd.set(end, new URL(href, PAGE).href);
    // Oldest window + newest window cover every month.
    const ends = [...byEnd.keys()].sort();
    if (ends.length) return [...new Set([byEnd.get(ends[0]), byEnd.get(ends.at(-1))])];
  } catch (err) {
    console.log(`  page scrape failed (${err.message}) — using fallback urls`);
  }
  return FALLBACK;
}

await runImport("cbp-encounters", async (pg) => {
  await registerDataset(pg, "cbp");
  const urls = arg("urls", "") ? arg("urls", "").split(",") : await discoverUrls();
  const agg = new Map(); // key -> row; later files overwrite earlier months
  for (const url of urls) {
    console.log(`  ${url}`);
    const rows = parseCsv(await (await fetchRetry(url, { headers: HEADERS }, { label: "cbp csv" })).text());
    const fileAgg = new Map();
    const add = (metric, geoLevel, geoid, geoName, period, count) => {
      const key = `${metric}|${geoLevel}|${geoid}|${period}`;
      const cur = fileAgg.get(key);
      if (cur) cur.value += count;
      else
        fileAgg.set(key, {
          source: "cbp", metric, geo_level: geoLevel, geoid, geo_name: geoName, period,
          period_start: `${period}-01`, value: count, unit: "encounters", metadata: null,
        });
    };
    for (const r of rows) {
      const m = MONTHS[(r["Month (abbv)"] || "").toUpperCase()];
      const fy = Number.parseInt(r["Fiscal Year"], 10); // "2026 (FYTD)" for the current year
      const count = Number(r["Encounter Count"]);
      if (!m || !fy || !Number.isFinite(count)) continue;
      const year = m >= 10 ? fy - 1 : fy;
      const period = `${year}-${String(m).padStart(2, "0")}`;
      const st = r.State;
      if (STATE_FIPS[st]) add("encounters_total", "state", STATE_FIPS[st], st, period, count);
      if (r["Land Border Region"]) {
        add("encounters_total", "border_region", slug(r["Land Border Region"]), r["Land Border Region"], period, count);
      }
      add("encounters_total", "nation", "US", "United States", period, count);
      if (r.Demographic) add(`encounters_${slug(r.Demographic)}`, "nation", "US", "United States", period, count);
      if (r["Title of Authority"]) add(`encounters_${slug(r["Title of Authority"])}`, "nation", "US", "United States", period, count);
      if (r.Citizenship) add("encounters_by_citizenship", "citizenship", slug(r.Citizenship), r.Citizenship, period, count);
    }
    for (const [k, v] of fileAgg) agg.set(k, v);
    console.log(`    ${rows.length} rows -> ${fileAgg.size} series points`);
  }
  const out = [...agg.values()];
  const n = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, [
    "source", "metric", "geo_level", "geoid", "period",
  ]);
  return { inserted: n };
});
