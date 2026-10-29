// Imports Current Population Survey series that FRED doesn't carry from the
// BLS Public Data API (v1, keyless: 25 requests a day, 10 years each) into
// `area_stats` (source bls-cps), nation, monthly, seasonally adjusted:
//
//   lfpr_prime_age_men, lfpr_prime_age_women   labor force participation, 25–54
//   epop_prime_age_men, epop_prime_age_women   employment-population ratio, 25–54
//
// Usage:
//   node scripts/import-bls-cps.mjs [--from=1948]
//   ENV_FILE=.env.cloud node scripts/import-bls-cps.mjs

import { arg, fetchJson, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "bls-cps";
const FROM = Number(arg("from", "1948"));
const SERIES = {
  LNS11300061: "lfpr_prime_age_men",
  LNS11300062: "lfpr_prime_age_women",
  LNS12300061: "epop_prime_age_men",
  LNS12300062: "epop_prime_age_women",
};

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  const thisYear = new Date().getFullYear();
  for (let start = FROM; start <= thisYear; start += 10) {
    const res = await fetchJson("https://api.bls.gov/publicAPI/v1/timeseries/data/", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ seriesid: Object.keys(SERIES), startyear: String(start), endyear: String(Math.min(start + 9, thisYear)) }),
    });
    if (res.status !== "REQUEST_SUCCEEDED") throw new Error(`BLS ${start}: ${res.status} ${JSON.stringify(res.message)}`);
    for (const s of res.Results.series) {
      for (const d of s.data) {
        if (!/^M(0[1-9]|1[0-2])$/.test(d.period) || d.value === "-") continue;
        const period = `${d.year}-${d.period.slice(1)}`;
        out.push({
          source: SOURCE, metric: SERIES[s.seriesID], geo_level: "nation", geoid: "US", geo_name: "United States",
          period, period_start: `${period}-01`, value: Number(d.value), unit: "percent", metadata: { series: s.seriesID },
        });
      }
    }
    await sleep(500);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  console.log(`  ${out.length} rows`);
  return { inserted };
});
