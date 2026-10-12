// Imports the UN Population Division's International Migrant Stock
// (destination × origin, both sexes) into `area_stats` (source
// 'un-migrant-stock', period = mid-year, 1990–2024 in 5-year steps), for
// people born in the United States living elsewhere:
//   emigrants_total        nation 'US'
//   emigrants_by_country   geo_level 'country', geoid = UN M49 code
//   emigrants_by_region    geo_level 'region',  geoid = UN M49 code (SDG regions)
// plus the reverse total, immigrants_total (everyone living in the U.S. who
// was born abroad), for scale.
//
// Source: https://www.un.org/development/desa/pd/content/international-migrant-stock
// — free, no key. The UN's server refuses non-browser user agents.
//
// Usage:
//   node scripts/import-un-migrant-stock.mjs [--url=<xlsx of a newer revision>]
//   ENV_FILE=.env.cloud node scripts/import-un-migrant-stock.mjs

import { arg, fetchRetry, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const URL_2024 =
  "https://www.un.org/development/desa/pd/sites/www.un.org.development.desa.pd/files/undesa_pd_2024_ims_stock_by_sex_destination_and_origin.xlsx";
const SOURCE = "un-migrant-stock";
const US = 840;
const WORLD = 900;
// SDG regions — the UN's own partition of the world into eight.
const SDG_REGIONS = new Set([1829, 1830, 1831, 1832, 1833, 1834, 1835, 1836]);

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const url = arg("url", URL_2024);
  const res = await fetchRetry(url, { headers: { "User-Agent": "Mozilla/5.0" }, timeoutMs: 300_000 }, { label: "UN migrant stock" });
  const rows = readXlsx(Buffer.from(await res.arrayBuffer()))["Table 1"];

  // Header: Index, destination, coverage, data type, destination code,
  // origin, origin code, then years for both sexes, then males, females.
  const h = rows.findIndex((r) => r[0] === "Index");
  const header = rows[h];
  const years = [];
  for (let c = 7; typeof header[c] === "number" && !years.some(([y]) => y === header[c]); c++) years.push([header[c], c]);
  if (years.length < 5) throw new Error(`unexpected header: ${JSON.stringify(header.slice(0, 12))}`);

  const name = (s) => String(s).replace(/\*+$/, "").trim();
  const out = [];
  const push = (metric, level, geoid, geoName, r) => {
    for (const [y, c] of years) {
      if (typeof r[c] !== "number") continue;
      out.push({
        source: SOURCE, metric, geo_level: level, geoid: String(geoid), geo_name: geoName,
        period: String(y), period_start: `${y}-07-01`, value: r[c], unit: "people", metadata: null,
      });
    }
  };
  for (const r of rows.slice(h + 1)) {
    const [dest, origin] = [r[4], r[6]];
    if (origin === US) {
      if (dest === WORLD) push("emigrants_total", "nation", "US", "United States", r);
      else if (SDG_REGIONS.has(dest)) push("emigrants_by_region", "region", dest, name(r[1]), r);
      // Country rows carry a data-type code; aggregates don't.
      else if (r[3] && dest < WORLD) push("emigrants_by_country", "country", dest, name(r[1]), r);
    } else if (dest === US && origin === WORLD) {
      push("immigrants_total", "nation", "US", "United States", r);
    }
  }
  const countries = new Set(out.filter((o) => o.metric === "emigrants_by_country").map((o) => o.geoid)).size;
  if (countries < 100) throw new Error(`only ${countries} destination countries parsed`);
  console.log(`  ${countries} countries, years ${years.map(([y]) => y).join(", ")}`);

  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"], {
    batchSize: 1000,
  });
  return { inserted, cursor: `Rev.${years.at(-1)[0]}` };
});
