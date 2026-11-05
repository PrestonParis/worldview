// Loads a federal election's results into `elections` and `candidacies` while
// the count runs: Senate, governor and House, from the New York Times results
// feed (AP data plus some NYT calls), cross-checked against the winners marked
// on Wikipedia's overview pages. Parsing and the call rule live in
// scripts/lib/race-results.mjs.
//
// A race is called only when the feed calls it. Wikipedia naming someone else
// blocks the call, and a Wikipedia-only call is reported but not shown.
//
// Writes:
//   candidacies   votes, won (nominee rows; run sync:wiki-races first). A
//                 candidate over 1% with no row, because Wikipedia's list left
//                 them out, gets one (`nyt:` external id)
//   elections     status, total_votes, call_status, reporting_pct, flipped,
//                 results_as_of
//
// Re-runnable: a run with unchanged feeds changes nothing. Certified returns
// replace these rows through the usual importers later.
//
// Usage:
//   npm run sync:race-results -- [--year=2026] [--dry-run] [--verbose]
//   ENV_FILE=.env.cloud npm run sync:race-results

import { randomUUID } from "node:crypto";
import { arg, fetchJson, flag, runImport, STATE_NAME_TO_ABBR } from "./lib/bulk.mjs";
import { upsertEntities } from "./lib/entities.mjs";
import {
  assertFeedComplete,
  decideCall,
  decideFlip,
  matchNominee,
  nameParts,
  onePartyLeft,
  parseNytRace,
} from "./lib/race-results.mjs";
import { overviewRaces } from "./lib/wiki-races.mjs";

const YEAR = Number(arg("year", "2026"));
const DRY_RUN = flag("dry-run");
const VERBOSE = flag("verbose");

// First Tuesday after the first Monday of November.
function electionDate(year) {
  const firstMonday = 1 + ((8 - new Date(Date.UTC(year, 10, 1)).getUTCDay()) % 7);
  return `${year}-11-${String(firstMonday + 1).padStart(2, "0")}`;
}

async function wikitext(page) {
  const url = new URL("https://en.wikipedia.org/w/api.php");
  url.search = new URLSearchParams({ action: "parse", page, prop: "wikitext", format: "json", formatversion: "2" });
  const data = await fetchJson(url, {}, { label: page });
  if (!data.parse) throw new Error(`Wikipedia page not found: ${page}`);
  return data.parse.wikitext;
}

// Tells the site to re-render the race pages that changed and the home page,
// which shows the closest races. They are cached for a week and a day otherwise.
async function revalidate(ids) {
  const site = process.env.SITE_URL;
  const secret = process.env.REVALIDATE_SECRET;
  if (!site || !secret || ids.length === 0) return;
  try {
    const res = await fetch(`${site.replace(/\/$/, "")}/api/writ/revalidate`, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}`, "content-type": "application/json" },
      body: JSON.stringify({ paths: ["/", ...ids.map((id) => `/elections/${id}`)] }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) console.warn(`  revalidate -> ${res.status}`);
  } catch (err) {
    console.warn(`  revalidate failed: ${err.message}`);
  }
}

const list = (items) => (items.length ? items.join(", ") : "none");

await runImport("race-results", async (pg) => {
  const date = electionDate(YEAR);
  console.log(`Race results ${YEAR} (${date})${DRY_RUN ? " (dry run)" : ""}`);

  const [senateFeed, governorFeed, houseFeed, senate, governors, house] = await Promise.all([
    ...["senate", "governor", "house"].map((office) =>
      fetchJson(`https://static01.nyt.com/elections-assets/pages/data/${date}/results-${office}.json`, {}, { label: `NYT ${office}` }),
    ),
    wikitext(`${YEAR} United States Senate elections`),
    wikitext(`${YEAR} United States gubernatorial elections`),
    wikitext(`${YEAR} United States House of Representatives elections`),
  ]);
  const feedAsOf = senateFeed.resultsMeta?.resultsUpdatedAt ?? new Date().toISOString();

  const wikiRaces = overviewRaces({ senate, governors, house }, STATE_NAME_TO_ABBR);
  const wikiByExt = new Map();
  for (const [prefix, races] of Object.entries(wikiRaces)) {
    for (const race of races) wikiByExt.set(`cycle:${YEAR}:${prefix}:${race.key}`, race);
  }

  const { rows: electionRows } = await pg.query(
    `SELECT id, external_id, status, total_votes, call_status, reporting_pct, flipped
       FROM elections WHERE cycle = $1 AND external_id LIKE 'cycle:%'`,
    [YEAR],
  );
  const electionByExt = new Map(electionRows.map((row) => [row.external_id, row]));
  const expected = { senate: 0, governor: 0, house: 0 };
  for (const row of electionRows) {
    const prefix = row.external_id.split(":")[2];
    if (prefix in expected) expected[prefix] += 1;
  }

  const { rows: candidacyRows } = await pg.query(
    `SELECT c.id, c.election_id, c.candidate_entity_id, c.party, c.incumbent, c.votes, c.won, n.name
       FROM candidacies c
       JOIN elections e ON e.id = c.election_id
       JOIN entities n ON n.id = c.candidate_entity_id
      WHERE e.cycle = $1 AND c.status = 'nominee' AND NOT c.withdrew
      ORDER BY c.id`, // Stable, so a person imported twice matches the same row every run.
    [YEAR],
  );
  const { rows: politicians } = await pg.query("SELECT id, name FROM entities WHERE type = 'politician'");
  const politiciansByName = new Map();
  for (const person of politicians) {
    const key = nameParts(person.name).full;
    politiciansByName.set(key, [...(politiciansByName.get(key) ?? []), person.id]);
  }
  const nomineesByElection = new Map();
  for (const row of candidacyRows) {
    nomineesByElection.set(row.election_id, [...(nomineesByElection.get(row.election_id) ?? []), row]);
  }

  // Parse every feed before writing anything.
  const parsed = [];
  for (const [prefix, feed] of [["senate", senateFeed], ["governor", governorFeed], ["house", houseFeed]]) {
    const races = (feed.races ?? []).map(parseNytRace).filter(Boolean);
    assertFeedComplete(prefix, races.length, expected[prefix]);
    parsed.push(...races);
  }

  const counts = { races: 0, called: 0, counting: 0, runoff: 0, racesChanged: 0, votesChanged: 0, rowsAdded: 0, smallLinesOmitted: 0 };
  const seats = {};
  const issues = { missingRace: [], conflict: [], wikiOnly: [], feedOnly: [], winnerUnmatched: [], flipDiffers: [], added: [], onePartyLeft: [], nonApCall: [] };
  const changedIds = [];

  if (!DRY_RUN) await pg.query("BEGIN");
  try {
    for (const race of parsed) {
      const ext = `cycle:${YEAR}:${race.prefix}:${race.key}`;
      const election = electionByExt.get(ext);
      if (!election) {
        issues.missingRace.push(ext);
        continue;
      }
      counts.races += 1;
      const wiki = wikiByExt.get(ext);
      const wikiWinner = wiki?.candidates.find((candidate) => candidate.won)?.name ?? null;
      const nominees = nomineesByElection.get(election.id) ?? [];
      const call = decideCall(race, wikiWinner);
      const label = `${race.prefix}:${race.key}`;
      if (call.issue === "conflict") issues.conflict.push(`${label} (feed ${race.winnerId}, wiki ${wikiWinner})`);
      if (call.issue === "wiki-only") issues.wikiOnly.push(`${label} (${wikiWinner})`);
      if (call.issue === "feed-only") issues.feedOnly.push(label);

      // Feed candidate -> nominee row, largest first so a tie-break can't take
      // a row from someone with more votes. Write-ins and lines under 1% not on
      // Wikipedia's list stay out of the race and count only in its total.
      // Anyone larger, or the winner, gets a row: leaving them out would
      // misstate the margin.
      const matchedRows = new Map();
      const free = [...nominees];
      const ordered = [...race.candidates]
        .filter((candidate) => !candidate.writeIn)
        .sort((a, b) => Number(b.incumbent) - Number(a.incumbent) || b.votes - a.votes);
      for (const candidate of ordered) {
        let row = matchNominee(candidate, free);
        if (!row) {
          const share = race.totalVotes ? candidate.votes / race.totalVotes : 0;
          if (share < 0.01 && candidate.id !== race.winnerId && !race.runoffIds.includes(candidate.id)) {
            counts.smallLinesOmitted += 1;
            continue;
          }
          counts.rowsAdded += 1;
          issues.added.push(`${label} ${candidate.name} (${candidate.party}, ${(share * 100).toFixed(1)}%)`);
          const matches = politiciansByName.get(nameParts(candidate.name).full) ?? [];
          const entityId = matches.length === 1 ? matches[0] : randomUUID();
          row = { id: randomUUID(), election_id: election.id, candidate_entity_id: entityId, name: candidate.name, party: candidate.partyName, incumbent: candidate.incumbent, votes: null, won: false };
          if (!DRY_RUN) {
            if (matches.length !== 1) {
              await upsertEntities(pg, [{
                id: entityId,
                type: "politician",
                name: candidate.name,
                description: [candidate.partyName, `${YEAR} candidate`, race.key.slice(0, 2)].filter(Boolean).join(" · "),
                metadata: JSON.stringify({ party: candidate.partyName || undefined, state: race.key.slice(0, 2), importedFrom: "race-results" }),
              }]);
            }
            const { rows: inserted } = await pg.query(
              `INSERT INTO candidacies (id, election_id, candidate_entity_id, party, incumbent, status, withdrew, external_id)
               VALUES ($1, $2, $3, $4, $5, 'nominee', false, $6)
               ON CONFLICT (election_id, candidate_entity_id)
               DO UPDATE SET status = 'nominee', withdrew = false
               RETURNING id, votes, won`,
              [row.id, election.id, entityId, candidate.partyName || null, candidate.incumbent, `nyt:${ext}:${entityId}`],
            );
            Object.assign(row, inserted[0]);
          }
        } else {
          free.splice(free.indexOf(row), 1);
        }
        matchedRows.set(candidate.id, row);
      }

      // A called winner we can't place stays uncalled rather than wrong.
      let callStatus = call.callStatus;
      let winnerRow = call.winnerId ? matchedRows.get(call.winnerId) : null;
      if (call.winnerId && !winnerRow) {
        issues.winnerUnmatched.push(`${label} (${race.winnerId})`);
        callStatus = "counting";
        winnerRow = null;
      }
      counts[callStatus] += 1;
      if (callStatus === "called" && race.calledBy.some((who) => who !== "ap")) issues.nonApCall.push(`${label} (${race.calledBy.join("/")})`);
      if (callStatus === "called") {
        const party = race.candidates.find((candidate) => candidate.id === call.winnerId)?.party ?? "?";
        const group = seats[race.prefix] ?? (seats[race.prefix] = {});
        group[party] = (group[party] ?? 0) + 1;
      }
      if (callStatus !== "called") {
        const only = onePartyLeft(race);
        if (only) issues.onePartyLeft.push(`${label} (${only})`);
      }

      const flipped = decideFlip(callStatus, race.gained, wiki?.status);
      const wikiSaysGain = /\bgain\b/i.test(wiki?.status ?? "");
      if (callStatus === "called" && race.gained != null && wiki && wikiSaysGain !== race.gained) {
        issues.flipDiffers.push(`${label} (feed ${race.gained}, wiki "${wiki.status}")`);
      }

      let changed = false;
      for (const [feedId, row] of matchedRows) {
        const candidate = race.candidates.find((item) => item.id === feedId);
        // An uncontested seat reports no count.
        const votes = race.uncontested && !candidate.votes ? null : candidate.votes;
        const won = row === winnerRow;
        if (row.votes === votes && row.won === won) continue;
        counts.votesChanged += 1;
        changed = true;
        if (!DRY_RUN) await pg.query("UPDATE candidacies SET votes = $1, won = $2 WHERE id = $3", [votes, won, row.id]);
      }
      // A row with no feed line this run (a duplicate of someone matched, or a
      // winner since dropped) can't keep votes or a win.
      for (const row of nominees) {
        if ([...matchedRows.values()].includes(row) || (row.votes == null && !row.won)) continue;
        changed = true;
        if (!DRY_RUN) await pg.query("UPDATE candidacies SET votes = NULL, won = false WHERE id = $1", [row.id]);
      }

      const status = race.certified ? "certified" : "provisional";
      const sameRace =
        election.status === status &&
        election.total_votes === race.totalVotes &&
        election.call_status === callStatus &&
        election.flipped === flipped &&
        Math.abs(Number(election.reporting_pct ?? -1) - Number(race.reportingPct ?? -1)) < 0.001;
      if (!sameRace) {
        changed = true;
        if (!DRY_RUN) {
          await pg.query(
            `UPDATE elections SET status = $1, total_votes = $2, call_status = $3, reporting_pct = $4,
                    flipped = $5, results_as_of = $6, updated_at = now() WHERE id = $7`,
            [status, race.totalVotes, callStatus, race.reportingPct, flipped, feedAsOf, election.id],
          );
        }
      }
      if (changed) {
        counts.racesChanged += 1;
        changedIds.push(election.id);
      }
    }
    if (!DRY_RUN) await pg.query("COMMIT");
  } catch (err) {
    if (!DRY_RUN) await pg.query("ROLLBACK");
    throw err;
  }

  if (!DRY_RUN) await revalidate(changedIds);

  console.log("  ", counts);
  console.log("   called, by feed party:", JSON.stringify(seats));
  console.log(`   conflicts (blocked): ${list(issues.conflict)}`);
  console.log(`   winner has no nominee row (blocked): ${list(issues.winnerUnmatched)}`);
  console.log(`   race not scaffolded: ${list(issues.missingRace)}`);
  console.log(`   called on Wikipedia only (${issues.wikiOnly.length}): ${list(issues.wikiOnly)}`);
  console.log(`   called in feed only (${issues.feedOnly.length}): ${list(issues.feedOnly)}`);
  console.log(`   flip disagreements (${issues.flipDiffers.length}): ${list(issues.flipDiffers)}`);
  console.log(`   rows added, not on Wikipedia's list (${issues.added.length}): ${list(issues.added)}`);
  console.log(`   uncalled but one party left (${issues.onePartyLeft.length}): ${list(issues.onePartyLeft)}`);
  if (VERBOSE) console.log(`   not called by AP alone (${issues.nonApCall.length}): ${list(issues.nonApCall)}`);
  return { inserted: counts.rowsAdded, updated: counts.racesChanged };
});
