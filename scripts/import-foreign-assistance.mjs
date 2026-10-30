// Imports the official ForeignAssistance.gov country summary into area_stats.
// Country rows use ISO alpha-3 codes; national rows aggregate every reported
// geographic recipient so the page can show the full program over time.
//
// Source: https://foreignassistance.gov/api-docs — no key required.

// Usage:
//   node scripts/import-foreign-assistance.mjs

import { fetchJson, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "foreign-assistance";
const URL = "https://foreignassistance.gov/api/data-api/by-country.json";

const metricFor = (transaction, constant) => {
  const base = transaction === "Obligations" ? "obligations" : transaction === "Disbursements" ? "disbursements" : null;
  return base ? `${base}${constant ? "_constant" : ""}` : null;
};
const fiscalPeriod = (raw) => {
  const year = /^(\d{4})$/.exec(String(raw));
  if (year) return { period: `FY${year[1]}`, start: `${year[1]}-01-01` };
  if (String(raw).toLowerCase() === "1976tq") return { period: "FY1976-TQ", start: "1976-07-01" };
  return null;
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const first = await fetchJson(`${URL}?page=1&per_page=1000`, { headers: { Accept: "application/json" } }, { label: "ForeignAssistance.gov country summary page 1" });
  if (!Array.isArray(first?.data)) throw new Error("ForeignAssistance.gov returned no data array");
  const pages = Number(first.page_info?.total_pages ?? 1);
  const payloads = [first];
  for (let page = 2; page <= pages; page++) {
    payloads.push(await fetchJson(`${URL}?page=${page}&per_page=1000`, { headers: { Accept: "application/json" } }, { label: `ForeignAssistance.gov country summary page ${page}` }));
  }
  const data = payloads.flatMap((payload) => payload.data ?? []);
  if (data.length !== Number(first.page_info?.total_records ?? data.length)) throw new Error(`ForeignAssistance.gov: expected ${first.page_info?.total_records} records, received ${data.length}`);

  const rows = [];
  const totals = new Map();
  for (const record of data) {
    const fiscal = fiscalPeriod(record.fiscal_year);
    const code = String(record.country_code ?? "").toUpperCase();
    const name = String(record.country_name ?? "").trim();
    const metadata = {
      region: record.region_name ?? null,
      income_group: record.income_group_name ?? null,
      transaction_type: record.transaction_type_name,
    };

    for (const constant of [false, true]) {
      const metric = metricFor(record.transaction_type_name, constant);
      const value = Number(constant ? record.constant_amount : record.current_amount);
      if (!metric || !fiscal || !Number.isFinite(value)) continue;

      // Regional recipients remain part of the national total, but only true
      // ISO country codes become country-index rows.
      const key = `${metric}\u0000${fiscal.period}\u0000${fiscal.start}`;
      totals.set(key, (totals.get(key) ?? 0) + value);
      if (/^[A-Z]{3}$/.test(code) && code !== "WLD" && !/ region$/i.test(name)) {
        rows.push({
          source: SOURCE,
          metric,
          geo_level: "country",
          geoid: code,
          geo_name: name,
          period: fiscal.period,
          period_start: fiscal.start,
          value,
          unit: "usd",
          metadata,
        });
      }
    }
  }

  for (const [key, value] of totals) {
    const [metric, period, start] = key.split("\u0000");
    rows.push({
      source: SOURCE,
      metric,
      geo_level: "nation",
      geoid: "US",
      geo_name: "United States",
      period,
      period_start: start,
      value,
      unit: "usd",
      metadata: { basis: "Sum of all geographic recipients in the country summary" },
    });
  }

  if (rows.length < 1_000) throw new Error(`ForeignAssistance.gov: only ${rows.length} observations parsed`);
  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, ["source", "metric", "geo_level", "geoid", "period"], { batchSize: 1_000 });
  return { inserted };
});
