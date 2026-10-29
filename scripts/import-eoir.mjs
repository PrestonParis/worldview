// Imports immigration court statistics from the Executive Office for
// Immigration Review (EOIR) into `area_stats` (source eoir), nation, per
// fiscal year (period 'FY2025'; the current year is partial):
//
//   pending_cases, initial_receipts, total_completions       FY2017– (+1983– receipts/completions)
//   asylum_grants, asylum_denials, asylum_abandoned, asylum_not_adjudicated,
//   asylum_withdrawn, asylum_admin_closure, asylum_decisions  FY2016–
//   asylum_grant_rate     grants / (grants + denials), percent
//   asylum_grant_rate_all grants / all asylum decisions, percent
//   asylum_filed_affirmative, asylum_filed_defensive, asylum_filed, asylum_pending
//   removal_orders, removal_orders_in_absentia                current FY only
//
// Source: https://www.justice.gov/eoir/workload-and-adjudication-statistics
// (PDFs read with scripts/lib/pdf.mjs; media ids below change when EOIR
// re-posts a table).
//
// Usage:
//   node scripts/import-eoir.mjs
//   ENV_FILE=.env.cloud node scripts/import-eoir.mjs

import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { pdfLines } from "./lib/pdf.mjs";

const SOURCE = "eoir";
const MEDIA = (id) => `https://www.justice.gov/eoir/media/${id}/dl?inline`;
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
const TABLES = [
  { id: 1344801, header: /^Fiscal Year\tInitial Receipts/, cols: { 1: "initial_receipts", 3: "total_completions" } },
  { id: 1344791, header: /^FY\tPending Cases/, cols: { 1: "pending_cases", 2: "initial_receipts", 3: "total_completions" } },
  {
    id: 1344851,
    header: /^FY\tGrants\tDenials/,
    cols: { 1: "asylum_grants", 2: "asylum_denials", 3: "asylum_abandoned", 4: "asylum_not_adjudicated", 5: "asylum_withdrawn", 6: "asylum_admin_closure", 7: "asylum_decisions" },
  },
  { id: 1344871, header: /^Fiscal Year\tAffirmative Filed/, cols: { 1: "asylum_filed_affirmative", 2: "asylum_filed_defensive", 3: "asylum_filed", 4: "asylum_pending" } },
];
const num = (s) => Number(String(s).replace(/[,()]/g, ""));

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const values = new Map(); // `${metric}|${fy}` -> row
  const add = (metric, fy, value, partial, url) =>
    values.set(`${metric}|${fy}`, {
      source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States", period: `FY${fy}`,
      period_start: `${fy - 1}-10-01`, value, unit: /rate/.test(metric) ? "percent" : "cases", metadata: { url, ...(partial ? { partial: true } : {}) },
    });
  for (const t of TABLES) {
    const url = MEDIA(t.id);
    const lines = await pdfLines(Buffer.from(await (await fetchRetry(url, BROWSER)).arrayBuffer()));
    const h = lines.findIndex((l) => t.header.test(l));
    if (h < 0) throw new Error(`EOIR ${t.id}: header ${t.header} not found`);
    let pendingYear = null; // "2026 (Third" … numbers on the next line
    let n = 0;
    for (const line of lines.slice(h + 1)) {
      const cells = line.split("\t");
      let fy;
      let data;
      if (/^\d{4}$/.test(cells[0]) && cells.length > 1) [fy, data] = [Number(cells[0]), cells];
      else if (/^\d{4}( \(|$)/.test(line) && cells.length === 1) {
        pendingYear = Number(line.slice(0, 4));
        continue;
      } else if (pendingYear && /^[\d,]+$/.test(cells[0])) [fy, data] = [pendingYear, ["", ...cells]];
      else continue;
      const partial = data === cells ? false : true;
      for (const [i, metric] of Object.entries(t.cols)) if (data[i] !== undefined && /^[\d,]+$/.test(data[i])) add(metric, fy, num(data[i]), partial, url);
      pendingYear = null;
      n++;
    }
    if (n < 5) throw new Error(`EOIR ${t.id}: only ${n} rows`);
    console.log(`  ${t.id}: ${n} years`);
  }
  // Grant rates.
  for (const [key, r] of [...values]) {
    if (!key.startsWith("asylum_grants|")) continue;
    const fy = Number(key.split("|")[1]);
    const denials = values.get(`asylum_denials|${fy}`)?.value;
    const all = values.get(`asylum_decisions|${fy}`)?.value;
    if (denials !== undefined) add("asylum_grant_rate", fy, Math.round((r.value / (r.value + denials)) * 1000) / 10, r.metadata.partial, r.metadata.url);
    if (all) add("asylum_grant_rate_all", fy, Math.round((r.value / all) * 1000) / 10, r.metadata.partial, r.metadata.url);
  }
  // Current-year removal orders, from the decision-outcomes chart.
  const outcomesUrl = MEDIA(1344811);
  const outcomes = await pdfLines(Buffer.from(await (await fetchRetry(outcomesUrl, BROWSER)).arrayBuffer()));
  const fy = Number(outcomes.find((l) => /^FY \d{4} Decision Outcomes/.test(l))?.slice(3, 7));
  const removal = outcomes.find((l) => /^Removal\t[\d,]+$/.test(l));
  const absentia = outcomes.find((l) => /^Removal in absentia\t\([\d,]+\)$/.test(l));
  if (fy && removal && absentia) {
    add("removal_orders", fy, num(removal.split("\t")[1]), true, outcomesUrl);
    add("removal_orders_in_absentia", fy, num(absentia.split("\t")[1]), true, outcomesUrl);
  }
  const out = [...values.values()];
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
