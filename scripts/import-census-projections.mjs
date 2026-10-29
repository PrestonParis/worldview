// Imports the Census Bureau's 2023 National Population Projections into
// `area_stats` (source census-projections), nation only, 2022–2100:
//
//   pop_total, share_<group>, median_age     main series (middle scenario);
//                                            race detail ends in 2060
//   pop_total_<s>, share_white_nh_<s>        s = low | high | zero immigration
//   majority_minority_year[_<s>]             first year the non-Hispanic
//                                            white share is under 50%,
//                                            period = projection vintage
//
// Groups match census-pep-race: hispanic and the non-Hispanic single races.
//
// Source: https://www2.census.gov/programs-surveys/popproj/datasets/2023/2023-popproj/
// (np2023_d1_*.csv) — free, no key.
//
// Usage:
//   node scripts/import-census-projections.mjs
//   ENV_FILE=.env.cloud node scripts/import-census-projections.mjs

import { fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "census-projections";
const VINTAGE = 2023;
const ROOT = `https://www2.census.gov/programs-surveys/popproj/datasets/${VINTAGE}/${VINTAGE}-popproj`;
const SCENARIOS = { "": "mid", low: "low", high: "hi", zero: "zero" };
// [ORIGIN, RACE] per group; RACE 1–6 = White, Black, AIAN, Asian, NHPI,
// two or more (alone), 0 = all races.
const GROUPS = {
  hispanic: [2, 0], white_nh: [1, 1], black_nh: [1, 2], aian_nh: [1, 3], asian_nh: [1, 4], nhpi_nh: [1, 5], multiracial_nh: [1, 6],
};
const round = (v, d = 2) => Math.round(v * 10 ** d) / 10 ** d;

function medianAge(r) {
  const total = Number(r.TOTAL_POP);
  let cum = 0;
  for (let age = 0; age <= 100; age++) {
    const n = Number(r[`POP_${age}`]);
    if (cum + n >= total / 2) return round(age + (total / 2 - cum) / n, 1);
    cum += n;
  }
  return null;
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  const row = (metric, period, value, unit, metadata = {}) =>
    out.push({
      source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States",
      period: String(period), period_start: `${period}-07-01`, value, unit, metadata: { vintage: VINTAGE, ...metadata },
    });
  for (const [suffix, file] of Object.entries(SCENARIOS)) {
    const rows = parseCsv(await (await fetchRetry(`${ROOT}/np${VINTAGE}_d1_${file}.csv`)).text()).filter((r) => r.SEX === "0");
    const cell = new Map(rows.map((r) => [`${r.ORIGIN}:${r.RACE}:${r.YEAR}`, r]));
    const years = [...new Set(rows.map((r) => Number(r.YEAR)))].sort((a, b) => a - b);
    const tag = suffix ? `_${suffix}` : "";
    const meta = { scenario: file };
    let crossover = null;
    for (const y of years) {
      const all = cell.get(`0:0:${y}`);
      const total = Number(all.TOTAL_POP);
      row(`pop_total${tag}`, y, total, "people", meta);
      for (const [g, [o, race]] of Object.entries(GROUPS)) {
        const r = cell.get(`${o}:${race}:${y}`);
        if ((suffix && g !== "white_nh") || !r) continue;
        const share = round((Number(r.TOTAL_POP) / total) * 100);
        row(`share_${g}${tag}`, y, share, "percent", meta);
        if (g === "white_nh" && share < 50 && crossover === null) crossover = y;
      }
      if (!suffix) row("median_age", y, medianAge(all), "years", meta);
    }
    if (crossover !== null) row(`majority_minority_year${tag}`, VINTAGE, crossover, "year", meta);
    console.log(`  ${file}: ${years[0]}–${years.at(-1)}, white non-Hispanic under 50% from ${crossover ?? "never"}`);
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: String(VINTAGE) };
});
