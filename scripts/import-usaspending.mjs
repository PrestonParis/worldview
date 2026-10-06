// Imports federal spending by place of performance from USAspending.gov into
// `area_stats`: per fiscal year, per state / county / congressional
// district, split by award category (contracts, grants, direct payments,
// loans, other) plus the total. source = 'usaspending', period = 'FY2025'.
// Also stores per-agency budgetary resources / obligations for the current
// fiscal year (geo_level 'agency').
//
// Source: https://api.usaspending.gov — free, no key.
//
// Usage:
//   node scripts/import-usaspending.mjs [--from-fy=2015] [--levels=state,county,district]
//   ENV_FILE=.env.cloud node scripts/import-usaspending.mjs

import { STATE_FIPS, arg, fetchJson, num, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const CATEGORIES = {
  contracts: ["A", "B", "C", "D"],
  grants: ["02", "03", "04", "05"],
  direct_payments: ["06", "10"],
  loans: ["07", "08"],
  other_assistance: ["09", "11"],
};
const now = new Date();
const CURRENT_FY = now.getMonth() >= 9 ? now.getFullYear() + 1 : now.getFullYear();
const FROM_FY = Number(arg("from-fy", "2015"));
const LEVELS = arg("levels", "state,county,district").split(",");
const KEY = ["source", "metric", "geo_level", "geoid", "period"];

function geoid(level, code) {
  if (level === "state") return STATE_FIPS[code] ?? code;
  return code;
}

await runImport("usaspending", async (pg) => {
  await registerDataset(pg, "usaspending");
  let total = 0;
  for (let fy = FROM_FY; fy <= CURRENT_FY; fy++) {
    for (const level of LEVELS) {
      const sums = new Map(); // geoid -> {name, total}
      const rows = [];
      for (const [category, codes] of Object.entries(CATEGORIES)) {
        const data = await fetchJson(
          "https://api.usaspending.gov/api/v2/search/spending_by_geography/",
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              scope: "place_of_performance",
              geo_layer: level,
              filters: {
                time_period: [{ start_date: `${fy - 1}-10-01`, end_date: `${fy}-09-30` }],
                award_type_codes: codes,
              },
            }),
          },
          { label: `usaspending ${level} FY${fy} ${category}` },
        );
        for (const r of data.results ?? []) {
          if (!r.shape_code) continue;
          const id = geoid(level, r.shape_code);
          const amount = num(r.aggregated_amount);
          rows.push({
            source: "usaspending", metric: `federal_${category}`, geo_level: level === "district" ? "cd" : level,
            geoid: id, geo_name: r.display_name, period: `FY${fy}`, period_start: `${fy - 1}-10-01`,
            value: amount, unit: "usd", metadata: null,
          });
          const s = sums.get(id) ?? { name: r.display_name, total: 0, population: num(r.population) };
          s.total += amount ?? 0;
          sums.set(id, s);
        }
      }
      for (const [id, s] of sums) {
        rows.push({
          source: "usaspending", metric: "federal_spending_total", geo_level: level === "district" ? "cd" : level,
          geoid: id, geo_name: s.name, period: `FY${fy}`, period_start: `${fy - 1}-10-01`,
          value: Math.round(s.total * 100) / 100, unit: "usd",
          metadata: s.population ? { population: s.population, perCapita: Math.round((s.total / s.population) * 100) / 100 } : null,
        });
      }
      if (rows.length) total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
      console.log(`  FY${fy} ${level}: ${sums.size} areas`);
    }
  }

  const agencies = await fetchJson("https://api.usaspending.gov/api/v2/references/toptier_agencies/");
  const rows = (agencies.results ?? []).flatMap((a) =>
    [
      ["agency_budget_authority", a.budget_authority_amount],
      ["agency_obligated", a.obligated_amount],
      ["agency_outlays", a.outlay_amount],
    ].map(([metric, value]) => ({
      source: "usaspending", metric, geo_level: "agency", geoid: a.toptier_code,
      geo_name: a.agency_name, period: `FY${a.active_fy}`, period_start: `${Number(a.active_fy) - 1}-10-01`,
      value: num(value), unit: "usd", metadata: { abbreviation: a.abbreviation, slug: a.agency_slug },
    })),
  );
  if (rows.length) total += await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, KEY);
  console.log(`  ${agencies.results?.length ?? 0} agencies`);
  return { inserted: total };
});
