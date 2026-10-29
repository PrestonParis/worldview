// Imports DHS Office of Homeland Security Statistics "Immigration
// Enforcement and Legal Processes Monthly Tables" into `area_stats` (source
// ohss-enforcement), nation, monthly (period YYYY-MM, calendar month) from
// FY2014: what happened to people encountered at the southwest border
// (repatriated, transferred to ICE, released, paroled), ICE arrests,
// detention book-ins and removals by criminal history, credible-fear
// screenings, CBP One appointments, and the CHNV parole process.
//
// Metric = <sheet prefix>_<column>, with group headers folded in (e.g.
// swb_bookouts_usbp_usbp_releases, ero_arrests_convicted_criminals_felons).
// Labels are registered from the workbook's own headers.
//
// OHSS stopped publishing these tables after the November 2024 edition
// (released January 2025).
//
// Source: https://ohss.dhs.gov/topics/immigration/immigration-enforcement/immigration-enforcement-and-legal-processes-monthly
//
// Usage:
//   node scripts/import-ohss-monthly.mjs [--url=<workbook>]
//   ENV_FILE=.env.cloud node scripts/import-ohss-monthly.mjs

import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "ohss-enforcement";
const URL = arg(
  "url",
  "https://ohss.dhs.gov/sites/default/files/2025-01/2025_0116_ohss_immigration-enforcement-and-legal-processes-tables-november-2024.xlsx",
);
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
// Sheet -> metric prefix.
const SHEETS = {
  "CBP SWB Book-Outs by Agency": "swb_bookouts",
  "SWB Encounters by Family Status": "swb_encounters",
  "ERO Arrests by Criminality": "ero_arrests",
  "ICE Book-Ins by Criminality": "ice_bookins",
  "ICE Book-Ins by Arrest Loc": "ice_bookins_by_arrester",
  "ICE ERO R&R by Criminality": "ice_removals",
  "DHS Removals by Criminality": "dhs_removals",
  "DHS Repats by Type": "dhs_repatriations",
  "SWB CF Completed by Result": "swb_credible_fear",
  "Nationwide CF by Result": "credible_fear",
  "CBP One Appointments": "cbp_one",
  "CHNV I-134": "chnv_i134",
  "CHNV Travel Authorization": "chnv_travel",
  "CHNV Paroles": "chnv_paroles",
};
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const slug = (s) =>
  String(s)
    .replace(/\d+$/, "") // footnote digits ("USBP Releases6")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "");
const clean = (s) => String(s).replace(/\d+$/, "").replace(/\s+/g, " ").trim();

await runImport(SOURCE, async (pg) => {
  const book = readXlsx(Buffer.from(await (await fetchRetry(URL, BROWSER)).arrayBuffer()));
  const out = [];
  const labels = {};
  for (const [sheet, prefix] of Object.entries(SHEETS)) {
    const rows = book[sheet];
    if (!rows) throw new Error(`no sheet "${sheet}" — workbook changed?`);
    const h = rows.findIndex((r) => r[0] === "Fiscal Year");
    const title = clean(rows.find((r) => typeof r[0] === "string" && /Fiscal Years/.test(r[0]))?.[0] ?? sheet).replace(/: Fiscal Years.*$/, "");
    // Group headers (merged cells) sit on the row above; carry them right.
    const groups = [];
    let g = null;
    rows[h - 1]?.forEach((c, i) => {
      if (c) g = c;
      groups[i] = g;
    });
    const cols = rows[h].map((c, i) => {
      if (i < 2 || !c) return null;
      const group = groups[i] && h > 0 && rows[h - 1].some(Boolean) ? groups[i] : null;
      const metric = [prefix, group && slug(group), slug(c)].filter(Boolean).join("_");
      labels[metric] = { label: `${title}: ${[group && clean(group), clean(c)].filter(Boolean).join(", ")}`, unit: "people" };
      return metric;
    });
    let fy = null;
    let n = 0;
    for (const r of rows.slice(h + 1)) {
      if (typeof r[0] === "number") fy = r[0];
      const month = MONTHS.indexOf(r[1]);
      if (!fy || month < 0) continue;
      // Fiscal years start in October of the prior calendar year.
      const year = month >= 9 ? fy - 1 : fy;
      const period = `${year}-${String(month + 1).padStart(2, "0")}`;
      cols.forEach((metric, i) => {
        if (!metric || typeof r[i] !== "number") return;
        out.push({
          source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States",
          period, period_start: `${period}-01`, value: r[i], unit: "people", metadata: null,
        });
      });
      n++;
    }
    console.log(`  ${sheet}: ${n} months, ${cols.filter(Boolean).length} columns`);
  }
  await registerDataset(pg, SOURCE, labels);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: URL.split("/").at(-1) };
});
