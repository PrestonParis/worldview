// Imports IRS Statistics of Income state-to-state migration into
// `area_stats` (source irs-soi-migration). A move is a tax return filed
// from a different state than the year before; period = the later filing
// year (period '2023' = moved between the 2022 and 2023 filings):
//
//   state:  in_returns, in_people, in_agi, out_returns, out_people, out_agi,
//           net_returns, net_people, net_agi        (moves within the U.S.)
//           foreign_in_people, foreign_out_people   (to or from abroad)
//   flow:   flow_returns, flow_people, flow_agi    geo_level 'flow',
//           geoid = '<origin FIPS>:<destination FIPS>'
//
// People are exemptions (filers and dependents) through 2017 and
// individuals from 2018. AGI is the movers' adjusted gross income in the
// year they moved, in dollars.
//
// Source: https://www.irs.gov/statistics/soi-tax-stats-migration-data
// (stateinflowYYZZ.csv / stateoutflowYYZZ.csv) — free, no key.
//
// Usage:
//   node scripts/import-irs-migration.mjs [--years=2012-2023]
//   ENV_FILE=.env.cloud node scripts/import-irs-migration.mjs

import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "irs-soi-migration";
const [FROM, TO] = arg("years", "2012-2023").split("-").map(Number);
const BROWSER = { headers: { "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15" } };
const NAMES = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));
const isState = (f) => Boolean(NAMES[f]);
const n = (v) => Number(v);

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  let inserted = 0;
  for (let year = FROM; year <= TO; year++) {
    const yy = `${String(year - 1).slice(2)}${String(year).slice(2)}`;
    const file = async (kind) => parseCsv(await (await fetchRetry(`https://www.irs.gov/pub/irs-soi/state${kind}${yy}.csv`, BROWSER)).text());
    const [outflow, inflow] = await Promise.all([file("outflow"), file("inflow")]);
    const out = [];
    const base = { source: SOURCE, period: String(year), period_start: `${year}-01-01`, metadata: { files: `state*flow${yy}.csv` } };
    const add = (geoLevel, geoid, name, metric, value, unit) => out.push({ ...base, geo_level: geoLevel, geoid, geo_name: name, metric, value, unit });
    const totals = {}; // fips -> { in, out, foreignIn, foreignOut }
    // Outflow: y1 = origin state, y2 = destination.
    for (const r of outflow) {
      const [from, to] = [r.y1_statefips, r.y2_statefips];
      if (!isState(from)) continue;
      const t = (totals[from] ??= {});
      if (to === "97" && /Total Migration-US$/.test(r.y2_state_name)) t.out = r;
      else if (to === "98") t.foreignOut = r;
      else if (isState(to) && to !== from && n(r.n1) >= 0) {
        const geoid = `${from}:${to}`;
        const name = `${NAMES[from]} to ${NAMES[to]}`;
        add("flow", geoid, name, "flow_returns", n(r.n1), "returns");
        add("flow", geoid, name, "flow_people", n(r.n2), "people");
        add("flow", geoid, name, "flow_agi", n(r.AGI) * 1000, "usd");
      }
    }
    // Inflow: y2 = destination state, y1 = origin.
    for (const r of inflow) {
      const to = r.y2_statefips;
      if (!isState(to)) continue;
      const t = (totals[to] ??= {});
      if (r.y1_statefips === "97" && /Total Migration-US$/.test(r.y1_state_name)) t.in = r;
      else if (r.y1_statefips === "98") t.foreignIn = r;
    }
    for (const [fips, t] of Object.entries(totals)) {
      if (!t.in || !t.out) continue;
      const name = NAMES[fips];
      const [inR, outR, inP, outP, inA, outA] = [n(t.in.n1), n(t.out.n1), n(t.in.n2), n(t.out.n2), n(t.in.AGI) * 1000, n(t.out.AGI) * 1000];
      add("state", fips, name, "in_returns", inR, "returns");
      add("state", fips, name, "out_returns", outR, "returns");
      add("state", fips, name, "net_returns", inR - outR, "returns");
      add("state", fips, name, "in_people", inP, "people");
      add("state", fips, name, "out_people", outP, "people");
      add("state", fips, name, "net_people", inP - outP, "people");
      add("state", fips, name, "in_agi", inA, "usd");
      add("state", fips, name, "out_agi", outA, "usd");
      add("state", fips, name, "net_agi", inA - outA, "usd");
      if (t.foreignIn) add("state", fips, name, "foreign_in_people", n(t.foreignIn.n2), "people");
      if (t.foreignOut) add("state", fips, name, "foreign_out_people", n(t.foreignOut.n2), "people");
    }
    if (Object.keys(totals).length < 51) throw new Error(`${yy}: only ${Object.keys(totals).length} states parsed`);
    inserted += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"]);
    console.log(`  ${year}: ${out.length} rows`);
  }
  return { inserted };
});
