// Loads handicapper race ratings for a cycle into `race_ratings`.
//
// Reads data/elections/<year>-ratings.csv (a transcription from a public
// source — Sabato's Crystal Ball is free and covers Senate/House/Governor).
// Any scaffolded race for the cycle that ISN'T in the file gets an
// "inferred" safe_<held-party> rating, so scripts/../elections/control.ts
// has a rating for every seat and the chamber math is complete.
//
// Idempotent: each row keys on external_id
// `rating:<source>:<electionExternalId>:<asOf>`, so a re-run of the same
// snapshot is a no-op and a newer snapshot appends to the history.
//
// Usage:
//   npm run import:race-ratings
//   npm run import:race-ratings -- --year=2026 --dry-run

process.loadEnvFile(".env.local");

import fs from "node:fs";
import { Client } from "pg";

const arg = (n, d) => {
  const h = process.argv.find((a) => a.startsWith(`--${n}=`));
  return h ? h.slice(n.length + 3) : d;
};
const DRY_RUN = process.argv.includes("--dry-run");
const YEAR = Number(arg("year", "2026"));
const AS_OF_DEFAULT = `${YEAR}-09-01`;

const VALID = new Set([
  "safe_d", "likely_d", "lean_d", "tossup",
  "lean_r", "likely_r", "safe_r", "safe_i",
]);

function parseCsv(raw) {
  const lines = raw
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("#"));
  const cols = lines.shift().split(",").map((c) => c.trim());
  return lines.map((l) => {
    const v = l.split(",");
    return Object.fromEntries(cols.map((c, i) => [c, (v[i] ?? "").trim()]));
  });
}

function electionExtId(office, state) {
  if (office === "senate") {
    // state may be "OH" or "OH:special" in the file
    const [po, special] = state.split(":");
    return special ? `cycle:${YEAR}:senate:${po}:special` : `cycle:${YEAR}:senate:${po}`;
  }
  if (office === "governor") return `cycle:${YEAR}:governor:${state}`;
  if (office === "house") return `cycle:${YEAR}:house:${state}`;
  return null;
}

const inferredRating = (party) =>
  /^d/i.test(party) ? "safe_d" : /^i/i.test(party) ? "safe_i" : /^r/i.test(party) ? "safe_r" : null;

async function main() {
  console.log(`Importing ${YEAR} race ratings${DRY_RUN ? "  [DRY RUN]" : ""}`);
  const file = `data/elections/${YEAR}-ratings.csv`;
  const rows = fs.existsSync(file) ? parseCsv(fs.readFileSync(file, "utf8")) : [];
  console.log(`  ${rows.length} rated races in ${file}`);

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const report = { fromFile: 0, inferred: 0, unmatched: [], bad: [] };

  try {
    // election external_id -> id, for the cycle
    const { rows: elx } = await pg.query(
      `SELECT e.id, e.external_id,
              (SELECT k.party FROM candidacies k
               WHERE k.election_id = e.id AND k.incumbent ORDER BY k.created_at LIMIT 1) AS held_party
       FROM elections e WHERE e.cycle = $1`,
      [YEAR],
    );
    const byExt = new Map(elx.map((r) => [r.external_id, r]));
    const rated = new Set();

    async function put(electionId, source, rating, asOf, url, notes, extKey) {
      if (DRY_RUN) return;
      await pg.query(
        `INSERT INTO race_ratings
           (id, election_id, source, rating, as_of, url, notes, external_id)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (external_id) DO UPDATE SET
           rating = EXCLUDED.rating, notes = EXCLUDED.notes`,
        [electionId, source, rating, asOf, url || null, notes || null, extKey],
      );
    }

    for (const r of rows) {
      const extId = electionExtId(r.office, r.state);
      const el = extId && byExt.get(extId);
      if (!el) {
        report.unmatched.push(`${r.office} ${r.state}`);
        continue;
      }
      if (!VALID.has(r.rating)) {
        report.bad.push(`${r.office} ${r.state}: "${r.rating}"`);
        continue;
      }
      const asOf = r.as_of || AS_OF_DEFAULT;
      const source = r.source || "starter";
      await put(
        el.id, source, r.rating, asOf, r.url, r.notes,
        `rating:${source}:${extId}:${asOf}`,
      );
      rated.add(el.id);
      report.fromFile++;
    }

    // Fill every unrated cycle race with an inferred "safe" rating.
    for (const el of elx) {
      if (rated.has(el.id)) continue;
      const rating = inferredRating(el.held_party || "");
      if (!rating) continue; // open seat, no incumbent party — leave unrated
      await put(
        el.id, "inferred", rating, AS_OF_DEFAULT, null,
        "No handicapper rating on file; defaulted to the incumbent party.",
        `rating:inferred:${el.external_id}:${AS_OF_DEFAULT}`,
      );
      report.inferred++;
    }

    console.log("\n--- Summary ---");
    console.log(`From file:   ${report.fromFile}`);
    console.log(`Inferred:    ${report.inferred}`);
    console.log(`Unmatched:   ${report.unmatched.length}${report.unmatched.length ? " — " + report.unmatched.join(", ") : ""}`);
    if (report.bad.length) console.log(`Bad ratings: ${report.bad.join("; ")}`);
    if (DRY_RUN) console.log("\nDRY RUN — nothing written.");
  } finally {
    await pg.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
