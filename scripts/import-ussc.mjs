// Imports the U.S. Sentencing Commission's Sourcebook tables on who is
// sentenced in federal court into `area_stats` (source ussc-sourcebook),
// per fiscal year 2016 onward:
//
//   sentenced_total, sentenced_citizen, sentenced_noncitizen,
//   noncitizen_share                                       (Table 9)
//   sentenced_race_total, sentenced_white, sentenced_black,
//   sentenced_hispanic, sentenced_other, + _share           (Table 5)
//
// geo_level 'nation' = all federal cases; geo_level 'offense', geoid = the
// offense category slug (category names changed in FY2018; a few old names
// are mapped to the new ones in ALIASES).
//
// Source: https://www.ussc.gov/research/sourcebook — PDF tables, read with
// scripts/lib/pdf.mjs and matched by title.
//
// Usage:
//   node scripts/import-ussc.mjs [--years=2016-2025]
//   ENV_FILE=.env.cloud node scripts/import-ussc.mjs

import { arg, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { pdfLines } from "./lib/pdf.mjs";

const SOURCE = "ussc-sourcebook";
const [FROM, TO] = arg("years", "2016-2025").split("-").map(Number);
const url = (year, n) =>
  `https://www.ussc.gov/sites/default/files/pdf/research-and-publications/annual-reports-and-sourcebooks/${year}/Table${String(n).padStart(2, "0")}.pdf`;
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };

// Old (FY2016–17) category names -> current ones, where they are the same offense.
const ALIASES = {
  "drugs_trafficking": "drug_trafficking", "kidnapping_hostage_taking": "kidnapping", "burglary_b_e": "burglary_trespass",
  "administration_of_justice_offenses": "administration_of_justice", "environmental_wildlife": "environmental",
  "food_drug": "food_and_drug", "racketeering_extortion": "extortion_racketeering", "drugs_simple_possession": "drug_possession",
  "other_miscellaneous_offenses": "other",
};
const slug = (s) => {
  const k = s.toLowerCase().replace(/&/g, " ").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  return ALIASES[k] ?? k;
};
const n = (s) => Number(s.replace(/,/g, ""));

const TABLES = [
  {
    title: /^CITIZENSHIP OF (SENTENCED INDIVIDUALS|FEDERAL OFFENDERS|OFFENDERS)/,
    tries: [9, 8, 10],
    columns: ["sentenced_citizen", "sentenced_noncitizen"],
    total: "sentenced_total",
    shares: { sentenced_noncitizen: "noncitizen_share" },
  },
  {
    title: /^RACE OF (SENTENCED INDIVIDUALS|FEDERAL OFFENDERS|OFFENDERS)/,
    tries: [5, 4, 6],
    columns: ["sentenced_white", "sentenced_black", "sentenced_hispanic", "sentenced_other"],
    total: "sentenced_race_total",
    shares: {
      sentenced_white: "sentenced_white_share", sentenced_black: "sentenced_black_share",
      sentenced_hispanic: "sentenced_hispanic_share", sentenced_other: "sentenced_other_share",
    },
  },
];

// Finds the year's table by title among its usual numbers.
async function table(year, spec) {
  for (const t of spec.tries) {
    const res = await fetch(url(year, t), BROWSER);
    if (!res.ok) continue;
    const lines = await pdfLines(Buffer.from(await res.arrayBuffer()));
    if (lines.slice(0, 6).some((l) => spec.title.test(l))) return { lines, url: url(year, t) };
  }
  throw new Error(`FY${year}: no table titled ${spec.title}`);
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  for (let year = FROM; year <= TO; year++) {
    for (const spec of TABLES) {
      const { lines, url: src } = await table(year, spec);
      let rows = 0;
      for (const line of lines) {
        const cells = line.split("\t");
        // Label, total, then N/% pairs.
        if (cells.length !== 2 + spec.columns.length * 2 || !/^[\d,]+$/.test(cells[1])) continue;
        const label = cells[0];
        const [geoLevel, geoid, name] = /^total$/i.test(label) ? ["nation", "US", "All federal cases"] : ["offense", slug(label), label];
        const base = { source: SOURCE, geo_level: geoLevel, geoid, geo_name: name, period: `FY${year}`, period_start: `${year - 1}-10-01`, metadata: { url: src } };
        out.push({ ...base, metric: spec.total, value: n(cells[1]), unit: "people" });
        spec.columns.forEach((metric, i) => {
          out.push({ ...base, metric, value: n(cells[2 + i * 2]), unit: "people" });
          if (spec.shares[metric]) out.push({ ...base, metric: spec.shares[metric], value: Number(cells[3 + i * 2]), unit: "percent" });
        });
        rows++;
      }
      if (rows < 20) throw new Error(`FY${year} ${spec.total}: only ${rows} rows parsed — layout changed?`);
      console.log(`  FY${year} ${spec.total}: ${rows} rows`);
    }
  }
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: `FY${TO}` };
});
