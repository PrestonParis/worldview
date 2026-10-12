// Imports the Census Bureau's State-to-State Migration Flows (ACS 1-year)
// into `area_stats` (source 'census-state-migration', period = survey year):
//   state_to_state      geo_level 'flow', geoid '<dest FIPS>:<origin FIPS>'
//   state_inflow, state_outflow, state_net_flow, moved_from_abroad
//                       geo_level 'state' (and 'nation' for the U.S. sums)
// Margins of error go in metadata.moe; suppressed ("N") cells are skipped.
//
// The tables are .xlsx from 2022 on (earlier years are legacy .xls and are
// skipped). Two layouts: a wide matrix (one row per destination, an
// Estimate/MOE column pair per origin; 2022–2023) and a long list (one row
// per destination–origin pair, with supplemental total sheets; 2024+).
//
// Source: https://www2.census.gov/programs-surveys/demo/tables/geographic-mobility/
// — free, no key.
//
// Usage:
//   node scripts/import-state-migration.mjs [--years=2022-2024]
//   ENV_FILE=.env.cloud node scripts/import-state-migration.mjs

import { arg, fetchRetry, num, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readXlsx } from "./lib/xlsx.mjs";

const ROOT = "https://www2.census.gov/programs-surveys/demo/tables/geographic-mobility";
const [FROM, TO] = arg("years", `2022-${new Date().getFullYear() - 1}`).split("-").map(Number);
const SOURCE = "census-state-migration";

// "District of Columbia " / "United States2" / "U.S. Island Area3" -> clean name.
const clean = (s) => (typeof s === "string" ? s.replace(/\d+$/, "").replace(/\s+/g, " ").trim() : null);
const fipsOf = (name) => {
  const abbr = STATE_NAME_TO_ABBR[clean(name)];
  return abbr && (abbr === "PR" || Number(STATE_FIPS[abbr]) <= 56) ? STATE_FIPS[abbr] : null;
};
const est = (v) => {
  const n = num(v);
  return n === null || n < 0 ? null : n;
};

// The newest .xlsx in a year's directory ("..._updated_2024_06_27.xlsx"
// sorts after the original), or null when the year has none.
async function findTable(year) {
  const dir = `${ROOT}/${year}/state-to-state-migration/`;
  let res;
  try {
    res = await fetchRetry(dir, {}, { label: `${year} directory` });
  } catch (err) {
    if (/-> 404/.test(err.message)) return null;
    throw err;
  }
  const files = [...(await res.text()).matchAll(/href="([^"/]+\.xlsx)"/gi)].map((m) => m[1]).sort();
  return files.length ? dir + files.at(-1) : null;
}

// Wide matrix: the row above the "Estimate" header names each origin column.
function parseWide(rows) {
  const h = rows.findIndex((r) => r.includes("Estimate"));
  const names = rows[h - 1].map(clean);
  const totals = names.flatMap((n, c) => (n === "Total" ? [c] : []));
  const [inCol, abroadCol] = [totals[0], totals.at(-1)];
  const origins = names.flatMap((n, c) => (fipsOf(n) && rows[h][c] === "Estimate" ? [[c, fipsOf(n)]] : []));
  const flows = [];
  const states = new Map();
  for (const r of rows.slice(h + 1)) {
    const dest = fipsOf(r[0]);
    if (!dest || states.has(dest)) continue;
    for (const [c, origin] of origins) {
      if (origin === dest) continue;
      const v = est(r[c]);
      if (v !== null) flows.push({ dest, origin, value: v, moe: est(r[c + 1]) });
    }
    states.set(dest, {
      inflow: [est(r[inCol]), est(r[inCol + 1])],
      abroad: abroadCol > inCol ? [est(r[abroadCol]), est(r[abroadCol + 1])] : [null, null],
      outflow: [null, null],
    });
  }
  // Outflows aren't published in this layout: sum each origin's column.
  // Like the published ones, a state's outflow excludes moves to Puerto Rico.
  for (const [fips, s] of states) {
    const out = flows.filter((f) => f.origin === fips && (fips === "72" || f.dest !== "72"));
    if (out.length) s.outflow = [out.reduce((t, f) => t + f.value, 0), null];
  }
  return { flows, states };
}

// Long list: Table = [current residence, residence 1 year ago, est, moe];
// totals come from the two supplemental sheets.
function parseLong(book) {
  const flows = [];
  for (const r of book.Table) {
    const [dest, origin] = [fipsOf(r[0]), fipsOf(r[1])];
    if (!dest || !origin || dest === origin) continue;
    const v = est(r[2]);
    if (v !== null) flows.push({ dest, origin, value: v, moe: est(r[3]) });
  }
  const states = new Map();
  const sheet = (prefix) => Object.entries(book).find(([n]) => n.startsWith(prefix))?.[1] ?? [];
  for (const r of sheet("Supplemental - Current")) {
    const fips = fipsOf(r[0]);
    if (fips) states.set(fips, { inflow: [est(r[7]), est(r[8])], abroad: [est(r[9]), est(r[10])], outflow: [null, null] });
  }
  for (const r of sheet("Supplemental - Res")) {
    const s = states.get(fipsOf(r[0]));
    if (s) s.outflow = [est(r[7]), est(r[8])];
  }
  return { flows, states };
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const nameOf = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([n, a]) => [STATE_FIPS[a], n]));
  let total = 0;
  const skipped = [];
  for (let year = FROM; year <= TO; year++) {
    const url = await findTable(year);
    if (!url) {
      skipped.push(year);
      continue;
    }
    const book = readXlsx(Buffer.from(await (await fetchRetry(url, {}, { label: url })).arrayBuffer()));
    const isLong = book.Table.some((r) => r.length === 4 && fipsOf(r[0]) && fipsOf(r[1]));
    const { flows, states } = isLong ? parseLong(book) : parseWide(book.Table);
    if (flows.length < 1000 || states.size < 51) throw new Error(`${year}: parsed only ${flows.length} flows, ${states.size} states`);

    const base = { source: SOURCE, period: String(year), period_start: `${year}-01-01`, unit: "people" };
    const out = flows.map((f) => ({
      ...base, metric: "state_to_state", geo_level: "flow", geoid: `${f.dest}:${f.origin}`,
      geo_name: `${nameOf[f.origin]} to ${nameOf[f.dest]}`, value: f.value, metadata: f.moe === null ? null : { moe: f.moe },
    }));
    const row = (metric, level, geoid, name, [value, moe]) =>
      value !== null && out.push({ ...base, metric, geo_level: level, geoid, geo_name: name, value, metadata: moe === null ? null : { moe } });
    const nation = { inflow: 0, abroad: 0 };
    for (const [fips, s] of states) {
      row("state_inflow", "state", fips, nameOf[fips], s.inflow);
      row("state_outflow", "state", fips, nameOf[fips], s.outflow);
      row("moved_from_abroad", "state", fips, nameOf[fips], s.abroad);
      if (s.inflow[0] !== null && s.outflow[0] !== null) row("state_net_flow", "state", fips, nameOf[fips], [s.inflow[0] - s.outflow[0], null]);
      // U.S. totals cover the 50 states and DC, as the Census Bureau's do.
      if (fips !== "72") {
        nation.inflow += s.inflow[0] ?? 0;
        nation.abroad += s.abroad[0] ?? 0;
      }
    }
    row("state_inflow", "nation", "US", "United States", [nation.inflow, null]);
    row("moved_from_abroad", "nation", "US", "United States", [nation.abroad, null]);

    total += await upsertRows(pg, "area_stats", Object.keys(out[0]), out, ["source", "metric", "geo_level", "geoid", "period"], {
      batchSize: 1000,
    });
    console.log(`  ${year}: ${flows.length} flows, ${states.size} states (${isLong ? "long" : "wide"} layout)`);
  }
  if (skipped.length) console.warn(`  no .xlsx table for ${skipped.join(", ")}`);
  return { inserted: total, skipped: skipped.length };
});
