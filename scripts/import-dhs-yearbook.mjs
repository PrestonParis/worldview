// Imports the DHS Yearbook of Immigration Statistics (OHSS) into
// `area_stats` — legal immigration and humanitarian admissions by fiscal
// year (period 'FY2024'):
//   lpr_total                     nation 1820–, state (FIPS geoid) last 10 FYs
//   lpr_adjustments, lpr_new_arrivals                       nation, 10 FYs
//   lpr_by_region / lpr_by_country / lpr_by_class           10 FYs
//   naturalizations_total, naturalization_applications,
//   naturalization_denials        nation 1907–; naturalizations_total by state
//   naturalizations_by_region / _by_country
//   refugee_arrivals              nation 1980–; _by_region / _by_country
//   asylum_grants_total / _affirmative / _defensive          nation 1990–
//   asylum_affirmative_by_region / _by_country
// Breakdown rows use geo_level 'region' | 'country' | 'class' with a slug
// geoid and the DHS label as geo_name (CBP's citizenship rows do the same).
//
// The yearbook page links one workbook per chapter; the newest yearbook is
// discovered from the index. Table numbers and layouts have been stable
// since FY2022; a header that doesn't match fails loudly.
//
// Source: https://ohss.dhs.gov/topics/immigration/yearbook — free.
//
// Usage:
//   node scripts/import-dhs-yearbook.mjs [--year=2024]
//   ENV_FILE=.env.cloud node scripts/import-dhs-yearbook.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const BASE = "https://ohss.dhs.gov";
const HEADERS = { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) Chrome/128 Safari/537.36" };
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
// "Children1" / "Other1" / "Total " -> footnote markers and padding removed.
const label = (s) => String(s ?? "").replace(/(?<=[a-z)])\d+$/, "").trim();
const yearOf = (v) => {
  const y = Number.parseInt(String(v ?? ""), 10);
  return y >= 1800 && y <= 2100 ? y : null;
};
const count = (v) => (typeof v === "number" && Number.isFinite(v) ? v : null);
// Fiscal years ended June 30 until 1976, September 30 after.
const fyStart = (y) => (y <= 1976 ? `${y - 1}-07-01` : `${y - 1}-10-01`);

async function html(url) {
  return (await fetchRetry(url, { headers: HEADERS }, { label: url })).text();
}

async function workbooks(year) {
  const page = await html(`${BASE}/topics/immigration/yearbook/${year}`);
  const files = [...page.matchAll(/href="([^"]+\.xlsx)"/g)].map((m) => new URL(m[1], BASE).href);
  const find = (re) => files.find((f) => re.test(f));
  return {
    lpr: find(/lawful_permanent_residents/i),
    naturalizations: find(/naturalizations/i),
    refugees: find(/refugees/i),
    asylees: find(/asylees/i),
  };
}

async function latestYear() {
  const page = await html(`${BASE}/topics/immigration/yearbook`);
  return Math.max(...[...page.matchAll(/yearbook\/(\d{4})"/g)].map((m) => Number(m[1])));
}

// Finds the header row (first cell matching `first`) and returns the data
// rows below it, stopping at the footnotes.
function table(book, name, first) {
  const sheet = book[name];
  if (!sheet) throw new Error(`missing sheet "${name}"`);
  const h = sheet.findIndex((r) => first.test(String(r[0] ?? "")));
  if (h < 0) throw new Error(`"${name}": header ${first} not found`);
  const body = [];
  for (const r of sheet.slice(h + 1)) {
    const c = String(r[0] ?? "");
    if (/^(notes?|source|NA |X |D |-|\d+ )/i.test(c) && !yearOf(c)) break;
    body.push(r);
  }
  return { header: sheet[h], body };
}

function parseYearColumns(t) {
  // [label, 2015, 2016, ...] wide tables -> { years: [[colIndex, year]], rows }
  const years = t.header.map((v, i) => [i, yearOf(v)]).filter(([i, y]) => i > 0 && y);
  if (!years.length) throw new Error(`no year columns in ${JSON.stringify(t.header)}`);
  return years;
}

await runImport("dhs-yearbook", async (pg) => {
  await registerDataset(pg, "dhs-yearbook");
  const year = Number(arg("year", "")) || (await latestYear());
  const urls = await workbooks(year);
  console.log(`  yearbook FY${year}`);
  const out = [];
  const row = (metric, geoLevel, geoid, geoName, y, value, unit = "people") => {
    if (value === null) return;
    out.push({
      source: "dhs-yearbook", metric, geo_level: geoLevel, geoid, geo_name: geoName,
      period: `FY${y}`, period_start: fyStart(y), value, unit, metadata: { yearbook: year },
    });
  };
  const nation = (metric, y, value, unit) => row(metric, "nation", "US", "United States", y, value, unit);

  // Long single-series history: Table 1 (LPRs, 4 year/number column pairs),
  // Table 13 (refugees), Table 16 (asylum), Table 21 (naturalizations).
  // Wide 10-year tables: by region + country (REGION / COUNTRY sections) and
  // by state of residence.
  const byRegionCountry = (t, regionMetric, countryMetric) => {
    const years = parseYearColumns(t);
    let section = null;
    for (const r of t.body) {
      const name = label(r[0]);
      if (name === "REGION" || name === "COUNTRY") {
        section = name;
        continue;
      }
      if (!section || !name || name === "Total") continue;
      for (const [i, y] of years) {
        if (section === "REGION") row(regionMetric, "region", slug(name), name, y, count(r[i]));
        else row(countryMetric, "country", slug(name), name, y, count(r[i]));
      }
    }
  };
  const byState = (t, metric) => {
    const years = parseYearColumns(t);
    for (const r of t.body) {
      const abbr = STATE_NAME_TO_ABBR[label(r[0])];
      if (!abbr || !STATE_FIPS[abbr]) continue;
      for (const [i, y] of years) row(metric, "state", STATE_FIPS[abbr], label(r[0]), y, count(r[i]));
    }
  };
  const load = async (url) => {
    if (!url) throw new Error("workbook link not found on the yearbook page");
    console.log(`  ${url}`);
    return readXlsx(Buffer.from(await (await fetchRetry(url, { headers: HEADERS })).arrayBuffer()));
  };

  // --- Lawful permanent residents
  const lpr = await load(urls.lpr);
  for (const r of table(lpr, "Table 1", /^Year$/).body) {
    for (let i = 0; i + 1 < r.length; i += 2) {
      const y = yearOf(r[i]);
      if (y) nation("lpr_total", y, count(r[i + 1]));
    }
  }
  byRegionCountry(table(lpr, "Table 3", /^Region and country/i), "lpr_by_region", "lpr_by_country");
  byState(table(lpr, "Table 4", /^State or territory/i), "lpr_total");
  {
    const t = table(lpr, "Table 6", /^Type and class/i);
    const years = parseYearColumns(t);
    let section = null;
    const totals = {};
    for (const r of t.body) {
      const name = label(r[0]);
      if (/^[A-Z ,]+$/.test(name) && name.length > 3) {
        section = name; // TOTAL | ADJUSTMENTS OF STATUS | NEW ARRIVALS
        continue;
      }
      if (name === "Total") {
        totals[section] = r;
        continue;
      }
      // Top-level classes only; preference tiers and the immediate-relative
      // split are their parents' children.
      if (section !== "TOTAL" || /^(First|Second|Third|Fourth|Fifth):|^(Spouses|Children|Parents)$/.test(name)) continue;
      for (const [i, y] of years) row("lpr_by_class", "class", slug(name), name, y, count(r[i]));
    }
    for (const [i, y] of years) {
      if (totals["ADJUSTMENTS OF STATUS"]) nation("lpr_adjustments", y, count(totals["ADJUSTMENTS OF STATUS"][i]));
      if (totals["NEW ARRIVALS"]) nation("lpr_new_arrivals", y, count(totals["NEW ARRIVALS"][i]));
    }
  }

  // --- Naturalizations
  const natz = await load(urls.naturalizations);
  {
    const t = table(natz, "Table 21", /^Year$/);
    const col = (re) => t.header.findIndex((h) => re.test(String(h ?? "")));
    const filed = col(/applications filed/i);
    const total = col(/total persons naturalized/i);
    const denied = col(/denied/i);
    for (const r of t.body) {
      const y = yearOf(r[0]);
      if (!y) continue;
      nation("naturalization_applications", y, count(r[filed]), "applications");
      nation("naturalizations_total", y, count(r[total]));
      nation("naturalization_denials", y, count(r[denied]), "applications");
    }
  }
  byRegionCountry(table(natz, "Table 22", /^Region and country/i), "naturalizations_by_region", "naturalizations_by_country");
  byState(table(natz, "Table 23", /^State or territory/i), "naturalizations_total");

  // --- Refugees
  const ref = await load(urls.refugees);
  for (const r of table(ref, "Table 13", /^Year$/).body) {
    const y = yearOf(r[0]);
    if (y) nation("refugee_arrivals", y, count(r[1]));
  }
  byRegionCountry(table(ref, "Table 14", /^Region and country/i), "refugee_arrivals_by_region", "refugee_arrivals_by_country");

  // --- Asylum
  const asy = await load(urls.asylees);
  for (const r of table(asy, "Table 16", /^Year$/).body) {
    const y = yearOf(r[0]);
    if (!y) continue;
    nation("asylum_grants_total", y, count(r[1]));
    nation("asylum_grants_affirmative", y, count(r[2]));
    nation("asylum_grants_defensive", y, count(r[3]));
  }
  byRegionCountry(table(asy, "Table 17", /^Region and country/i), "asylum_affirmative_by_region", "asylum_affirmative_by_country");

  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: `FY${year}` };
});
