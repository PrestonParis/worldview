// Imports NAEP (the Nation's Report Card) math and reading results into
// `area_stats`: average scale scores and the share at or above Proficient,
// grades 4 and 8, for national public schools ("NP", stored as nation US)
// and every state, from the NAEP Data Service API. Only the "R3" samples
// (accommodations permitted) are kept, so years are comparable.
//
// Usage:
//   node scripts/import-naep.mjs
//   ENV_FILE=.env.cloud node scripts/import-naep.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, fetchJson, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const KEY = ["source", "metric", "geo_level", "geoid", "period"];
const COLUMNS = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
const STATES = Object.values(STATE_NAME_TO_ABBR).filter((a) => Number(STATE_FIPS[a]) < 60);
const STATE_NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [abbr, name]));

const SUBJECTS = {
  math: { subject: "mathematics", scale: "MRPCM", years: [1996, 2000, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2022, 2024] },
  reading: { subject: "reading", scale: "RRPCM", years: [1998, 2002, 2003, 2005, 2007, 2009, 2011, 2013, 2015, 2017, 2019, 2022, 2024] },
};
const STATS = { "MN:MN": ["score", "points"], "ALC:AP": ["proficient", "percent"] };

await runImport("naep", async (pg) => {
  const slug = "naep";
  await registerDataset(pg, slug);
  const rows = [];
  const jurisdictions = ["NP", ...STATES].join(",");
  for (const [key, { subject, scale, years }] of Object.entries(SUBJECTS)) {
    for (const grade of [4, 8]) {
      for (const [stattype, [suffix, unit]] of Object.entries(STATS)) {
        for (const year of years) {
          const url =
            `https://www.nationsreportcard.gov/DataService/GetAdhocData.aspx?type=data&subject=${subject}&grade=${grade}` +
            `&subscale=${scale}&variable=TOTAL&jurisdiction=${jurisdictions}&stattype=${stattype}&Year=${year}`;
          const body = await fetchJson(url, {}, { label: `NAEP ${key} ${grade} ${stattype} ${year}` });
          // The service answers a year it has no data for with a string result.
          if (!Array.isArray(body.result)) continue;
          for (const r of body.result) {
            if (r.sample !== "R3" || !r.isStatDisplayable || typeof r.value !== "number") continue;
            const nation = r.jurisdiction === "NP";
            const geoid = nation ? "US" : STATE_FIPS[r.jurisdiction];
            if (!geoid) continue;
            rows.push({
              source: slug, metric: `${key}_${grade}_${suffix}`, geo_level: nation ? "nation" : "state", geoid,
              geo_name: nation ? "United States (public schools)" : STATE_NAMES[r.jurisdiction],
              period: String(r.year), period_start: `${r.year}-01-01`, value: Math.round(r.value * 10) / 10, unit, metadata: null,
            });
          }
          await sleep(150);
        }
        console.log(`  ${key} grade ${grade} ${suffix}`);
      }
    }
  }
  if (!rows.some((r) => r.metric === "math_8_score" && r.period === "2024")) throw new Error("NAEP: no 2024 grade 8 math — API changed?");
  const inserted = await upsertRows(pg, "area_stats", COLUMNS, rows, KEY);
  console.log(`  ${slug}: ${rows.length} rows`);
  return { inserted };
});
