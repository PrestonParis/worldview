// Imports USCIS's quarterly "Number of Service-wide Forms by Quarter, Form
// Status, and Processing Time" into `area_stats` (source uscis-forms),
// nation, per fiscal year (period 'FY2025'), from each year's fourth-quarter
// edition, whose fiscal-year-to-date columns cover the whole year. The
// newest edition is partial (metadata.partial, metadata.through).
//
//   uscis_<form>_received, _approved, _denied   forms in the fiscal year
//   uscis_<form>_pending                        forms pending at its end
//   for i129, i130, i140, i485, i539, n400; rows for the same form (I-130
//   relative types, I-485 categories, N-400 military) are added together.
//   uscis_i485_pending etc. also by geo_level 'category' (family,
//   employment, asylum, refugee, cuban, other).
//
// USCIS lists editions back to FY 2024 on its data page; FY 2022 and 2023
// are older uploads at their own URLs. Earlier years weren't found.
//
// Source: https://www.uscis.gov/tools/reports-and-studies/immigration-and-citizenship-data
//
// Usage:
//   node scripts/import-uscis-forms.mjs
//   ENV_FILE=.env.cloud node scripts/import-uscis-forms.mjs

import { fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "uscis-forms";
const BASE = "https://www.uscis.gov/sites/default/files/document";
const EDITIONS = [
  { fy: 2022, url: `${BASE}/data/Quarterly_All_Forms_FY2022_Q4.csv` },
  { fy: 2023, url: `${BASE}/reports/quarterly_all_forms_fy2023_q4.csv` },
  { fy: 2024, url: `${BASE}/data/quarterly_all_forms_fy2024_q4.xlsx` },
  { fy: 2025, url: `${BASE}/data/quarterly_all_forms_fy2025_q4_v1.xlsx` },
  { fy: 2026, url: `${BASE}/data/quarterly_all_forms_fy2026_q3_v1.xlsx`, through: "2026-06" },
];
const FORMS = { "I-129": "i129", "I-130": "i130", "I-140": "i140", "I-485": "i485", "I-539": "i539", "N-400": "n400" };
// Fiscal-year-to-date columns: received, approved, denied, total completions, pending.
const COLS = { received: 8, approved: 9, denied: 10, pending: 12 };
const num = (v) => {
  const n = Number(String(v ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(n) && String(v ?? "").trim() !== "" ? n : null;
};

// Every edition as rows of cells, whichever format it came in.
async function rows(url) {
  const buf = Buffer.from(await (await fetchRetry(url)).arrayBuffer());
  if (url.endsWith(".xlsx")) return Object.values(readXlsx(buf))[0];
  const text = buf.toString("utf8");
  const width = Math.max(...text.split(/\r?\n/).map((l) => l.split(",").length));
  const header = Array.from({ length: width }, (_, i) => `c${i}`).join(",");
  return parseCsv(`${header}\n${text}`).map((r) => Object.values(r));
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = new Map();
  const add = (metric, level, geoid, name, fy, value, meta) =>
    out.set(`${metric}|${level}|${geoid}|${fy}`, {
      source: SOURCE, metric, geo_level: level, geoid, geo_name: name, period: `FY${fy}`, period_start: `${fy - 1}-10-01`,
      value: (out.get(`${metric}|${level}|${geoid}|${fy}`)?.value ?? 0) + value, unit: "forms", metadata: meta,
    });
  for (const { fy, url, through } of EDITIONS) {
    const meta = { url, ...(through ? { partial: true, through } : {}) };
    const table = await rows(url);
    if (!table.some((r) => String(r[0] ?? "").trim() === "TOTAL")) throw new Error(`USCIS FY${fy}: no TOTAL row`);
    let n = 0;
    for (const r of table) {
      const form = /^([IN]-\d{3}[A-Z]?)/.exec(String(r[0] ?? "").trim())?.[1];
      const code = FORMS[form];
      if (!code) continue;
      const category = form === "I-485" ? /\((\w+)\)\s*$/.exec(String(r[1] ?? ""))?.[1] : null;
      for (const [status, i] of Object.entries(COLS)) {
        const v = num(r[i]);
        if (v === null) continue;
        add(`uscis_${code}_${status}`, "nation", "US", "United States", fy, v, meta);
        if (category) add(`uscis_${code}_${status}`, "category", category.toLowerCase(), category, fy, v, meta);
      }
      n++;
    }
    if (n < Object.keys(FORMS).length) throw new Error(`USCIS FY${fy}: only ${n} form rows`);
    console.log(`  FY${fy}: ${n} rows`);
  }
  const list = [...out.values()];
  const inserted = await upsertRows(pg, "area_stats", Object.keys(list[0]), list, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${list.length} rows`);
  return { inserted };
});
