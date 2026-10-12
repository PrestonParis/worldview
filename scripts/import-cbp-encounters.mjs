// Imports CBP nationwide encounters (USBP apprehensions, OFO inadmissibles,
// Title 42 expulsions) into `area_stats`, monthly:
//   encounters_total            per state (FIPS geoid), per land-border
//                               region (geo_level 'border_region'), nation
//   encounters_<demographic>,
//   encounters_title_8 / _42    nation and per land-border region
//   encounters_by_citizenship   nation, geo_level 'citizenship', geoid = country
// From the area-of-responsibility files (same counts, cut by agency):
//   encounters_usbp / _ofo      Border Patrol vs. Field Operations, nation
//                               and per land-border region
//   encounters_by_aor           per Border Patrol sector / OFO field office
//                               (geo_level 'aor'), metadata { component, region }
//
// CBP publishes rolling multi-year CSVs (a "-state" and an "-aor" cut of the
// same counts); the newest file supersedes earlier months, so files are
// applied oldest first. The download URL changes every
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
const FALLBACK = {
  state: [
    "https://www.cbp.gov/sites/default/files/assets/documents/2023-Nov/nationwide-encounters-fy20-fy23-state.csv",
    "https://www.cbp.gov/sites/default/files/2026-09/nationwide-encounters-fy23-fy26-aug-state.csv",
  ],
  aor: [
    "https://www.cbp.gov/sites/default/files/assets/documents/2023-Nov/nationwide-encounters-fy20-fy23-aor.csv",
    "https://www.cbp.gov/sites/default/files/2026-09/nationwide-encounters-fy23-fy26-aug-aor_0.csv",
  ],
};
const COMPONENTS = { "U.S. Border Patrol": "usbp", "Office of Field Operations": "ofo" };
const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");

// kind: "state" | "aor"
async function discoverUrls(kind) {
  try {
    const html = await (await fetchRetry(PAGE, { headers: HEADERS }, { attempts: 2 })).text();
    const re = new RegExp(`href="([^"]*nationwide-encounters-fy\\d\\d-fy(\\d\\d)[^"]*-${kind}[^"]*\\.csv)"`, "g");
    // Newest file per end-FY: the first link listed for each end year.
    const byEnd = new Map();
    for (const [, href, end] of html.matchAll(re)) if (!byEnd.has(end)) byEnd.set(end, new URL(href, PAGE).href);
    // Oldest window + newest window cover every month.
    const ends = [...byEnd.keys()].sort();
    if (ends.length) return [...new Set([byEnd.get(ends[0]), byEnd.get(ends.at(-1))])];
  } catch (err) {
    console.log(`  page scrape failed (${err.message}) — using fallback urls`);
  }
  return FALLBACK[kind];
}

await runImport("cbp-encounters", async (pg) => {
  await registerDataset(pg, "cbp");
  const agg = new Map(); // key -> row; later files overwrite earlier months

  // Reads each file into its own aggregate, then lets it supersede the
  // months already seen. `each` adds a CSV row's count to the aggregate.
  const apply = async (urls, each) => {
    for (const url of urls) {
      console.log(`  ${url}`);
      const rows = parseCsv(await (await fetchRetry(url, { headers: HEADERS }, { label: "cbp csv" })).text());
      const fileAgg = new Map();
      const add = (metric, geoLevel, geoid, geoName, period, count, metadata = null) => {
        const key = `${metric}|${geoLevel}|${geoid}|${period}`;
        const cur = fileAgg.get(key);
        if (cur) cur.value += count;
        else
          fileAgg.set(key, {
            source: "cbp", metric, geo_level: geoLevel, geoid, geo_name: geoName, period,
            period_start: `${period}-01`, value: count, unit: "encounters", metadata,
          });
      };
      for (const r of rows) {
        const m = MONTHS[(r["Month (abbv)"] || "").toUpperCase()];
        const fy = Number.parseInt(r["Fiscal Year"], 10); // "2026 (FYTD)" for the current year
        const count = Number(r["Encounter Count"]);
        if (!m || !fy || !Number.isFinite(count)) continue;
        const year = m >= 10 ? fy - 1 : fy;
        const period = `${year}-${String(m).padStart(2, "0")}`;
        const region = r["Land Border Region"] ? slug(r["Land Border Region"]) : null;
        // Nation plus, when known, the row's land-border region.
        const both = (metric, c = count) => {
          add(metric, "nation", "US", "United States", period, c);
          if (region) add(metric, "border_region", region, r["Land Border Region"], period, c);
        };
        each(r, { period, count, region, add, both });
      }
      for (const [k, v] of fileAgg) agg.set(k, v);
      console.log(`    ${rows.length} rows -> ${fileAgg.size} series points`);
    }
  };

  const urlArg = arg("urls", "");
  const urls = urlArg
    ? { state: urlArg.split(",").filter((u) => /-state/.test(u)), aor: urlArg.split(",").filter((u) => /-aor/.test(u)) }
    : { state: await discoverUrls("state"), aor: await discoverUrls("aor") };

  await apply(urls.state, (r, { period, count, add, both }) => {
    const st = r.State;
    if (STATE_FIPS[st]) add("encounters_total", "state", STATE_FIPS[st], st, period, count);
    both("encounters_total");
    if (r.Demographic) both(`encounters_${slug(r.Demographic)}`);
    if (r["Title of Authority"]) both(`encounters_${slug(r["Title of Authority"])}`);
    if (r.Citizenship) add("encounters_by_citizenship", "citizenship", slug(r.Citizenship), r.Citizenship, period, count);
  });

  await apply(urls.aor, (r, { period, count, add, both }) => {
    const component = COMPONENTS[r.Component];
    if (!component) return;
    both(`encounters_${component}`);
    const aor = r["Area of Responsibility"];
    if (aor) {
      add("encounters_by_aor", "aor", slug(aor), aor, period, count, {
        component,
        region: r["Land Border Region"] || null,
      });
    }
  });

  const out = [...agg.values()];
  const n = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, [
    "source", "metric", "geo_level", "geoid", "period",
  ]);
  return { inserted: n };
});
