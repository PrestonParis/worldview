// Imports National Crime Victimization Survey estimates into `area_stats`
// (source = 'bjs-ncvs', geo_level 'nation', period = year), computed from
// BJS's NCVS Select person- and household-level files with SoQL
// aggregates — victimization rates by type, the share reported to police,
// and violence by victim–offender relationship.
//
// Codes (NCVS Select codebook): personal NEWOFF 1 rape/sexual assault,
// 2 robbery, 3 aggravated assault, 4 simple assault (NEWCRIME 1 = violent);
// household NEWOFF 6 burglary/trespassing, 7 motor vehicle theft, 8 other
// theft. NOTIFY 1 yes, 2 no, 3 don't know (98 = residue, excluded). DIREL
// 1 intimate partner, 2 other relative, 4 stranger. Offender race shares
// (<scope>_offender_<group>_pct) use OFFTRACENEW, below.
//
// Usage:
//   node scripts/import-bjs-ncvs.mjs
//   ENV_FILE=.env.cloud node scripts/import-bjs-ncvs.mjs

import { fetchJson, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const BASE = "https://api.ojp.gov/bjsdataset/v1";
const FILES = { persons: "r4j4-fdwx", households: "ya4e-n9zp", personal: "gcuy-rt5g", household: "gkck-euys" };
const PERSONAL = { 1: "rape_sexual_assault", 2: "robbery", 3: "aggravated_assault", 4: "simple_assault" };
const HOUSEHOLD = { 6: "burglary", 7: "motor_vehicle_theft", 8: "other_theft" };
// OFFTRACENEW (2012 on): perceived race/Hispanic origin of the offender, or
// of a group of offenders who shared it; 7 = a group of mixed races; 10 and
// 11 = victim didn't know. Checked against BJS, "Race and Hispanic Origin of
// Victims and Offenders, 2012–15" (NCJ 250747), table 1.
const OFFENDER_RACE = { 1: "white_nh", 2: "black_nh", 3: "aian_nh", 4: "asian_nhpi_nh", 5: "other_nh", 6: "hispanic", 7: "mixed_group", 10: "unknown", 11: "unknown" };
// RACE_ETHNICITY of the victim: 1–5 non-Hispanic white, black, AIAN, Asian/NHPI, other; 6 Hispanic.
const VICTIM_RACE = { 1: "white_nh", 2: "black_nh", 6: "hispanic" };

const soql = (file, query) =>
  fetchJson(`${BASE}/${FILES[file]}.json?$query=${encodeURIComponent(`${query} LIMIT 50000`)}`, { timeoutMs: 300_000 }, { label: `ncvs ${file}` });

await runImport("bjs-ncvs", async (pg) => {
  await registerDataset(pg, "bjs-ncvs");

  const [persons, households, personal, household, relation] = await Promise.all([
    soql("persons", "SELECT year, sum(wgtpercy::number) AS w GROUP BY year"),
    soql("households", "SELECT year, sum(wgthhcy::number) AS w GROUP BY year"),
    soql("personal", "SELECT year, newoff, notify, sum(newwgt::number) AS w WHERE newcrime = '1' GROUP BY year, newoff, notify"),
    soql("household", "SELECT year, newoff, notify, sum(newwgt::number) AS w GROUP BY year, newoff, notify"),
    soql("personal", "SELECT year, direl, sum(newwgt::number) AS w WHERE newcrime = '1' GROUP BY year, direl"),
  ]);
  const pop = (rows) => Object.fromEntries(rows.map((r) => [r.year, Number(r.w)]));
  const personsBy = pop(persons);
  const householdsBy = pop(households);

  const rows = [];
  const push = (year, metric, value, unit) => {
    if (value === null || !Number.isFinite(value)) return;
    rows.push({
      source: "bjs-ncvs", metric, geo_level: "nation", geoid: "US", geo_name: "United States",
      period: year, period_start: `${year}-01-01`, value: Math.round(value * 100) / 100, unit, metadata: null,
    });
  };

  // Victimizations and reporting by offense, then rolled up.
  const tally = (list, codes, denom, group) => {
    const by = {}; // year -> key -> { all, yes, answered }
    for (const r of list) {
      const key = codes[r.newoff];
      if (!key) continue;
      const w = Number(r.w);
      for (const k of [key, group]) {
        const t = ((by[r.year] ??= {})[k] ??= { all: 0, yes: 0, answered: 0 });
        t.all += w;
        if (r.notify === "1") t.yes += w;
        if (["1", "2", "3"].includes(r.notify)) t.answered += w;
      }
    }
    for (const [year, keys] of Object.entries(by)) {
      const d = denom[year];
      if (!d) continue;
      for (const [k, t] of Object.entries(keys)) {
        push(year, `${k}_rate`, (t.all / d) * 1000, "per_1000");
        push(year, `${k}_reported_pct`, t.answered ? (t.yes / t.answered) * 100 : null, "percent");
      }
    }
  };
  tally(personal, PERSONAL, personsBy, "violent");
  tally(household, HOUSEHOLD, householdsBy, "property");

  const rel = {};
  for (const r of relation) (rel[r.year] ??= {})[r.direl] = Number(r.w);
  for (const [year, by] of Object.entries(rel)) {
    const d = personsBy[year];
    if (!d) continue;
    push(year, "intimate_partner_rate", ((by["1"] ?? 0) / d) * 1000, "per_1000");
    push(year, "domestic_violence_rate", (((by["1"] ?? 0) + (by["2"] ?? 0)) / d) * 1000, "per_1000");
    push(year, "stranger_violence_rate", ((by["4"] ?? 0) / d) * 1000, "per_1000");
  }

  // Offender race and Hispanic origin as the victim perceived it (2012 on),
  // as a share of violent victimizations: all, serious violent (excluding
  // simple assault), and by the victim's race and Hispanic origin.
  const offenders = await soql(
    "personal",
    "SELECT year, seriousviolent, race_ethnicity, offtracenew, sum(newwgt::number) AS w WHERE newcrime = '1' AND offtracenew != '-1' GROUP BY year, seriousviolent, race_ethnicity, offtracenew",
  );
  const shares = {}; // year -> scope -> group -> weight
  for (const r of offenders) {
    const group = OFFENDER_RACE[r.offtracenew];
    if (!group) continue;
    const scopes = ["violent", ...(r.seriousviolent === "1" ? ["serious_violent"] : [])];
    const victim = VICTIM_RACE[r.race_ethnicity];
    if (victim) scopes.push(`violent_victim_${victim}`);
    for (const s of scopes) {
      const t = ((shares[r.year] ??= {})[s] ??= {});
      t[group] = (t[group] ?? 0) + Number(r.w);
    }
  }
  for (const [year, scopes] of Object.entries(shares)) {
    for (const [scope, groups] of Object.entries(scopes)) {
      const total = Object.values(groups).reduce((a, b) => a + b, 0);
      for (const g of new Set(Object.values(OFFENDER_RACE))) push(year, `${scope}_offender_${g}_pct`, ((groups[g] ?? 0) / total) * 100, "percent");
    }
  }

  const inserted = await upsertRows(pg, "area_stats", Object.keys(rows[0]), rows, ["source", "metric", "geo_level", "geoid", "period"]);
  const years = [...new Set(rows.map((r) => r.period))].sort();
  console.log(`  ${years[0]}–${years.at(-1)}, ${rows.length} values`);
  return { inserted };
});
