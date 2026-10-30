// Imports the State Department Refugee Processing Center's "Summary of
// Refugee Admissions" workbook into `area_stats` (source wraps-refugees):
//
//   refugee_ceiling                     nation, FY2001– (presidential determination)
//   refugee_admissions                  nation, FY2001– and monthly (period YYYY-MM)
//   refugee_admissions_by_nationality   geo_level 'country', FY2001–
//
// One sheet per fiscal year: regions with their ceilings, nationalities with
// a fiscal-year total and twelve monthly counts, and a "Grand Totals" row.
// The current fiscal year is partial until September (metadata.partial).
//
// Source: https://www.wrapsnet.org/admissions-and-arrivals/
//
// Usage:
//   node scripts/import-refugee-admissions.mjs [--url=<workbook>]
//   ENV_FILE=.env.cloud node scripts/import-refugee-admissions.mjs

import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const SOURCE = "wraps-refugees";
const PAGE = "https://www.wrapsnet.org/admissions-and-arrivals/";
const MONTHS = ["OCT", "NOV", "DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP"];
const num = (v) => Number(String(v ?? "").replace(/,/g, ""));
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// The workbook's file name carries its as-of date, so find it on the page.
async function workbookUrl() {
  const given = arg("url");
  if (given) return given;
  const html = await (await fetchRetry(PAGE)).text();
  const href = /href="([^"]*Refugee Admissions Report[^"]*\.xlsx)"/i.exec(html)?.[1];
  if (!href) throw new Error("Refugee Admissions Report workbook not linked on the admissions page");
  return new URL(href.replace(/ /g, "%20"), PAGE).href;
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const url = await workbookUrl();
  const book = readXlsx(Buffer.from(await (await fetchRetry(url)).arrayBuffer()));
  const asOf = /as of (\d+)-(\w+)-(\d{4})/i.exec(String(Object.values(book)[0]?.[2]?.[0] ?? ""));
  const out = [];
  const row = (metric, level, geoid, name, period, start, value, meta = {}) =>
    out.push({ source: SOURCE, metric, geo_level: level, geoid, geo_name: name, period, period_start: start, value, unit: "people", metadata: { url, ...meta } });

  for (const [sheet, rows] of Object.entries(book)) {
    if (!/^\d{4}$/.test(sheet)) continue;
    const fy = Number(sheet);
    const header = rows.findIndex((r) => r[0] === "Country of Chargeability");
    const total = rows.find((r) => String(r[1] ?? "").trim() === "Grand Totals");
    if (header < 0 || !total) throw new Error(`Refugee admissions FY${fy}: header or Grand Totals row missing`);
    const months = MONTHS.map((_, i) => rows[header][4 + i]);
    if (months.join() !== MONTHS.join()) throw new Error(`Refugee admissions FY${fy}: unexpected month columns ${months}`);
    // A month counts as reported once the as-of date has passed its start.
    const monthPeriod = (i) => {
      const m = ((9 + i) % 12) + 1;
      return `${m >= 10 ? fy - 1 : fy}-${String(m).padStart(2, "0")}`;
    };
    const asOfMonth = asOf ? `${asOf[3]}-${String(new Date(`${asOf[2]} 1 2000`).getMonth() + 1).padStart(2, "0")}` : null;
    const partial = asOfMonth !== null && monthPeriod(11) > asOfMonth;
    const fyMeta = partial ? { partial: true } : {};
    const start = `${fy - 1}-10-01`;

    if (num(total[2])) row("refugee_ceiling", "nation", "US", "United States", `FY${fy}`, start, num(total[2]));
    row("refugee_admissions", "nation", "US", "United States", `FY${fy}`, start, num(total[3]), fyMeta);
    MONTHS.forEach((_, i) => {
      const p = monthPeriod(i);
      if (asOfMonth && p > asOfMonth) return;
      row("refugee_admissions", "nation", "US", "United States", p, `${p}-01`, num(total[4 + i]));
    });
    // Nationalities: a blank first cell, a name, and a number in the total column.
    const byCountry = new Map();
    for (const r of rows.slice(header + 1)) {
      const name = String(r[1] ?? "").trim();
      if (r[0] || !name || /^Total |^Grand Totals/.test(name) || r[3] === "" || r[3] == null) continue;
      byCountry.set(name, (byCountry.get(name) ?? 0) + num(r[3]));
    }
    const sum = [...byCountry.values()].reduce((a, b) => a + b, 0);
    if (sum !== num(total[3])) throw new Error(`Refugee admissions FY${fy}: nationalities add to ${sum}, total is ${num(total[3])}`);
    for (const [name, value] of byCountry)
      if (value) row("refugee_admissions_by_nationality", "country", slug(name), name, `FY${fy}`, start, value, fyMeta);
    console.log(`  FY${fy}: ${num(total[3])} admitted${partial ? " (partial)" : ""}, ceiling ${num(total[2]) || "—"}`);
  }
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
