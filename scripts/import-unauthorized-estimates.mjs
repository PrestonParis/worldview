// Imports estimates of the unauthorized immigrant population from
// researchers other than DHS, which carry the series past DHS's last
// estimate (January 2022, source dhs-unauthorized), into `area_stats`
// (source unauthorized-estimates), nation. Transcribed from the published
// reports; each value's sentence is cited in metadata. One metric per
// estimator, so they chart side by side:
//
//   pew_unauthorized              Pew Research Center (July of each year)
//   pew_unauthorized_protected    Pew: of those, with some protection from
//                                 deportation (TPS, DACA, parole, pending asylum, …)
//   cis_unauthorized              Center for Immigration Studies (from the CPS)
//
// Usage:
//   node scripts/import-unauthorized-estimates.mjs
//   ENV_FILE=.env.cloud node scripts/import-unauthorized-estimates.mjs

import { runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "unauthorized-estimates";
const PEW = "https://www.pewresearch.org/race-and-ethnicity/2025/08/21/u-s-unauthorized-immigrant-population-reached-a-record-14-million-in-2023/";
const CIS = "https://cis.org/";

// [metric, period, period_start, value, metadata]
const VALUES = [
  ["pew_unauthorized", "2007", "2007-07-01", 12_200_000, { url: PEW, quote: "In 2007, when the total unauthorized immigrant population was at its previous high (12.2 million)" }],
  ["pew_unauthorized", "2021", "2021-07-01", 10_500_000, { url: PEW, quote: "grew by 3.5 million from 2021 to 2023", derived: "14.0 million in 2023 minus the stated 3.5 million increase" }],
  ["pew_unauthorized", "2023", "2023-07-01", 14_000_000, { url: PEW, quote: "reached an all-time high of 14 million in 2023" }],
  ["pew_unauthorized_protected", "2021", "2021-07-01", 2_700_000, { url: PEW, quote: "up from 2.7 million in 2021" }],
  ["pew_unauthorized_protected", "2023", "2023-07-01", 6_000_000, { url: PEW, quote: "About 6 million immigrants without full legal status had some protection from deportation in 2023" }],
  ["cis_unauthorized", "2025-01", "2025-01-01", 15_800_000, { url: CIS, quote: "from 15.8 million in January of 2025", report: "CIS, September 2026" }],
  ["cis_unauthorized", "2026-07", "2026-07-01", 13_500_000, { url: CIS, quote: "to 13.5 million in July of 2026", report: "CIS, September 2026", preliminary: true }],
];

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = VALUES.map(([metric, period, start, value, metadata]) => ({
    source: SOURCE, metric, geo_level: "nation", geoid: "US", geo_name: "United States", period, period_start: start, value, unit: "people", metadata,
  }));
  const inserted = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted };
});
