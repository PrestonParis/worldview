// Imports the Supreme Court Database (Spaeth et al., Penn State) modern
// justice-centered file into `court_cases` (one row per case) and
// `case_votes` (one row per justice per case), 1946 term onward.
//
// Coded fields are decoded to text: decision/vote direction
// (conservative | liberal | unspecifiable), issue area, vote type.
//
// Source: http://scdb.la.psu.edu/data/ — free. The download link is a
// per-release token; pass --url= when a new release ships. The site rejects
// non-browser user agents, hence the explicit UA.
//
// Usage:
//   node scripts/import-scdb.mjs [--url=<justiceCentered_Citation zip url>]
//   ENV_FILE=.env.cloud node scripts/import-scdb.mjs

import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { arg, fetchRetry, int, parseCsv, runImport, str, upsertRows } from "./lib/bulk.mjs";

// 2025 Release 01 (terms 1946–2024), Justice Centered, organized by citation.
const URL = arg("url", "https://scdb.la.psu.edu/?jet_download=d9fd858d0211fe70abbe33bf7cd7ec832f3a2313");

const DIRECTION = { 1: "conservative", 2: "liberal", 3: "unspecifiable" };
const ISSUE_AREA = {
  1: "Criminal Procedure", 2: "Civil Rights", 3: "First Amendment", 4: "Due Process",
  5: "Privacy", 6: "Attorneys", 7: "Unions", 8: "Economic Activity", 9: "Judicial Power",
  10: "Federalism", 11: "Interstate Relations", 12: "Federal Taxation",
  13: "Miscellaneous", 14: "Private Action",
};
const VOTE = {
  1: "majority", 2: "dissent", 3: "regular concurrence", 4: "special concurrence",
  5: "judgment of the Court", 6: "dissent from denial of cert", 7: "jurisdictional dissent",
  8: "equally divided",
};
const OPINION = { 1: "none", 2: "authored", 3: "co-authored" };

function mdyToIso(s) {
  const m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s ?? "");
  return m ? `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}` : null;
}

await runImport("scdb", async (pg) => {
  const dir = mkdtempSync(join(tmpdir(), "scdb-"));
  const zip = join(dir, "scdb.zip");
  const res = await fetchRetry(URL, { headers: { "User-Agent": "Mozilla/5.0" } }, { label: "SCDB" });
  writeFileSync(zip, Buffer.from(await res.arrayBuffer()));
  execFileSync("unzip", ["-o", "-q", zip, "-d", dir]);
  const csv = readdirSync(dir).find((f) => f.endsWith(".csv"));
  if (!csv) throw new Error("no CSV in SCDB zip");
  // SCDB ships Windows-1252 text.
  const rows = parseCsv(new TextDecoder("windows-1252").decode(readFileSync(join(dir, csv))));
  console.log(`  ${rows.length} justice-votes in ${csv}`);

  const justiceById = new Map(rows.map((r) => [r.justice, r.justiceName]));
  const cases = new Map();
  for (const r of rows) {
    if (cases.has(r.caseId)) continue;
    cases.set(r.caseId, {
      scdb_case_id: r.caseId,
      court: "SCOTUS",
      case_name: str(r.caseName),
      docket: str(r.docket),
      us_cite: str(r.usCite),
      term: int(r.term),
      decision_date: mdyToIso(r.dateDecision),
      chief: str(r.chief),
      issue_area: ISSUE_AREA[r.issueArea] ?? null,
      decision_direction: DIRECTION[r.decisionDirection] ?? null,
      majority_votes: int(r.majVotes),
      minority_votes: int(r.minVotes),
      majority_opinion_writer: justiceById.get(r.majOpinWriter) ?? null,
      declared_unconstitutional: r.declarationUncon ? Number(r.declarationUncon) > 1 : null,
      precedent_altered: r.precedentAlteration === "1",
      metadata: {
        docketId: r.docketId,
        sctCite: r.sctCite || undefined,
        lexisCite: r.lexisCite || undefined,
        petitioner: int(r.petitioner),
        respondent: int(r.respondent),
        issue: int(r.issue),
        lawType: int(r.lawType),
        decisionType: int(r.decisionType),
      },
    });
  }
  const caseRows = [...cases.values()];
  await upsertRows(pg, "court_cases", Object.keys(caseRows[0]), caseRows, ["scdb_case_id"]);

  const ids = new Map(
    (await pg.query("select id, scdb_case_id from court_cases where court = 'SCOTUS'")).rows.map((r) => [
      r.scdb_case_id,
      r.id,
    ]),
  );
  // One vote per justice per case (the file repeats a justice when a case
  // has several docket/issue rows) — keep the first.
  const seen = new Set();
  const votes = [];
  for (const r of rows) {
    const key = `${r.caseId}|${r.justiceName}`;
    if (seen.has(key) || !r.justiceName) continue;
    seen.add(key);
    votes.push({
      case_id: ids.get(r.caseId),
      justice: r.justiceName,
      in_majority: r.majority === "" ? null : r.majority === "2",
      direction: DIRECTION[r.direction] ?? null,
      vote: VOTE[r.vote] ?? null,
      opinion: OPINION[r.opinion] ?? null,
    });
  }
  await upsertRows(pg, "case_votes", Object.keys(votes[0]), votes, ["case_id", "justice"], {
    touchUpdatedAt: false,
  });
  console.log(`  ${caseRows.length} cases, ${votes.length} justice votes`);
  return { inserted: caseRows.length + votes.length };
});
