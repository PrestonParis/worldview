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
// verified code map below are importable.
//
// Usage:
//   node scripts/import-eavs.mjs [--year=2024]
//   ENV_FILE=.env.cloud node scripts/import-eavs.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { STATE_FIPS, arg, fetchRetry, parseCsv, runImport, upsertRows } from "./lib/bulk.mjs";

const YEARS = {
  2024: {
    url: "https://www.eac.gov/sites/default/files/2026-02/2024_EAVS_for_Public_Release_nolabel_V2_csv.zip",
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

await runImport(`eavs-${YEAR}`, async (pg) => {
  const spec = YEARS[YEAR];
  if (!spec) throw new Error(`no verified code map for EAVS ${YEAR} (have: ${Object.keys(YEARS).join(", ")})`);
  const dir = mkdtempSync(join(tmpdir(), "eavs-"));
  const zip = join(dir, "eavs.zip");
  const res = await fetchRetry(spec.url, { headers: { "User-Agent": "Mozilla/5.0" } }, { label: "EAVS" });
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
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
      out.push({ ...base, metric, geo_level: "eavs_jurisdiction", geoid: fips, geo_name: `${r.Jurisdiction_Name}, ${r.State_Abbr}`, value: raw, metadata: null });
      for (const [level, geoid, name] of [
        ["county", fips.slice(0, 5), null],
        ["state", fips.slice(0, 2), r.State_Full],
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
