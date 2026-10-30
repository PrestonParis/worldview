// Imports real U.S. election returns from the MIT Election Data + Science
// Lab (MEDSL) datasets on Harvard Dataverse into the `elections` +
// `candidacies` tables, matching candidates against existing `politician`
// entities in Neo4j and creating the ones that don't exist yet.
//
// Source files live in `data/elections/` (committed) or, for datasets that
// require a Dataverse guestbook acknowledgement, must be downloaded by hand
// into that directory — see data/elections/SOURCES.md.
//
// Safe to re-run: every election and candidacy carries a stable
// `external_id` (`medsl:<office>:<year>:<jurisdiction>[:...]`), so re-runs
// upsert rather than duplicate. Candidate-entity matches that are ambiguous
// (more than one politician entity shares the name) are written to the run
// report and skipped — never guessed.
//
// Usage:
//   npm run import:elections
//   npm run import:elections -- --dry-run
//   npm run import:elections -- --offices=president,senate --cycles=2016,2020,2024
//   npm run import:elections -- --all-candidates
//
//   --offices=a,b,c     subset of: president, senate, house  (default: those
//                       whose source file is present)
//   --cycles=Y,Y | A-B  election years, as a list or an inclusive range
//                       (default: 2000 to present — pass e.g. --cycles=1976-2024
//                       for the full history, which creates ~1600 entities for
//                       historical minor candidates)
//   --min-vote-share=N  percent below which a minor candidate is skipped
//                       unless they won or ran major-party (default: 1)
//   --all-candidates    import every candidate regardless of vote share
//   --dry-run           parse + match + report, write nothing

process.loadEnvFile(process.env.ENV_FILE || ".env.local");

import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { Client } from "pg";
import { upsertEntities } from "./lib/entities.mjs";
import { describePerson } from "./lib/describe.mjs";

const DATA_DIR = "data/elections";
const CACHE_DIR = path.join(DATA_DIR, "cache");

// One entry per office. `file` is looked up in data/elections/ then
// data/elections/cache/; a non-guestbook file is downloaded to the cache if
// missing, a guestbook file must be placed by hand.
const OFFICE_SOURCES = {
  president: {
    file: "1976-2024-president.csv",
    dataverseFileId: 13887042,
    office: "President",
    level: "federal",
    guestbook: false,
  },
  senate: {
    file: "1976-2024-senate-state.tab",
    dataverseFileId: 13887039,
    office: "U.S. Senate",
    level: "federal",
    guestbook: false,
  },
  house: {
    file: "1976-2024-house.tab",
    dataverseFileId: 13592823,
    office: "U.S. House",
    level: "federal",
    guestbook: true,
  },
};

// ── args ──────────────────────────────────────────────────────────────────
const DRY_RUN = process.argv.includes("--dry-run");
const ALL_CANDIDATES = process.argv.includes("--all-candidates");
const arg = (name) =>
  process.argv.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const OFFICES = (arg("offices")?.split(",").map((s) => s.trim()).filter(Boolean)) ?? null;

function parseCycles(spec) {
  // default: 2000 → the next even year (covers the latest cycle in the data)
  if (!spec) {
    const end = new Date().getUTCFullYear();
    const out = new Set();
    for (let y = 2000; y <= end; y++) out.add(y);
    return out;
  }
  const out = new Set();
  for (const part of spec.split(",").map((s) => s.trim())) {
    const range = part.match(/^(\d{4})-(\d{4})$/);
    if (range) {
      for (let y = Number(range[1]); y <= Number(range[2]); y++) out.add(y);
    } else if (/^\d{4}$/.test(part)) {
      out.add(Number(part));
    }
  }
  return out;
}
const CYCLES = parseCycles(arg("cycles"));
const MIN_VOTE_SHARE = arg("min-vote-share") ? Number(arg("min-vote-share")) : 1;

// ── generic delimited-text parser (sniffs tab vs comma, handles "" quotes) ─
function parseTable(raw) {
  const firstLine = raw.slice(0, raw.indexOf("\n"));
  const delim = firstLine.includes("\t") ? "\t" : ",";
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
    else if (c === delim) endField();
    else if (c === "\n") endRecord();
    else if (c !== "\r") field += c;
  }
  if (field.length || record.length) endRecord();
  const header = rows.shift();
  return rows
    .filter((r) => r.length > 1)
    .map((r) => Object.fromEntries(header.map((h, i) => [h, r[i] ?? ""])));
}

// ── source-file resolution ───────────────────────────────────────────────
async function resolveSourceFile(key, src) {
  const committed = path.join(DATA_DIR, src.file);
  if (fs.existsSync(committed)) return committed;
  const cached = path.join(CACHE_DIR, src.file);
  if (fs.existsSync(cached)) return cached;
  if (src.guestbook) {
    throw new Error(
      `${src.file} is not present and can't be fetched automatically ` +
        `(Dataverse requires a guestbook acknowledgement). Download it from ` +
        `the dataset linked in ${DATA_DIR}/SOURCES.md and save it to ${committed}.`,
    );
  }
  fs.mkdirSync(CACHE_DIR, { recursive: true });
  const url = `https://dataverse.harvard.edu/api/access/datafile/${src.dataverseFileId}`;
  process.stdout.write(`  fetching ${src.file} … `);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} -> ${res.status} ${await res.text()}`);
  fs.writeFileSync(cached, Buffer.from(await res.arrayBuffer()));
  console.log("cached");
  return cached;
}

// ── value helpers ────────────────────────────────────────────────────────
const SUFFIXES = new Set(["JR", "SR", "II", "III", "IV"]);

function titleCase(s) {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (m) => m.toUpperCase())
    .replace(/\bMc([a-z])/g, (m, c) => "Mc" + c.toUpperCase());
}

function toInt(v) {
  const n = Math.round(Number(String(v).replace(/[, ]/g, "")));
  return Number.isFinite(n) ? n : null;
}

// U.S. general election day: the Tuesday after the first Monday of November.
function generalElectionDate(year) {
  let day = new Date(Date.UTC(year, 10, 1));
  while (day.getUTCDay() !== 1) day = new Date(day.getTime() + 86400000);
  return new Date(day.getTime() + 86400000).toISOString();
}

// get-or-create an array value in a Map
function bucket(map, key) {
  let v = map.get(key);
  if (!v) {
    v = [];
    map.set(key, v);
  }
  return v;
}

// Ballot-line rows that aren't a candidate.
const NON_CANDIDATE =
  /^(write[- ]?in|under ?vote|over ?vote|blank|scatter|none of (these|the above)|all others?|no preference|not designated|misc|other$|n\/?a$)/i;

const isSuffix = (t) => SUFFIXES.has(t.toUpperCase().replace(/\./g, ""));

// Conservative given-name equivalences, canonicalised to the short form
// (graph entities tend to use "Joe Biden", not "Joseph"). Only unambiguous
// pairs — no "ted" (Edward vs Theodore), no "dick".
const CANONICAL_FIRST = {
  joseph: "joe", william: "bill", robert: "bob", james: "jim",
  michael: "mike", charles: "chuck", thomas: "tom", richard: "rick",
  daniel: "dan", david: "dave", anthony: "tony", christopher: "chris",
  matthew: "matt", nicholas: "nick", benjamin: "ben", samuel: "sam",
  joshua: "josh", andrew: "andy", edward: "ed", kenneth: "ken",
  ronald: "ron", gerald: "jerry", lawrence: "larry", raymond: "ray",
};
const canonFirst = (t) => CANONICAL_FIRST[t] ?? t;

// MEDSL candidate strings come in a few shapes: "LAST, FIRST M. [SUFFIX]"
// (president), "FIRST M. LAST" (senate/house), "FIRST M. LAST, SUFFIX", plus
// stray "NICK" / \"NICK\" nicknames and doubled-up CSV quoting. Returns a
// display name + a match key, or null for non-candidate ballot lines.
function parseCandidate(raw) {
  const s = (raw ?? "")
    .replace(/\\/g, "") // \"JIM\" -> "JIM"
    .replace(/"+[^"]*"+/g, " ") // "PAT" / ""PAT"" -> ·
    .replace(/"/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s || s.toUpperCase() === "NA" || NON_CANDIDATE.test(s)) return null;

  let firstToks;
  let lastToks;
  let suffix;
  if (s.includes(",")) {
    const [l, r] = s.split(",");
    const lToks = l.trim().split(" ").filter(Boolean);
    const rToks = r.trim().split(" ").filter(Boolean);
    if (rToks.length > 0 && rToks.every(isSuffix)) {
      // "FIRST M. LAST, JR" — comma only sets off the suffix
      suffix = rToks[0];
      lastToks = [lToks.pop()];
      firstToks = lToks;
    } else {
      // "LAST, FIRST M. [JR]"
      lastToks = lToks;
      firstToks = rToks;
    }
  } else {
    const parts = s.split(" ").filter(Boolean);
    while (parts.length > 1 && isSuffix(parts[parts.length - 1])) suffix = parts.pop();
    lastToks = [parts.pop()];
    firstToks = parts;
  }
  suffix = suffix ?? [...firstToks, ...lastToks].find(isSuffix);
  firstToks = firstToks.filter((t) => t && !isSuffix(t));
  lastToks = lastToks.filter((t) => t && !isSuffix(t));

  const norm = (x) => x.toLowerCase().replace(/[^a-z]/g, "");
  const last = norm(lastToks.join(""));
  const firstTok = canonFirst(norm(firstToks[0] ?? ""));
  if (!last) return null;
  const display = titleCase(
    [firstToks.join(" "), lastToks.join(" "), suffix ? suffix.replace(/\./g, "") : ""]
      .filter(Boolean)
      .join(" "),
  );
  return { display, firstTok, last, key: `${firstTok} ${last}`.trim() };
}

function partyLabel(row) {
  const detailed = (row.party_detailed || "").trim();
  const simple = (row.party_simplified || row.party || "").trim();
  const raw = detailed || simple;
  return raw ? titleCase(raw) : "";
}

// ── main ─────────────────────────────────────────────────────────────────
async function main() {
  const wanted = OFFICES ?? Object.keys(OFFICE_SOURCES).filter((k) =>
    fs.existsSync(path.join(DATA_DIR, OFFICE_SOURCES[k].file)) ||
    fs.existsSync(path.join(CACHE_DIR, OFFICE_SOURCES[k].file)),
  );
  if (wanted.length === 0) {
    console.error("No source files present. See data/elections/SOURCES.md.");
    process.exit(1);
  }
  const cy = [...CYCLES].sort((a, b) => a - b);
  console.log(
    `Importing ${wanted.join(", ")} for ${cy[0]}–${cy[cy.length - 1]}` +
      `${DRY_RUN ? "  [DRY RUN]" : ""}`,
  );

  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();

  const report = {
    startedAt: new Date().toISOString(),
    offices: wanted,
    createdEntities: [],
    ambiguous: [],
    skippedMinor: 0,
    elections: 0,
    candidacies: 0,
  };

  try {
    // Every politician entity, once — indexed by "<first> <last>" match key
    // (given-name equivalences applied). Surname-only matching is
    // deliberately not attempted: "Jill Stein" must not resolve to an
    // existing "Josh Stein". Near-misses (nicknames the map misses) are
    // created as new entities and listed in the report for a human to merge.
    const { rows: politicians } = await pg.query("select id, name from entities where type = 'politician'");
    const byKey = new Map();
    for (const rec of politicians) {
      const parsed = parseCandidate(rec.name);
      if (parsed?.key) bucket(byKey, parsed.key).push(rec.id);
    }
    console.log(`  ${politicians.length} politician entities loaded`);

    const decisionCache = new Map(); // raw candidate string -> id | "AMBIGUOUS"

    async function resolveCandidate(parsed, raw, party, electionLabel, candidacy) {
      if (decisionCache.has(raw)) return decisionCache.get(raw);
      let id = null;
      const exact = byKey.get(parsed.key) ?? [];
      if (exact.length === 1) {
        id = exact[0];
      } else if (exact.length > 1) {
        report.ambiguous.push({ candidate: parsed.display, election: electionLabel, matches: exact.length });
        decisionCache.set(raw, "AMBIGUOUS");
        return "AMBIGUOUS";
      }
      if (!id) {
        id = randomUUID();
        if (!DRY_RUN) {
          await upsertEntities(pg, [
            {
              id,
              type: "politician",
              name: parsed.display,
              description: describePerson({ candidacies: [candidacy] }),
              metadata: JSON.stringify({ source: "medsl", party }),
            },
          ]);
        }
        // keep the local index consistent within the run
        if (parsed.key) byKey.set(parsed.key, [id]);
        report.createdEntities.push({ name: parsed.display, election: electionLabel });
      }
      decisionCache.set(raw, id);
      return id;
    }

    for (const key of wanted) {
      const src = OFFICE_SOURCES[key];
      const file = await resolveSourceFile(key, src);
      const rows = parseTable(fs.readFileSync(file, "utf8"));
      console.log(`  ${src.file}: ${rows.length} rows`);

      // Group rows into elections.
      const elections = new Map();
      for (const row of rows) {
        const year = Number(row.year);
        if (!year || !CYCLES.has(year)) continue;
        if (row.stage && row.stage.toUpperCase() !== "GEN") continue;
        if (row.mode && row.mode.toUpperCase() !== "TOTAL") continue;
        const cand = parseCandidate(row.candidate);
        if (!cand) continue;

        const special = String(row.special).toLowerCase() === "true";
        const district = row.district && row.district !== "statewide" ? row.district : "";
        let jurisdiction;
        let extJur;
        if (key === "house") {
          jurisdiction = `${row.state_po}-${String(district).padStart(2, "0")}`;
          extJur = jurisdiction;
        } else {
          jurisdiction = titleCase(row.state);
          extJur = row.state_po || row.state;
        }
        const extId =
          `medsl:${key}:${year}:${extJur}` +
          (special ? ":special" : "") +
          (key !== "house" && district ? `:d${district}` : "");
        if (!elections.has(extId)) {
          elections.set(extId, {
            extId,
            year,
            name:
              `${jurisdiction} — ${src.office} ${year}` + (special ? " (special)" : ""),
            office: src.office,
            jurisdiction,
            level: src.level,
            electionType: special ? "special" : "general",
            status:
              String(row.unofficial).toLowerCase() === "true" ? "provisional" : "certified",
            electionDate: generalElectionDate(year),
            totalVotes: toInt(row.totalvotes),
            candidates: new Map(),
          });
        }
        const e = elections.get(extId);
        const votes = toInt(row.candidatevotes) ?? 0;
        const cKey = cand.key || cand.display.toLowerCase();
        const existing = e.candidates.get(cKey);
        if (existing) {
          existing.votes += votes;
          if (votes > existing.topLineVotes) {
            existing.topLineVotes = votes;
            existing.party = partyLabel(row);
          }
        } else {
          e.candidates.set(cKey, {
            raw: row.candidate,
            parsed: cand,
            party: partyLabel(row),
            votes,
            topLineVotes: votes,
            simplified: (row.party_simplified || row.party || "").toUpperCase(),
          });
        }
      }

      // Write.
      for (const e of elections.values()) {
        const cands = [...e.candidates.values()].sort((a, b) => b.votes - a.votes);
        if (cands.length === 0) continue;
        const denom = e.totalVotes || cands.reduce((s, c) => s + c.votes, 0);
        const winnerKey = cands[0];

        const keep = cands.filter((c) => {
          if (ALL_CANDIDATES) return true;
          if (c === winnerKey) return true;
          if (c.simplified === "DEMOCRAT" || c.simplified === "REPUBLICAN") return true;
          return denom > 0 && (c.votes / denom) * 100 >= MIN_VOTE_SHARE;
        });
        report.skippedMinor += cands.length - keep.length;

        let electionId;
        if (!DRY_RUN) {
          const { rows: r } = await pg.query(
            `INSERT INTO elections
               (id, name, office, jurisdiction, level, election_type, status,
                election_date, total_votes, external_id, notes)
             VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
             ON CONFLICT (external_id) DO UPDATE SET
               name = EXCLUDED.name, status = EXCLUDED.status,
               total_votes = EXCLUDED.total_votes,
               election_date = EXCLUDED.election_date, updated_at = now()
             RETURNING id`,
            [
              e.name, e.office, e.jurisdiction, e.level, e.electionType, e.status,
              e.electionDate, e.totalVotes, e.extId,
              "Imported from MIT Election Lab.",
            ],
          );
          electionId = r[0].id;
        }
        report.elections++;

        for (const c of keep) {
          const resolved = await resolveCandidate(
            c.parsed, c.raw, c.party, e.name,
            { office: e.office, jurisdiction: e.jurisdiction, year: e.year, party: c.party, won: c === winnerKey && e.office !== "President" },
          );
          if (resolved === "AMBIGUOUS") continue;
          if (!DRY_RUN) {
            await pg.query(
              `INSERT INTO candidacies
                 (id, election_id, candidate_entity_id, party, votes, won, external_id)
               VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6)
               ON CONFLICT (external_id) DO UPDATE SET
                 party = EXCLUDED.party, votes = EXCLUDED.votes,
                 won = EXCLUDED.won, election_id = EXCLUDED.election_id`,
              [
                electionId,
                resolved,
                c.party || null,
                c.votes,
                c === winnerKey,
                `${e.extId}:${c.parsed.last}-${c.parsed.firstTok || "x"}`,
              ],
            );
          }
          report.candidacies++;
        }
      }
    }

    // Auto-link each race to its prior comparable (same office + jurisdiction,
    // next-earliest date) so the Phase 4 swing map works with no hand-wiring.
    if (!DRY_RUN) {
      await pg.query(`
        UPDATE elections e SET prior_election_id = p.id, updated_at = now()
        FROM elections p
        WHERE e.prior_election_id IS NULL
          AND p.office = e.office AND p.jurisdiction = e.jurisdiction
          AND p.id <> e.id
          AND p.election_date = (
            SELECT max(p2.election_date) FROM elections p2
            WHERE p2.office = e.office AND p2.jurisdiction = e.jurisdiction
              AND p2.election_date < e.election_date
          )
      `);
    }

    // Report.
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const dir = path.join("backups", stamp);
    fs.mkdirSync(dir, { recursive: true });
    const reportPath = path.join(dir, "election-import-report.json");
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

    console.log("\n--- Summary ---");
    console.log(`Elections upserted:   ${report.elections}`);
    console.log(`Candidacies upserted: ${report.candidacies}`);
    console.log(`Entities created:     ${report.createdEntities.length}`);
    console.log(`Ambiguous, skipped:   ${report.ambiguous.length}`);
    console.log(`Minor cands skipped:  ${report.skippedMinor}`);
    console.log(`Report: ${reportPath}`);
    if (report.ambiguous.length) {
      console.log("\nAmbiguous (resolve by adding an alias or merging entities):");
      for (const a of report.ambiguous.slice(0, 20)) {
        console.log(`  - ${a.candidate} — ${a.election} (${a.matches} matches)`);
      }
      if (report.ambiguous.length > 20) console.log(`  … +${report.ambiguous.length - 20} more`);
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
