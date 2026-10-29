// Imports welfare use by citizenship and nativity, tabulated from the ACS
// 1-year Public Use Microdata Sample with the Census microdata API, into
// `area_stats` (source census-pums-welfare), nation 2012 onward and states
// 2021 onward (no 2020 release). Shares of people in each group:
//
//   <measure>_<group>_pct
//     measure: snap      lives in a household that received SNAP (FS = 1)
//              medicaid  covered by Medicaid or other means-tested public
//                        coverage (HINS4 = 1)
//              cash      received public assistance (welfare) income (PAP > 0)
//              ssi       received Supplemental Security Income (SSIP > 0)
//     group:   native (born a U.S. citizen, incl. territories and abroad
//              to U.S. parents), naturalized, noncitizen, foreign_born
//              (naturalized + noncitizen), all
//
// Usage:
//   node scripts/import-acs-pums-nativity.mjs [--years=2012-2024]
//   ENV_FILE=.env.cloud node scripts/import-acs-pums-nativity.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, checkCensusKey, fetchJson, runImport, sleep, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "census-pums-welfare";
const [FROM, TO] = arg("years", "2012-2024").split("-").map(Number);
const YEARS = Array.from({ length: TO - FROM + 1 }, (_, i) => FROM + i).filter((y) => y !== 2020);
const MEASURES = { snap: "FS=1", medicaid: "HINS4=1", cash: "PAP=1:9999999", ssi: "SSIP=1:9999999" };
// CIT: 1 born in U.S., 2 born in territories, 3 born abroad to U.S. parents, 4 naturalized, 5 not a citizen.
const GROUP_OF = { 1: "native", 2: "native", 3: "native", 4: "naturalized", 5: "noncitizen" };
const NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

// The API defines state codes for tabulation only from the 2021 release;
// earlier years are national.
const BY_STATE_FROM = 2021;

// ST × citizenship-group weighted counts (one "US" row before 2021),
// optionally filtered.
async function tab(year, key, predicate) {
  const byState = year >= BY_STATE_FROM;
  // The state variable is ST through 2022 and STATE from 2023.
  const url = `https://api.census.gov/data/${year}/acs/acs1/pums?tabulate=weight(PWGTP)&col+CIT${byState ? `&row+${year >= 2023 ? "STATE" : "ST"}` : ""}${predicate ? `&${predicate}` : ""}&key=${key}`;
  const [head, ...rows] = await fetchJson(url, { timeoutMs: 300_000 }, { label: `PUMS ${year} ${predicate ?? "all"}` });
  const cits = (byState ? head.slice(0, -1) : head).map((h) => Object.values(h)[0]);
  const out = {}; // fips -> group -> n
  for (const r of rows) {
    const st = byState ? String(r.at(-1)).padStart(2, "0") : "US";
    const g = (out[st] ??= {});
    cits.forEach((c, i) => {
      const group = GROUP_OF[c];
      if (group) g[group] = (g[group] ?? 0) + Number(r[i]);
    });
  }
  return out;
}

await runImport(SOURCE, async (pg) => {
  const key = process.env.CENSUS_API_KEY;
  await checkCensusKey(key);
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (const year of YEARS) {
    const totals = await tab(year, key);
    const out = [];
    for (const [measure, predicate] of Object.entries(MEASURES)) {
      const hits = await tab(year, key, predicate);
      await sleep(300);
      const nation = { totals: {}, hits: {} };
      const emit = (geoLevel, geoid, name, t, h) => {
        const groups = { ...t, foreign_born: (t.naturalized ?? 0) + (t.noncitizen ?? 0), all: Object.values(t).reduce((a, b) => a + b, 0) };
        const hit = { ...h, foreign_born: (h.naturalized ?? 0) + (h.noncitizen ?? 0), all: Object.values(h).reduce((a, b) => a + b, 0) };
        for (const [g, n] of Object.entries(groups)) {
          if (!n) continue;
          out.push({
            source: SOURCE, metric: `${measure}_${g}_pct`, geo_level: geoLevel, geoid, geo_name: name, period: String(year),
            period_start: `${year}-01-01`, value: Math.round(((hit[g] ?? 0) / n) * 1000) / 10, unit: "percent", metadata: null,
          });
        }
      };
      if (totals.US) {
        emit("nation", "US", "United States", totals.US, hits.US ?? {});
        continue;
      }
      for (const [st, t] of Object.entries(totals)) {
        if (!NAMES[st]) continue;
        const h = hits[st] ?? {};
        emit("state", st, NAMES[st], t, h);
        for (const [g, n] of Object.entries(t)) nation.totals[g] = (nation.totals[g] ?? 0) + n;
        for (const [g, n] of Object.entries(h)) nation.hits[g] = (nation.hits[g] ?? 0) + n;
      }
      emit("nation", "US", "United States", nation.totals, nation.hits);
    }
    inserted += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted };
});
