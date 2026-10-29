// Imports USCIS H-1B Employer Data Hub petitions into `area_stats` (source
// uscis-h1b), per fiscal year 2009–2023 (the hub's last downloadable year):
//
//   h1b_initial_approvals, h1b_initial_denials,        nation; state (by the
//   h1b_continuing_approvals, h1b_continuing_denials   employer's address);
//                                                      geo_level 'employer'
//                                                      (top 250 employers by
//                                                      initial approvals each
//                                                      year, geoid = name slug);
//                                                      geo_level 'industry'
//                                                      (2-digit NAICS)
//
// Initial = new employment (first-time H-1B or a new employer); continuing =
// extensions and amendments with the same employer.
//
// Source: https://www.uscis.gov/archive/h-1b-employer-data-hub-files — free.
//
// Usage:
//   node scripts/import-h1b.mjs [--years=2009-2023] [--top=250]
//   ENV_FILE=.env.cloud node scripts/import-h1b.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "uscis-h1b";
const [FROM, TO] = arg("years", "2009-2023").split("-").map(Number);
const TOP = Number(arg("top", "250"));
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
const NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));
const COLS = {
  "Initial Approval": "h1b_initial_approvals", "Initial Denial": "h1b_initial_denials",
  "Continuing Approval": "h1b_continuing_approvals", "Continuing Denial": "h1b_continuing_denials",
};
const NAICS = {
  11: "Agriculture", 21: "Mining", 22: "Utilities", 23: "Construction", 31: "Manufacturing", 32: "Manufacturing", 33: "Manufacturing",
  42: "Wholesale trade", 44: "Retail trade", 45: "Retail trade", 48: "Transportation", 49: "Transportation", 51: "Information",
  52: "Finance and insurance", 53: "Real estate", 54: "Professional, scientific, and technical services", 55: "Management of companies",
  56: "Administrative and support services", 61: "Educational services", 62: "Health care and social assistance",
  71: "Arts and recreation", 72: "Accommodation and food services", 81: "Other services", 92: "Public administration",
};
// Collapse name variants ("GOOGLE LLC", "Google LLC.") to one key.
const normalize = (s) => s.toUpperCase().replace(/[.,]/g, "").replace(/\s+/g, " ").trim();
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 80);

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (let fy = FROM; fy <= TO; fy++) {
    const rows = parseCsv(await (await fetchRetry(`https://www.uscis.gov/sites/default/files/document/data/h1b_datahubexport-${fy}.csv`, BROWSER)).text());
    const groups = { nation: new Map(), state: new Map(), employer: new Map(), industry: new Map() };
    const bump = (level, id, name, r) => {
      const g = groups[level].get(id) ?? { name, values: {} };
      groups[level].set(id, g);
      for (const [col, metric] of Object.entries(COLS)) g.values[metric] = (g.values[metric] ?? 0) + (Number(r[col]) || 0);
    };
    for (const r of rows) {
      bump("nation", "US", "United States", r);
      if (NAMES[r.State]) bump("state", STATE_FIPS[r.State], NAMES[r.State], r);
      if (r.Employer) {
        const name = normalize(r.Employer);
        bump("employer", slug(name), name, r);
      }
      const sector = NAICS[String(r.NAICS).slice(0, 2)];
      if (sector) bump("industry", slug(sector), sector, r);
    }
    const top = [...groups.employer.entries()].sort((a, b) => b[1].values.h1b_initial_approvals - a[1].values.h1b_initial_approvals).slice(0, TOP);
    groups.employer = new Map(top);
    const out = [];
    for (const [level, map] of Object.entries(groups)) {
      for (const [geoid, { name, values }] of map) {
        for (const [metric, value] of Object.entries(values)) {
          out.push({ source: SOURCE, metric, geo_level: level, geoid, geo_name: name, period: `FY${fy}`, period_start: `${fy - 1}-10-01`, value, unit: "petitions", metadata: null });
        }
      }
    }
    inserted += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  FY${fy}: ${rows.length} employer rows → ${out.length}`);
  }
  return { inserted };
});
