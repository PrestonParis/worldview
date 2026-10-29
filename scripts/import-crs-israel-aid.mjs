// Imports U.S. aid to Israel by fiscal year, 1949 onward, from the
// Congressional Research Service's "U.S. Foreign Aid to Israel" (RL33222),
// into `area_stats` (source 'crs-israel-aid', geo_level 'country', geoid
// 'ISR', period 'FY1949' …):
//   military          military grants and loans (FMF and its predecessors)
//   economic          economic grants and loans, food aid, refugee
//                     resettlement, Ex-Im Bank loans, schools and hospitals
//   missile_defense   Defense Department missile-defense funding (Arrow
//                     from FY1990; Arrow, David's Sling, Iron Dome, Iron Beam
//                     by program from FY2006: md_arrow, md_arrow_3,
//                     md_davids_sling, md_iron_dome, md_iron_beam)
//   total             the three together
//
// CRS stopped printing a year-by-year table after 2016, so several editions
// are stitched together, each year from one edition (metadata.basis):
//   FY1949–FY1999  2016 edition, Tables B-1/B-2 (CRS appropriation figures;
//                  the 1976 transition quarter is folded into FY1976)
//   FY2000–FY2018  2020 edition, Table A-1 (USAID Greenbook obligations)
//   FY2019–FY2025  2020 and 2025 editions, Table 1 (State/MDA, MOU levels
//                  plus supplementals)
//
// Source: https://www.congress.gov/crs-product/RL33222, read from the HTML
// archive at everycrsreport.com. Free, no key.
//
// Usage:
//   node scripts/import-crs-israel-aid.mjs
//   ENV_FILE=.env.cloud node scripts/import-crs-israel-aid.mjs

import { fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { htmlLines, htmlTables } from "./lib/html.mjs";

const SOURCE = "crs-israel-aid";
const BASE = "https://www.everycrsreport.com/files/";
const EDITIONS = {
  2016: "20161222_RL33222_4cb6836e32617afe209db00c655677d0a70ca55f.html",
  2020: "2020-11-16_RL33222_14e84ea163b1e3a6ea037a815f455382b8102fad.html",
  2025: "2025-05-28_RL33222_5306b5d4e077538d2db80d05cd10ca8c08501669.html",
};

const page = async (edition) =>
  (await fetchRetry(BASE + EDITIONS[edition], {}, { label: `CRS RL33222 (${edition})` })).text();

// "1,234.5" → 1234.5; dashes and footnote letters (under $50,000) → 0.
const amount = (s) => {
  const t = String(s ?? "").replace(/[$,\s]/g, "").replace(/[a-z]+$/i, "");
  return /^-?\d+(\.\d+)?$/.test(t) ? Number(t) : 0;
};

// CRS's text tables split decimals into their own tag ("68,030" ".9") and
// sometimes run two cells together ("46,418.1 75,684.5").
function tokens(lines) {
  const out = [];
  for (const raw of lines) {
    for (const t of raw.split(" ")) {
      if (/^\.\d/.test(t) && /\d$/.test(out.at(-1) ?? "")) out[out.length - 1] += t;
      else out.push(t);
    }
  }
  return out;
}

// The rows of a text table: each `year` token followed by `width` cells.
function yearRows(toks, from, width, years) {
  const rows = new Map();
  for (let i = from; i < toks.length && rows.size < years.length; i++) {
    if (years.includes(toks[i]) && !rows.has(toks[i])) {
      rows.set(toks[i], toks.slice(i + 1, i + 1 + width));
      i += width;
    }
  }
  return rows;
}

const span = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));
const at = (toks, heading, nth = 1) => {
  let seen = 0;
  const i = toks.findIndex((t, j) => t === "Table" && toks[j + 1] === heading && ++seen === nth);
  if (i < 0) throw new Error(`table ${heading} not found`);
  return i;
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const years = new Map(); // FY → { military, economic, missile_defense, basis, md_* }
  const year = (fy) => years.get(fy) ?? years.set(fy, { military: 0, economic: 0, missile_defense: 0 }).get(fy);

  // ---- FY1949–FY1999: 2016 edition, B-2 (by type) and B-1 (recent years).
  const t16 = tokens(htmlLines(await page(2016)));
  // Second "Table B-2." is the table itself; the first is the contents list.
  const b2 = yearRows(t16, at(t16, "B-2.", 2), 7, [...span(1949, 1996), "TQ"]);
  if (b2.size !== 49) throw new Error(`Table B-2: ${b2.size} of 49 rows`);
  for (const [y, [total, milLoan, milGrant]] of b2) {
    const fy = y === "TQ" ? 1976 : Number(y);
    const r = year(fy);
    const military = amount(milLoan) + amount(milGrant);
    r.military += military;
    r.economic += amount(total) - military;
    r.basis = "crs-appropriations-2016";
  }
  const b1 = yearRows(t16, at(t16, "B-1.", 2), 6, span(1997, 1999));
  for (const [y, [total, milGrant]] of b1) {
    const r = year(Number(y));
    r.military = amount(milGrant);
    r.economic = amount(total) - r.military;
    r.basis = "crs-appropriations-2016";
  }

  // ---- FY2000–FY2018: 2020 edition, A-1 (Greenbook obligations); FY2019–20: Table 1.
  const t20 = tokens(htmlLines(await page(2020)));
  const a1 = yearRows(t20, at(t20, "A-1.", 2), 3, span(2000, 2018));
  if (a1.size !== 19) throw new Error(`Table A-1: ${a1.size} of 19 rows`);
  for (const [y, [economic, military]] of a1) {
    const r = year(Number(y));
    r.economic = amount(economic);
    r.military = amount(military);
    r.basis = "greenbook-obligations-2020";
  }
  const t1of20 = yearRows(t20, at(t20, "1.", 2), 4, ["2019", "2020"]);
  for (const [y, [military, economic]] of t1of20) {
    const r = year(Number(y));
    r.military = amount(military);
    r.economic = amount(economic);
    r.basis = "crs-table-1-2020";
  }

  // ---- FY2021–FY2025 and missile defense: 2025 edition's real tables.
  const tables = htmlTables(await page(2025));
  const find = (pred, what) => {
    const t = tables.find(pred);
    if (!t) throw new Error(`2025 edition: no ${what} table`);
    return t;
  };
  const totals = find((t) => t[0]?.join("|") === "Fiscal Year|Military|Economic|Missile Defense|Total", "Table 1");
  for (const [y, military, economic] of totals) {
    if (!/^\d{4}$/.test(y) || Number(y) < 2021) continue;
    const r = year(Number(y));
    r.military = amount(military);
    r.economic = amount(economic);
    r.basis = "crs-table-1-2025";
  }

  // Arrow by year since FY1990 (Table 4, laid out in three column pairs);
  // it is the only missile-defense program before FY2006.
  const arrow = find((t) => t[0]?.join("|") === "Fiscal Year|Total|Fiscal Year|Total|Fiscal Year|Total", "Arrow");
  const arrowByYear = new Map();
  for (const row of arrow) for (let c = 0; c + 1 < row.length; c += 2) if (/^\d{4}$/.test(row[c])) arrowByYear.set(Number(row[c]), amount(row[c + 1]));
  for (const [fy, v] of arrowByYear) if (fy < 2006) year(fy).missile_defense = v;

  // By program since FY2006 (Table 5); the FY2024 supplemental row adds to FY2024.
  const md = find((t) => t[0]?.[0] === "Fiscal Year" && t[0]?.includes("Iron Dome"), "Table 5");
  const programs = [
    ["Arrow II", "md_arrow"],
    ["Arrow III (High Altitude)", "md_arrow_3"],
    ["David's Sling (Short-Range)", "md_davids_sling"],
    ["Iron Dome", "md_iron_dome"],
    ["Iron Beam", "md_iron_beam"],
  ].map(([label, key]) => [md[0].indexOf(label), key]);
  const totalCol = md[0].indexOf("Total");
  for (const row of md.slice(1)) {
    const m = /^FY(\d{4})/.exec(row[0]);
    if (!m) continue;
    const r = year(Number(m[1]));
    if (!/Supp/.test(row[0])) r.missile_defense = 0;
    r.missile_defense += amount(row[totalCol]);
    for (const [col, key] of programs) if (col >= 0) r[key] = (r[key] ?? 0) + amount(row[col]);
  }

  // Table 1's missile-defense column is the check on Table 5 for FY2021+.
  for (const [y, , , mdTotal] of totals) {
    if (!/^\d{4}$/.test(y) || Number(y) < 2021) continue;
    const got = years.get(Number(y)).missile_defense;
    if (Math.abs(got - amount(mdTotal)) > 1) throw new Error(`FY${y} missile defense: Table 5 says ${got}, Table 1 says ${amount(mdTotal)}`);
  }

  const out = [];
  for (const [fy, r] of [...years].sort((a, b) => a[0] - b[0])) {
    const values = { ...Object.fromEntries(Object.entries(r).filter(([k]) => k !== "basis")), total: r.military + r.economic + r.missile_defense };
    for (const [metric, v] of Object.entries(values)) {
      out.push({
        source: SOURCE, metric, geo_level: "country", geoid: "ISR", geo_name: "Israel",
        period: `FY${fy}`, period_start: `${fy - 1}-10-01`, value: Math.round(v * 1e6), unit: "usd",
        metadata: { basis: r.basis },
      });
    }
  }
  const first = Math.min(...years.keys());
  const last = Math.max(...years.keys());
  if (years.size !== last - first + 1) throw new Error(`gaps in FY${first}–FY${last}`);
  const sum = out.filter((o) => o.metric === "total").reduce((s, o) => s + o.value, 0);
  console.log(`  FY${first}–FY${last}, total $${(sum / 1e9).toFixed(1)}B current dollars`);

  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: `FY${last}` };
});
