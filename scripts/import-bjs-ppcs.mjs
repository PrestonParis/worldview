// Imports the BJS Police-Public Contact Survey (a supplement to the NCVS)
// into `area_stats` (source bjs-ppcs): how many U.S. residents 16 and older
// had contact with police, why, what police did, and how often contact
// involved the threat or use of nonfatal force, 2018–2022.
//
//   geo_level 'nation' (US) for all residents; 'group' for sex_male,
//   race_black, age_18_24, income_75k_plus, … (race groups are
//   non-Hispanic except hispanic)
//
// Each table in the BJS CSV bundle has its own layout, so the columns are
// mapped per table below (TABLES). ":" (sample too small) is skipped.
//
// Source: https://bjs.ojp.gov/library/publications/contacts-between-police-and-public-2022
// (cbpp22.zip; --report=cbpp24 for a newer one once its layout is checked).
//
// Usage:
//   node scripts/import-bjs-ppcs.mjs [--report=cbpp22]
//   ENV_FILE=.env.cloud node scripts/import-bjs-ppcs.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

const SOURCE = "bjs-ppcs";
const REPORT = arg("report", "cbpp22");
const BROWSER = {
  headers: {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
  },
};

// Row label (footnotes stripped) → group id; "Total" is the nation.
function groupOf(label) {
  const l = label.replace(/\/[a-z,]+$/i, "").replace(/\*$/, "").replace(/\/[a-z,]+$/i, "").trim();
  if (l === "Total") return "US";
  const ages = /^(\d{2})\D{0,3}(\d{2})$/.exec(l);
  if (ages) return `age_${ages[1]}_${ages[2]}`;
  return {
    Male: "sex_male", Female: "sex_female", White: "race_white", Black: "race_black", Hispanic: "race_hispanic",
    Asian: "race_asian", Other: "race_other", "65 or older": "age_65_plus", "45 or older": "age_45_plus",
    "$74,999 or less": "income_under_75k", "$75,000 or more": "income_75k_plus",
  }[l] ?? null;
}
const GROUP_NAMES = {
  US: "United States", sex_male: "Men", sex_female: "Women", race_white: "White", race_black: "Black", race_hispanic: "Hispanic",
  race_asian: "Asian", race_other: "Other races", age_65_plus: "Ages 65+", age_45_plus: "Ages 45+",
  income_under_75k: "Household income under $75,000", income_75k_plus: "Household income $75,000 or more",
};
const groupName = (id) => GROUP_NAMES[id] ?? id.replace(/^age_(\d+)_(\d+)$/, "Ages $1–$2");

// Per table: rows are demographic groups (label in column `label`), and
// `cols` maps [year, column index, metric, unit]. Table 2 and 8 rows are
// contact reasons / police actions instead; see `rows`.
const TABLES = {
  t01: { label: 1, cols: [[2022, 4, "any_contact", "percent"], [2022, 8, "police_initiated_contact", "percent"], [2022, 12, "resident_initiated_contact", "percent"], [2022, 16, "traffic_accident_contact", "percent"], [2022, 3, "any_contact_count", "people"]] },
  t03: { label: 1, cols: [[2020, 6, "force_share_of_contacts", "percent"], [2020, 4, "force_count", "people"], [2022, 13, "force_share_of_contacts", "percent"], [2022, 11, "force_count", "people"]] },
  t05: { label: 1, cols: [
    [2020, 4, "traffic_stop_no_action", "percent"], [2020, 6, "traffic_stop_warning", "percent"], [2020, 8, "traffic_stop_ticket", "percent"], [2020, 10, "traffic_stop_search_or_arrest", "percent"],
    [2022, 15, "traffic_stop_no_action", "percent"], [2022, 17, "traffic_stop_warning", "percent"], [2022, 19, "traffic_stop_ticket", "percent"], [2022, 21, "traffic_stop_search_or_arrest", "percent"],
  ] },
  t06: { label: 1, cols: [
    [2020, 4, "street_stop_no_action", "percent"], [2020, 10, "street_stop_search_or_arrest", "percent"],
    [2022, 15, "street_stop_no_action", "percent"], [2022, 21, "street_stop_search_or_arrest", "percent"],
  ] },
  t07: { label: 2, cols: [[2020, 3, "misconduct", "percent"], [2022, 5, "misconduct", "percent"]] },
  t09: { label: 1, cols: [
    [2020, 3, "force_police_initiated", "percent"], [2020, 5, "force_perceived_necessary", "percent"], [2020, 7, "force_perceived_excessive", "percent"],
    [2022, 11, "force_police_initiated", "percent"], [2022, 13, "force_perceived_necessary", "percent"], [2022, 15, "force_perceived_excessive", "percent"],
  ] },
};
// Table 2: reason rows (label in column 0 or 1) × year. All residents.
const T2_REASONS = {
  "Any police contact": "any_contact", "Police-initiated contact": "police_initiated_contact", "Traffic stop, driver": "traffic_stop_driver",
  "Traffic stop, passenger": "traffic_stop_passenger", "Street stop": "street_stop", Arrested: "arrested", "Other approach": "other_police_approach",
  "Resident-initiated contact": "resident_initiated_contact", "Reported possible crime": "reported_crime",
  "Reported noncrime emergency": "reported_noncrime_emergency", "Reported nonemergency": "reported_nonemergency",
  "Traffic accident": "traffic_accident_contact",
};
const T2_COLS = [[2018, 4, ""], [2018, 2, "_count"], [2020, 9, ""], [2020, 7, "_count"], [2022, 13, ""], [2022, 12, "_count"]];
// Table 8: police action rows × race columns, police-initiated or traffic-accident contacts.
const T8_ACTIONS = {
  "Any action": "police_action_any", "Shouting/cursing": "police_shouting_cursing", "Threat/nonfatal use of force": "police_force_any",
  "Threat of force": "police_threat_of_force", "Handcuffing": "police_handcuffing", "Pushing/grabbing/hitting/kicking": "police_physical_force",
  "Using weapon/other force": "police_weapon_force",
};
const T8_COLS = [[2020, 2, "US"], [2020, 4, "race_white"], [2020, 6, "race_black"], [2020, 8, "race_hispanic"], [2020, 10, "race_other"],
  [2022, 13, "US"], [2022, 15, "race_white"], [2022, 17, "race_black"], [2022, 19, "race_hispanic"], [2022, 21, "race_other"]];

const value = (s) => {
  const t = String(s ?? "").replace(/[,%\s]/g, "");
  if (!t || t === ":" ) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
};
const clean = (s) => String(s ?? "").replace(/\/[a-z,]+$/i, "").replace(/\*$/, "").trim();

await runImport(SOURCE, async (pg) => {
  await registerDataset(pg, SOURCE);
  const dir = mkdtempSync(join(tmpdir(), "ppcs-"));
  writeFileSync(join(dir, "r.zip"), Buffer.from(await (await fetchRetry(`https://bjs.ojp.gov/document/${REPORT}.zip`, BROWSER)).arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", "-j", join(dir, "r.zip"), "-d", dir]);
  // Positional columns: give parseCsv a synthetic header (c0, c1, …).
  const table = (t) => parseCsv(`${Array.from({ length: 30 }, (_, i) => `c${i}`).join(",")}\n${readFileSync(join(dir, `${REPORT}${t}.csv`), "latin1")}`)
    .map((r) => Array.from({ length: 30 }, (_, i) => r[`c${i}`]));

  const out = [];
  const add = (geoid, metric, year, v, unit) => {
    if (v === null) return;
    out.push({
      source: SOURCE, metric, geo_level: geoid === "US" ? "nation" : "group", geoid, geo_name: groupName(geoid),
      period: String(year), period_start: `${year}-01-01`, value: v, unit, metadata: { report: REPORT },
    });
  };
  for (const [t, spec] of Object.entries(TABLES)) {
    for (const r of table(t)) {
      const g = groupOf(String(r[spec.label] ?? ""));
      if (!g) continue;
      for (const [year, i, metric, unit] of spec.cols) add(g, metric, year, value(r[i]), unit);
    }
  }
  // Table 7's total row is labelled "Any misconduct" in column 0.
  for (const r of table("t07")) {
    if (/^Any misconduct/.test(clean(r[0]))) { add("US", "misconduct", 2020, value(r[3]), "percent"); add("US", "misconduct", 2022, value(r[5]), "percent"); }
    if (clean(r[1]) === "Bias") { add("US", "misconduct_bias", 2020, value(r[3]), "percent"); add("US", "misconduct_bias", 2022, value(r[5]), "percent"); }
  }
  for (const r of table("t02")) {
    const metric = T2_REASONS[clean(r[1]) || clean(r[0])];
    if (!metric) continue;
    for (const [year, i, suffix] of T2_COLS) add("US", metric + suffix, year, value(r[i]), suffix ? "people" : "percent");
  }
  for (const r of table("t08")) {
    const metric = T8_ACTIONS[clean(r[1]) || clean(r[0]).replace(/\/[a-z,]+$/i, "")];
    if (!metric) continue;
    for (const [year, i, g] of T8_COLS) add(g, metric, year, value(r[i]), "percent");
  }

  for (const want of ["US:force_share_of_contacts:2022", "race_black:force_share_of_contacts:2022", "US:any_contact:2018"]) {
    if (!out.some((r) => `${r.geoid}:${r.metric}:${r.period}` === want)) throw new Error(`PPCS: missing ${want} — table layout changed?`);
  }
  console.log(`  ${out.length} rows from ${REPORT}`);
  const columns = ["source", "metric", "geo_level", "geoid", "geo_name", "period", "period_start", "value", "unit", "metadata"];
  const inserted = await upsertRows(pg, "area_stats", columns, out, ["source", "metric", "geo_level", "geoid", "period"]);
  return { inserted, cursor: REPORT };
});
