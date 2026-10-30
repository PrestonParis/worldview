// Imports the EAC Election Administration and Voting Survey (EAVS) into
// `area_stats`: voter registration, list maintenance (removals by reason),
// mail ballots (sent / returned / counted / rejected by reason), provisional
// ballots, and turnout by voting method.
//
// Rows are stored per reporting jurisdiction (geo_level 'eavs_jurisdiction',
// 10-digit EAC FIPSCode) and summed to county (first 5 digits) and state.
// EAVS codes missing/not-applicable as negative numbers (-77/-88/-99);
// those are dropped, and an aggregate only counts jurisdictions that
// reported the item (metadata.reporting = how many did).
//
// Source: https://www.eac.gov/research-and-data/datasets-codebooks-and-surveys
// — free. Variable codes change between survey years; only years with a
// verified code map below are importable (2016–2024; each map was checked
// against that year's variable labels). Items a year didn't ask are left
// out of its map: removals for duplicate records start in 2024, mail
// rejection reasons are numbered differently each cycle, and 2016's B1a
// counts UOCAVA ballots sent rather than UOCAVA registrants.
//
// Usage:
//   node scripts/import-eavs.mjs [--year=2024]   (2016, 2018, 2020, 2022, 2024)
//   ENV_FILE=.env.cloud node scripts/import-eavs.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STATE_FIPS, STATE_NAME_TO_ABBR, arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";
import { registerDataset } from "./lib/catalog.mjs";

// Items shared by 2018–2022 (registration, notices, removals A8/A9, turnout F1).
const CODES_2018_2022 = {
  registered_total: "A1a",
  registered_active: "A1b",
  registered_inactive: "A1c",
  same_day_registrations: "A2a",
  new_valid_registrations: "A3b",
  confirmation_notices_sent: "A8a",
  removed_total: "A9a",
  removed_moved: "A9b",
  removed_death: "A9c",
  removed_felony: "A9d",
  removed_failed_to_respond: "A9e",
  removed_incompetent: "A9f",
  removed_voter_request: "A9g",
  uocava_registered: "B1a",
  mail_ballots_sent: "C1a",
  mail_ballots_returned: "C1b",
  mail_ballots_undeliverable: "C1c",
  provisional_cast: "E1a",
  provisional_counted_full: "E1b",
  provisional_counted_partial: "E1c",
  provisional_rejected: "E1d",
  voters_total: "F1a",
  voted_election_day_in_person: "F1b",
  voted_uocava: "F1c",
  voted_by_mail: "F1d",
  voted_provisional: "F1e",
  voted_early_in_person: "F1f",
  voted_by_mail_vbm_jurisdiction: "F1g",
};
const EAC = "https://www.eac.gov/sites/default/files";

const YEARS = {
  2016: {
    url: `${EAC}/2023-12/EAVS_2016_for_Public_Release_nolabel_V1.1_CSV.zip`,
    codes: {
      registered_total: "A1a",
      registered_active: "A3a",
      registered_inactive: "A3b",
      same_day_registrations: "A4a",
      new_valid_registrations: "A5b",
      confirmation_notices_sent: "A10a",
      removed_total: "A11a",
      removed_moved: "A11b",
      removed_death: "A11c",
      removed_felony: "A11d",
      removed_failed_to_respond: "A11e",
      removed_incompetent: "A11f",
      removed_voter_request: "A11g",
      mail_ballots_sent: "C1a",
      mail_ballots_returned: "C1b",
      mail_ballots_undeliverable: "C1c",
      mail_ballots_counted: "C4a",
      mail_ballots_rejected: "C4b",
      mail_rejected_late: "C5a",
      mail_rejected_no_signature: "C5b",
      mail_rejected_no_witness: "C5c",
      provisional_cast: "E1a",
      provisional_counted_full: "E1b",
      provisional_counted_partial: "E1c",
      provisional_rejected: "E1d",
      voters_total: "F1a",
      voted_election_day_in_person: "F1b",
      voted_uocava: "F1c",
      voted_by_mail: "F1d",
      voted_provisional: "F1e",
      voted_early_in_person: "F1f",
      voted_by_mail_vbm_jurisdiction: "F1g",
    },
  },
  2018: {
    url: `${EAC}/2019-10/EAVS_2018_for_Public_Release_nolabel%20v1.1.csv`,
    codes: { ...CODES_2018_2022, mail_ballots_counted: "C3a", mail_ballots_rejected: "C4a", mail_rejected_late: "C4b", mail_rejected_no_signature: "C4c", mail_rejected_no_witness: "C4d" },
  },
  2020: {
    url: `${EAC}/2023-12/2020_EAVS_for_Public_Release_nolabel_V1.2_CSV.zip`,
    codes: { ...CODES_2018_2022, mail_ballots_counted: "C3a", mail_ballots_rejected: "C4a", mail_rejected_late: "C4b", mail_rejected_no_signature: "C4c", mail_rejected_no_witness: "C4d" },
  },
  2022: {
    url: `${EAC}/2023-06/2022_EAVS_for_Public_Release_nolabel_V1_CSV.zip`,
    codes: { ...CODES_2018_2022, mail_ballots_counted: "C8a", mail_ballots_rejected: "C9a", mail_rejected_late: "C9b", mail_rejected_no_signature: "C9c", mail_rejected_no_witness: "C9d" },
  },
  2024: {
    url: `${EAC}/2026-02/2024_EAVS_for_Public_Release_nolabel_V2_csv.zip`,
    codes: {
      registered_total: "A1a",
      registered_active: "A1b",
      registered_inactive: "A1c",
      same_day_registrations: "A2a",
      new_valid_registrations: "A3b",
      confirmation_notices_sent: "A10a",
      removed_total: "A12a",
      removed_moved: "A12b",
      removed_death: "A12c",
      removed_felony: "A12d",
      removed_failed_to_respond: "A12e",
      removed_incompetent: "A12f",
      removed_voter_request: "A12g",
      removed_duplicate: "A12h",
      uocava_registered: "B1a",
      mail_ballots_sent: "C1a",
      mail_ballots_returned: "C1b",
      mail_ballots_undeliverable: "C1c",
      mail_ballots_counted: "C8a",
      mail_ballots_rejected: "C9a",
      mail_rejected_late: "C9b",
      mail_rejected_no_signature: "C9c",
      mail_rejected_no_witness: "C9d",
      provisional_cast: "E1a",
      provisional_counted_full: "E1b",
      provisional_counted_partial: "E1c",
      provisional_rejected: "E1d",
      voters_total: "F1a",
      voted_election_day_in_person: "F1b",
      voted_uocava: "F1c",
      voted_by_mail: "F1d",
      voted_provisional: "F1e",
      voted_early_in_person: "F1f",
      voted_by_mail_vbm_jurisdiction: "F1g",
    },
  },
};

const YEAR = Number(arg("year", "2024"));
const FIPS_TO_ABBR = Object.fromEntries(Object.entries(STATE_FIPS).map(([a, f]) => [f, a]));
const FIPS_TO_NAME = Object.fromEntries(Object.entries(STATE_NAME_TO_ABBR).map(([name, a]) => [STATE_FIPS[a], name]));

await runImport(`eavs-${YEAR}`, async (pg) => {
  await registerDataset(pg, "eavs");
  const spec = YEARS[YEAR];
  if (!spec) throw new Error(`no verified code map for EAVS ${YEAR} (have: ${Object.keys(YEARS).join(", ")})`);
  const dir = mkdtempSync(join(tmpdir(), "eavs-"));
  const res = await fetchRetry(spec.url, { headers: { "User-Agent": "Mozilla/5.0" } }, { label: "EAVS" });
  const body = Buffer.from(await res.arrayBuffer());
  // 2018 is published as a bare CSV; the other years are zipped.
  if (/\.csv$/i.test(spec.url)) writeFileSync(join(dir, "eavs.csv"), body);
  else {
    writeFileSync(join(dir, "eavs.zip"), body);
    execFileSync("unzip", ["-o", "-q", "-j", join(dir, "eavs.zip"), "-d", dir]);
  }
  const csv = readdirSync(dir).find((f) => f.toLowerCase().endsWith(".csv"));
  const rows = parseCsv(new TextDecoder("windows-1252").decode(readFileSync(join(dir, csv))));
  console.log(`  ${rows.length} jurisdictions`);

  const out = [];
  const agg = new Map(); // level|geoid|metric -> {name, value, reporting}
  const base = { source: "eavs", period: String(YEAR), period_start: `${YEAR}-11-01`, unit: "count" };
  for (const r of rows) {
    const fips = (r.FIPSCode || "").padStart(10, "0");
    if (!/^\d{10}$/.test(fips)) continue;
    for (const [metric, code] of Object.entries(spec.codes)) {
      const raw = Number(r[code]);
      if (r[code] === "" || !Number.isFinite(raw) || raw < 0) continue;
      // 2016 names its ID columns JurisdictionName / State (abbreviation).
      const abbr = r.State_Abbr ?? r.State;
      out.push({ ...base, metric, geo_level: "eavs_jurisdiction", geoid: fips, geo_name: `${r.Jurisdiction_Name ?? r.JurisdictionName}, ${abbr}`, value: raw, metadata: null });
      for (const [level, geoid, name] of [
        ["county", fips.slice(0, 5), null],
        ["state", fips.slice(0, 2), r.State_Full ?? FIPS_TO_NAME[fips.slice(0, 2)]],
      ]) {
        const key = `${level}|${geoid}|${metric}`;
        const a = agg.get(key) ?? { level, geoid, metric, name: name ?? FIPS_TO_ABBR[fips.slice(0, 2)], value: 0, reporting: 0 };
        a.value += raw;
        a.reporting += 1;
        agg.set(key, a);
      }
    }
  }
  for (const a of agg.values()) {
    out.push({ ...base, metric: a.metric, geo_level: a.level, geoid: a.geoid, geo_name: a.name, value: a.value, metadata: { reporting: a.reporting } });
  }
  const n = await upsertRows(pg, "area_stats", Object.keys(out[0]), out, [
    "source", "metric", "geo_level", "geoid", "period",
  ]);
  console.log(`  ${n} rows`);
  return { inserted: n };
});
