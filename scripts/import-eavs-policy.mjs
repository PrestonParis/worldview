// Imports the EAC Election Administration Policy Survey (the state-law
// companion to EAVS) into `area_stats` (source eavs-policy): which voting
// rules each state had in each federal election, 2018–2024, as 1/0 —
// voter ID and photo ID requirements, same-day, online, automatic, and
// pre-registration, excuse-required mail voting, permanent absentee lists,
// all-mail elections, drop boxes, ballot curing, and vote centers.
//
// Question numbers change every survey but the variable labels don't, so
// items are found by label in each year's Stata file (scripts/lib/stata.mjs)
// and answers read from their value labels ("1: Yes", "2: No", …). Refused
// and not-applicable answers (negative codes) are skipped.
//
// Source: https://www.eac.gov/research-and-data/datasets-codebooks-and-surveys
//
// Usage:
//   node scripts/import-eavs-policy.mjs [--year=2024]   (default: all years)
//   ENV_FILE=.env.cloud node scripts/import-eavs-policy.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, runImport, STATE_FIPS, STATE_NAME_TO_ABBR, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";
import { readDta } from "./lib/stata.mjs";

const SOURCE = "eavs-policy";
const EAC = "https://www.eac.gov/sites/default/files";
const FILES = {
  2018: `${EAC}/eac_assets/1/6/EAVS_PolicySurvey_2018_for_Public_Release.dta.zip`,
  2020: `${EAC}/2021-08/2020_Policy_Survey_for_Public_Release%5B1%5D.dta`,
  2022: `${EAC}/2023-06/2022_Policy_Survey_for_Public_Release_V1_DTA.zip`,
  2024: `${EAC}/2026-02/2024_Policy_Survey_for_Public_Release_V2_dta.zip`,
};
const YEARS = arg("year", null) ? [arg("year")] : Object.keys(FILES);
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, abbr]) => [STATE_FIPS[abbr], name]));

// Value labels read "1: Yes" from 2022 on and plain "Yes" before.
const yes = (t) => /^\s*(-?\d+:\s*)?Yes/i.test(t);
const no = (t) => /^\s*(-?\d+:\s*)?No\b/i.test(t);
const yesNo = (t) => (yes(t) ? 1 : no(t) ? 0 : null);
const selected = (t) => (/not selected|^NO TO/i.test(t) ? 0 : /selected/i.test(t) ? 1 : null);
// metric → alternatives of [variable label pattern, answer text → 1/0/null]
const ITEMS = {
  voter_id_required: [[/Voter ID Required$/i, yesNo]],
  photo_id_required: [[/Photo ID Required$/i, yesNo]],
  same_day_registration: [[/Same Day Registration( or period of overlap)?$/i, yesNo]],
  online_registration: [[/Online Voter Registration$/i, (t) => (yes(t) ? (/register to vote/i.test(t) ? 1 : 0) : no(t) ? 0 : null)]],
  pre_registration: [[/Pre-?Registration$/i, yesNo]],
  automatic_registration: [[/No Automatic Registration$/i, (t) => (selected(t) === null ? null : 1 - selected(t))], [/^Q\d+ Automatic Voter Registration$/i, yesNo]],
  mail_excuse_required: [[/Excuse (Required )?for (Mail|Absentee|By-?Mail) Voting$|Require excuse for absentee voting$/i, yesNo]],
  permanent_absentee_any_voter: [[/Permanent Absentee Voting Allowed$|request to be permanent absentee$/i, (t) => (/any registrant/i.test(t) ? 1 : yes(t) || no(t) ? 0 : null)]],
  all_mail_elections: [[/All[- ]Mail Election(s)? Used$|All Vote-By-Mail Used$|All vote by mail system$/i, yesNo]],
  drop_boxes_allowed: [[/Drop Boxes Allowed$/i, yesNo]],
  ballot_curing_allowed: [[/Ballot Curing Allowed$/i, yesNo]],
  vote_centers_allowed: [[/Allow Vote Centers$/i, yesNo]],
};

async function loadDta(url) {
  const dir = mkdtempSync(join(tmpdir(), "eavs-policy-"));
  const body = Buffer.from(await (await fetchRetry(url, { headers: { "User-Agent": "Mozilla/5.0" } }, { label: "EAVS policy" })).arrayBuffer());
  if (/\.dta$/i.test(url)) return body;
  writeFileSync(join(dir, "p.zip"), body);
  execFileSync("unzip", ["-o", "-q", "-j", join(dir, "p.zip"), "-d", dir]);
  // Skip macOS resource forks (__MACOSX/._name.dta) bundled in some zips.
  return readFileSync(join(dir, readdirSync(dir).find((f) => /\.dta$/i.test(f) && !f.startsWith("._"))));
}

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const out = [];
  for (const year of YEARS) {
    const buf = await loadDta(FILES[year]);
    const { names } = readDta(buf, []);
    const all = readDta(buf, names);
    const stateVar = names.find((n) => /^state(_abbr)?$/i.test(n) && all.columns[n].every((v) => typeof v === "string" && v.length === 2));
    if (!stateVar) throw new Error(`EAVS policy ${year}: no state abbreviation column`);
    const found = [];
    for (const [metric, alternatives] of Object.entries(ITEMS)) {
      let v, read;
      for (const [pattern, fn] of alternatives) {
        v = names.find((n) => pattern.test(all.varLabels[n] ?? "") && !/comment|other|_REF$|OE$/i.test(n));
        if (v) {
          read = fn;
          break;
        }
      }
      if (!v) continue;
      found.push(metric);
      all.columns[v].forEach((code, i) => {
        const fips = STATE_FIPS[all.columns[stateVar][i]];
        const value = code === null || code < 0 ? null : read(all.labels[v]?.[code] ?? `${code}: ?`);
        if (!fips || value === null) return;
        out.push({
          source: SOURCE, metric, geo_level: "state", geoid: fips, geo_name: FIPS_TO_NAME[fips], period: String(year),
          period_start: `${year}-11-01`, value, unit: "boolean", metadata: { variable: v },
        });
      });
    }
    console.log(`  ${year}: ${found.length}/${Object.keys(ITEMS).length} items (${Object.keys(ITEMS).filter((m) => !found.includes(m)).join(", ") || "all"})`);
  }
  // A state with no voter ID requirement has no photo ID requirement either
  // (the survey skips the follow-up question).
  for (const r of out.filter((r) => r.metric === "voter_id_required" && r.value === 0)) {
    if (!out.some((o) => o.metric === "photo_id_required" && o.geoid === r.geoid && o.period === r.period)) out.push({ ...r, metric: "photo_id_required" });
  }
  if (!out.some((r) => r.metric === "voter_id_required" && r.period === "2024")) throw new Error("EAVS policy: no 2024 voter ID answers — labels changed?");
  console.log(`  ${out.length} rows`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted };
});
