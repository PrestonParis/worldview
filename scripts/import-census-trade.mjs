// Imports U.S. trade in goods with partner countries from the
// Census Bureau's country pages (foreign-trade/balance/c<code>.html) into
// `area_stats` (source 'census-trade', geo_level 'country', geoid = ISO
// alpha-3), monthly ('2025-03') and calendar-year ('2025') rows:
//   exports   U.S. goods exports to the country
//   imports   U.S. goods imports from the country
//   balance   exports minus imports (negative is a U.S. deficit)
//
// Census publishes an index of every partner page. We join its country names
// to the ISO alpha-3 codes in the official ForeignAssistance.gov country
// summary, avoiding a second hand-maintained country list. The current year
// is partial (metadata.months says how many months it covers).
//
// Source: https://www.census.gov/foreign-trade/balance/ — free, no key.
//
// Usage:
//   node scripts/import-census-trade.mjs [--only=ISR]
//   ENV_FILE=.env.cloud node scripts/import-census-trade.mjs

import { arg, fetchJson, fetchRetry, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { htmlTables } from "./lib/html.mjs";

const SOURCE = "census-trade";
const INDEX = "https://www.census.gov/foreign-trade/balance/";
const AID_COUNTRIES = "https://foreignassistance.gov/api/data-api/by-country.json";
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const millions = (s) => Math.round(Number(String(s).replace(/,/g, "")) * 1e6);
const normalized = (name) => name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, " ").trim();

async function partners() {
  const [index, first] = await Promise.all([
    fetchRetry(INDEX, {}, { label: "Census trade partner index" }).then((r) => r.text()),
    fetchJson(`${AID_COUNTRIES}?page=1&per_page=1000`, { headers: { Accept: "application/json" } }, { label: "ForeignAssistance.gov country codes page 1" }),
  ]);
  const aidRows = [...(first?.data ?? [])];
  for (let page = 2; page <= Number(first?.page_info?.total_pages ?? 1); page++) {
    const payload = await fetchJson(`${AID_COUNTRIES}?page=${page}&per_page=1000`, { headers: { Accept: "application/json" } }, { label: `ForeignAssistance.gov country codes page ${page}` });
    aidRows.push(...(payload?.data ?? []));
  }
  const iso = new Map();
  for (const row of aidRows) {
    const code = String(row.country_code ?? "").toUpperCase();
    if (/^[A-Z]{3}$/.test(code) && code !== "WLD") iso.set(normalized(row.country_name), code);
  }
  // Census and State use a few different short names.
  for (const [name, code] of Object.entries({
    Burma: "MMR", "Korea South": "KOR", "Korea North": "PRK", Russia: "RUS",
    "Congo": "COG", "Democratic Republic of Congo": "COD", "Cote d Ivoire": "CIV",
    "Czech Republic": "CZE", Bolivia: "BOL", Venezuela: "VEN", Tanzania: "TZA",
    Laos: "LAO", Iran: "IRN", Syria: "SYR", Turkey: "TUR", Taiwan: "TWN",
    "Micronesia Federated States of": "FSM", "West Bank and Gaza": "PSE",
    // No U.S. aid program, so not in the ForeignAssistance.gov list.
    China: "CHN", "Hong Kong": "HKG", Macau: "MAC",
  })) iso.set(normalized(name), code);

  const found = new Map();
  for (const match of index.matchAll(/c(\d{4})\.html['"]?>([^<]+)/g)) {
    const [, code, rawName] = match;
    const name = rawName.replaceAll("&amp;", "&").trim();
    const country = iso.get(normalized(name));
    if (country && !found.has(country)) found.set(country, [code, name]);
  }
  return Object.fromEntries(found);
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const only = arg("only", "");
  const PARTNERS = await partners();
  if (Object.keys(PARTNERS).length < 100) throw new Error(`Census: only ${Object.keys(PARTNERS).length} partner countries matched`);
  console.log(`  matched ${Object.keys(PARTNERS).length} Census partner countries to ISO codes`);
  const out = [];
  for (const [iso, [code, name]] of Object.entries(PARTNERS)) {
    if (only && only !== iso) continue;
    const html = await (await fetchRetry(`https://www.census.gov/foreign-trade/balance/c${code}.html`, {}, { label: name })).text();
    const row = (metric, period, periodStart, value, metadata = null) =>
      out.push({ source: SOURCE, metric, geo_level: "country", geoid: iso, geo_name: name, period, period_start: periodStart, value, unit: "usd", metadata });
    let years = 0;
    for (const t of htmlTables(html)) {
      if (t[0]?.join("|") !== "Month|Exports|Imports|Balance") continue;
      let months = 0;
      for (const [label, exp, imp, bal] of t.slice(1)) {
        const m = /^(\w+) (\d{4})$/.exec(label);
        const total = /^TOTAL (\d{4})$/.exec(label);
        if (m && MONTHS.includes(m[1])) {
          const period = `${m[2]}-${String(MONTHS.indexOf(m[1]) + 1).padStart(2, "0")}`;
          row("exports", period, `${period}-01`, millions(exp));
          row("imports", period, `${period}-01`, millions(imp));
          row("balance", period, `${period}-01`, millions(bal));
          months++;
        } else if (total) {
          const meta = { months };
          row("exports", total[1], `${total[1]}-01-01`, millions(exp), meta);
          row("imports", total[1], `${total[1]}-01-01`, millions(imp), meta);
          row("balance", total[1], `${total[1]}-01-01`, millions(bal), meta);
          years++;
        }
      }
    }
    if (!years) throw new Error(`${name}: no annual rows parsed`);
    console.log(`  ${name}: ${years} years`);
    // The HTML service throttles sustained crawls at roughly 30 requests per
    // minute. Keep the weekly full import below that ceiling.
    await sleep(2250);
  }
  if (!out.length) throw new Error(`No Census trade rows parsed${only ? ` for ${only}` : ""}`);
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"], { batchSize: 1000 });
  return { inserted };
});
