// Imports Table 1 of CBP's yearly Entry/Exit Overstay Report into
// `area_stats` (source dhs-overstays), per fiscal year (period 'FY2025'):
//
//   overstay_expected_departures, overstay_out_of_country,
//   overstay_in_country, overstay_in_country_rate
//     nation, and by geo_level 'admission_type' (vwp, non-vwp-visitors,
//     students, other, canada-mexico)
//
// Each report counts suspected in-country overstays at the end of its own
// fiscal year; later reports revise that count down as people leave or
// change status. This keeps each year as first reported. Reports before
// FY 2022 covered a narrower population and aren't imported.
//
// Source: https://www.dhs.gov/publication/entryexit-overstay-report
// (PDFs read with scripts/lib/pdf.mjs)
//
// Usage:
//   node scripts/import-dhs-overstays.mjs
//   ENV_FILE=.env.cloud node scripts/import-dhs-overstays.mjs

import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { pdfLines } from "./lib/pdf.mjs";

const SOURCE = "dhs-overstays";
const REPORTS = {
  2022: "https://www.dhs.gov/sites/default/files/2023-07/23_0707_FY22_FY23_CBP_Integrated_Entry_Exit_Overstay_Report.pdf",
  2023: "https://www.dhs.gov/sites/default/files/2024-10/24_1011_CBP-Entry-Exit-Overstay-Report-FY23-Data.pdf",
  2024: "https://www.dhs.gov/sites/default/files/2025-09/25_0912_cbp_entry-exit-overstay-report-fiscal-year-2024.pdf",
  2025: "https://www.dhs.gov/sites/default/files/2026-10/26_1015_cbp_entry-exit-overstay-report-fiscal-year-2025-508-CHL-update.pdf",
};
// Table 1's rows, always in this order (they summarize Tables 2–6). Labels
// wrap over several lines and the numbers can sit on any of them.
const TYPES = [
  ["vwp", "Visa Waiver Program visitors"],
  ["non-vwp-visitors", "Other business and tourist visitors"],
  ["students", "Students and exchange visitors"],
  ["other", "All other temporary visitors"],
  ["canada-mexico", "Canadian and Mexican visitors"],
];
// expected, out-of-country, in-country, total, total rate, in-country rate
const NUMBERS = /([\d,]{5,})\s+([\d,]+)\s+([\d,]+)\s+([\d,]+)\s+([\d.]+)%\s+([\d.]+)%$/;
const num = (s) => Number(s.replace(/,/g, ""));

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  for (const [fy, url] of Object.entries(REPORTS)) {
    const lines = await pdfLines(Buffer.from(await (await fetchRetry(url)).arrayBuffer()));
    const start = lines.findIndex((l, i) => l === "Table 1" && /Summary Overstay Rates/i.test(lines[i + 1] ?? ""));
    const end = lines.findIndex((l, i) => i > start && /^Totals:/.test(l));
    if (start < 0 || end < 0) throw new Error(`Overstays FY${fy}: Table 1 not found`);
    const add = (level, geoid, name, m) => {
      const meta = { url };
      const base = { source: SOURCE, geo_level: level, geoid, geo_name: name, period: `FY${fy}`, period_start: `${fy - 1}-10-01`, metadata: meta };
      out.push(
        { ...base, metric: "overstay_expected_departures", value: num(m[1]), unit: "people" },
        { ...base, metric: "overstay_out_of_country", value: num(m[2]), unit: "people" },
        { ...base, metric: "overstay_in_country", value: num(m[3]), unit: "people" },
        { ...base, metric: "overstay_in_country_rate", value: Number(m[6]), unit: "percent" },
      );
    };
    const totals = NUMBERS.exec(lines[end]);
    if (!totals) throw new Error(`Overstays FY${fy}: can't read totals "${lines[end]}"`);
    add("nation", "US", "United States", totals);
    const rows = lines.slice(start, end).map((l) => NUMBERS.exec(l)).filter(Boolean);
    const sum = rows.reduce((t, m) => t + num(m[3]), 0);
    if (rows.length !== TYPES.length || sum !== num(totals[3]))
      throw new Error(`Overstays FY${fy}: ${rows.length} rows adding to ${sum}, total ${num(totals[3])}`);
    rows.forEach((m, i) => add("admission_type", TYPES[i][0], TYPES[i][1], m));
    console.log(`  FY${fy}: ${num(totals[3]).toLocaleString()} suspected in-country`);
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
