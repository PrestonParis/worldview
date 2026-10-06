// Imports ICE detention statistics into `area_stats` from the per-fiscal-
// year workbooks ICE publishes: the "Facilities" sheet lists every facility
// in use with its average daily population (ADP) by classification level,
// criminality, and ICE threat level. Rows (period 'FY2026', ...):
//   detained_adp, detained_adp_convicted, detained_adp_no_conviction,
//   detained_adp_mandatory, facilities     nation + state (FIPS geoid)
//   detained_adp, facility_alos            geo_level 'facility'
//
// The current year's file is renamed on every refresh, so the script scrapes
// the detention-management page for links (newest per fiscal year).
//
// Source: https://www.ice.gov/detain/detention-management — free.
//
// Usage:
//   node scripts/import-ice-detention.mjs [--years=2024,2025,2026]
//   ENV_FILE=.env.cloud node scripts/import-ice-detention.mjs

import { STATE_FIPS, arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const PAGE = "https://www.ice.gov/detain/detention-management";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/128 Safari/537.36" };
const ONLY = arg("years", "").split(",").filter(Boolean).map(Number);
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

async function workbookUrls() {
  const html = await (await fetchRetry(PAGE, { headers: HEADERS }, { label: "ice page" })).text();
  const byYear = new Map();
  // FY26_detentionStats07202026.xlsx, FY22-detentionStats.xlsx, ... — the
  // page lists the newest file for a year first.
  for (const [, href, yy] of html.matchAll(/href="([^"]*FY(\d\d)[-_]detentionStats[^"]*\.xlsx)"/gi)) {
    const fy = 2000 + Number(yy);
    if (!byYear.has(fy)) byYear.set(fy, new URL(href, PAGE).href);
  }
  return [...byYear].filter(([fy]) => !ONLY.length || ONLY.includes(fy)).sort(([a], [b]) => a - b);
}

await runImport("ice-detention", async (pg) => {
  await registerDataset(pg, "ice-detention");
  const out = [];
  for (const [fy, url] of await workbookUrls()) {
    const book = readXlsx(Buffer.from(await (await fetchRetry(url, { headers: HEADERS }, { label: `ice FY${fy}` })).arrayBuffer()));
    const sheet = Object.entries(book).find(([name]) => /^facilities/i.test(name.trim()))?.[1];
    const h = sheet?.findIndex((r) => r[0] === "Name") ?? -1;
    if (h < 0) {
      console.log(`  FY${fy}: no Facilities sheet — skipped`);
      continue;
    }
    const col = Object.fromEntries(sheet[h].map((name, i) => [String(name ?? "").trim(), i]));
    const need = ["State", "Level A", "Level D", "ICE Threat Level 1", "No ICE Threat Level", "Mandatory"];
    if (need.some((n) => col[n] === undefined)) throw new Error(`FY${fy}: unexpected Facilities header ${JSON.stringify(sheet[h])}`);
    const alosCol = sheet[h].findIndex((n) => /ALOS/.test(String(n ?? "")));
    const val = (r, name) => Number(r[col[name]]) || 0;
    const period = `FY${fy}`;
    const periodStart = `${fy - 1}-10-01`;
    const base = { source: "ice-detention", period, period_start: periodStart, unit: "people" };
    const states = new Map();
    let n = 0;
    for (const r of sheet.slice(h + 1)) {
      const name = typeof r[0] === "string" ? r[0].trim() : "";
      const st = String(r[col.State] ?? "").trim();
      if (!name || !STATE_FIPS[st]) continue;
      const adp = ["Level A", "Level B", "Level C", "Level D"].reduce((t, c) => t + val(r, c), 0);
      const convicted = val(r, "ICE Threat Level 1") + val(r, "ICE Threat Level 2") + val(r, "ICE Threat Level 3");
      const agg = states.get(st) ?? { adp: 0, convicted: 0, none: 0, mandatory: 0, facilities: 0 };
      agg.adp += adp;
      agg.convicted += convicted;
      agg.none += val(r, "No ICE Threat Level");
      agg.mandatory += val(r, "Mandatory");
      agg.facilities += 1;
      states.set(st, agg);
      const facility = {
        ...base, geo_level: "facility", geoid: `${st}-${slug(name)}`, geo_name: name,
        metadata: { state: STATE_FIPS[st], city: r[col.City] ?? null, type: r[col["Type Detailed"]] ?? null, aor: r[col.AOR] ?? null },
      };
      out.push({ ...facility, metric: "detained_adp", value: adp });
      if (alosCol >= 0 && Number.isFinite(Number(r[alosCol]))) {
        out.push({ ...facility, metric: "facility_alos", value: Number(r[alosCol]), unit: "days" });
      }
      n++;
    }
    const nation = { adp: 0, convicted: 0, none: 0, mandatory: 0, facilities: 0 };
    const push = (geoLevel, geoid, geoName, a) => {
      const g = { ...base, geo_level: geoLevel, geoid, geo_name: geoName, metadata: null };
      out.push(
        { ...g, metric: "detained_adp", value: a.adp },
        { ...g, metric: "detained_adp_convicted", value: a.convicted },
        { ...g, metric: "detained_adp_no_conviction", value: a.none },
        { ...g, metric: "detained_adp_mandatory", value: a.mandatory },
        { ...g, metric: "facilities", value: a.facilities, unit: "facilities" },
      );
    };
    for (const [st, a] of states) {
      push("state", STATE_FIPS[st], st, a);
      for (const k of Object.keys(nation)) nation[k] += a[k];
    }
    push("nation", "US", "United States", nation);
    console.log(`  FY${fy}: ${n} facilities, ADP ${Math.round(nation.adp).toLocaleString()}`);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted };
});
