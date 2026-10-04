// Loads county-level presidential results into `election_results`, keyed by
// 5-digit county FIPS so the Phase 3 choropleth (public/data/us-counties.geojson)
// joins with no cross-store lookup.
//
// Source: Tony McGovern's US_County_Level_Election_Results_08-24 (MIT
// licence), committed under data/elections/tonmcg-county-president-<year>.csv.
// Two-party only (votes_gop / votes_dem) — enough for a winner + margin
// choropleth. Rows attach to the state-level `medsl:president:<year>:<ST>`
// elections that scripts/import-elections.mjs already created; run that first.
//
// Idempotent: every row carries `external_id` = `tonmcg:<year>:<fips>:<R|D>`.
//
// Usage:
//   npm run import:county-results
//   npm run import:county-results -- --years=2020 --dry-run

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

const DATA_DIR = "data/elections";
const DRY_RUN = process.argv.includes("--dry-run");
const yearsArg = process.argv.find((a) => a.startsWith("--years="));
const YEARS = yearsArg
  ? yearsArg.slice(8).split(",").map((s) => Number(s.trim())).filter(Boolean)
  : [2020, 2024];

function parseCsv(raw) {
  const rows = [];
  let field = "";
  let record = [];
  let quoted = false;
  const endField = () => {
    record.push(field);
    field = "";
  };
  const endRecord = () => {
    endField();
    rows.push(record);
    record = [];
  };
  for (let i = 0; i < raw.length; i++) {
    const c = raw[i];
    if (quoted) {
      if (c === '"') {
        if (raw[i + 1] === '"') {
          field += '"';
          i++;
        } else quoted = false;
      } else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") endField();
    else if (c === "\n") endRecord();
    else if (c !== "\r") field += c;
  }
  if (field.length || record.length) endRecord();
  const header = rows.shift();
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

const toInt = (v) => {
  const n = Math.round(Number(String(v).replace(/[, ]/g, "")));
  return Number.isFinite(n) ? n : 0;
};

async function main() {
  console.log(`Importing county results for ${YEARS.join(", ")}${DRY_RUN ? "  [DRY RUN]" : ""}`);
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const report = { inserted: 0, unmatchedStates: new Set(), missingCandidacy: [], years: {} };

  try {
    for (const year of YEARS) {
      const file = path.join(DATA_DIR, `tonmcg-county-president-${year}.csv`);
      if (!fs.existsSync(file)) {
        console.log(`  ${year}: no file at ${file}, skipping`);
        continue;
      }
      const rows = parseCsv(fs.readFileSync(file, "utf8"));

      // state (lowercased) -> { electionId, R: candidacyId, D: candidacyId }
      const { rows: cand } = await pg.query(
        `SELECT e.id AS election_id, lower(e.jurisdiction) AS jur, e.jurisdiction AS jur_display,
                k.id AS candidacy_id, k.party
         FROM elections e
         JOIN candidacies k ON k.election_id = e.id
         WHERE e.office = 'President'
           AND date_part('year', e.election_date) = $1`,
        [year],
      );
      const byState = new Map();
      for (const c of cand) {
        const entry = byState.get(c.jur) ?? { electionId: c.election_id, R: null, D: null };
        if (/republican|\bgop\b/i.test(c.party || "")) entry.R = c.candidacy_id;
        else if (/democrat|dfl/i.test(c.party || "")) entry.D = c.candidacy_id;
        byState.set(c.jur, entry);
      }

      // Accumulate rows and flush in batches — one multi-row upsert per ~500
      // rows instead of a round trip each (12k rows over a pooler is minutes
      // vs. seconds).
      const pending = [];
      const flush = async () => {
        if (DRY_RUN || pending.length === 0) return;
        const values = [];
        const params = [];
        for (const r of pending) {
          const b = params.length;
          values.push(
            `(gen_random_uuid(), $${b + 1}, $${b + 2}, 'county', $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6})`,
          );
          params.push(r.electionId, r.candidacyId, r.fips, r.areaName, r.votes, r.externalId);
        }
        await pg.query(
          `INSERT INTO election_results
             (id, election_id, candidacy_id, area_kind, area_id, area_name, votes, external_id)
           VALUES ${values.join(", ")}
           ON CONFLICT (external_id) DO UPDATE SET
             votes = EXCLUDED.votes, area_name = EXCLUDED.area_name`,
          params,
        );
        pending.length = 0;
      };

      let n = 0;
      for (const row of rows) {
        const state = (row.state_name || "").trim().toLowerCase();
        const entry = byState.get(state);
        if (!entry) {
          report.unmatchedStates.add(row.state_name);
          continue;
        }
        if (!entry.R || !entry.D) {
          report.missingCandidacy.push(`${year} ${row.state_name}`);
          continue;
        }
        const fips = String(row.county_fips).padStart(5, "0");
        const areaName = row.county_name || "";
        for (const [candidacyId, votes, tag] of [
          [entry.R, toInt(row.votes_gop), "R"],
          [entry.D, toInt(row.votes_dem), "D"],
        ]) {
          pending.push({
            electionId: entry.electionId,
            candidacyId,
            fips,
            areaName,
            votes,
            externalId: `tonmcg:${year}:${fips}:${tag}`,
          });
          n++;
          if (pending.length >= 500) await flush();
        }
      }
      await flush();
      report.years[year] = n;
      report.inserted += n;
      console.log(`  ${year}: ${n} result rows across ${rows.length} counties`);
    }

    console.log("\n--- Summary ---");
    console.log(`Result rows upserted: ${report.inserted}`);
    if (report.unmatchedStates.size) {
      console.log(`Unmatched states:     ${[...report.unmatchedStates].join(", ")}`);
    }
    if (report.missingCandidacy.length) {
      console.log(
        `No R/D candidacy for:  ${[...new Set(report.missingCandidacy)].slice(0, 20).join(", ")}`,
      );
    }
    if (DRY_RUN) console.log("\nDRY RUN — nothing written.");
  } finally {
    await pg.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
