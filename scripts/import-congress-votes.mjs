// Imports roll-call votes for a Congress from the Congress.gov house-vote /
// senate-vote endpoints into `roll_calls` + `votes`, matching members to
// `politician` entities by bioguideId. Run `npm run import:congress-bills`
// first so roll calls can link to bills. Incremental via a padded
// per-chamber cursor in `sync_runs`; `--full` re-sweeps.
//
// Self-contained (raw pg + neo4j-driver), matching import-congress-bills.mjs.
// Shared tested helpers come from src/lib/legislation/congress.ts.
//
// Usage:
//   npm run import:congress-votes
//   npm run import:congress-votes -- --congress=119 --sessions=1,2 --full --limit=25
//
// Needs CONGRESS_GOV_API_KEY in .env.local.

process.loadEnvFile(".env.local");

import { Client } from "pg";
import neo4j from "neo4j-driver";
import {
  rollCallExternalId,
  rollCallCursorKey,
  normalizeVotePosition,
  billExternalId,
  pickResultsArray,
  pickVoteMeta,
  findMemberVotes,
  readMemberVote,
} from "../src/lib/legislation/congress.ts";

const SOURCE = "congress-votes";
const API_BASE = "https://api.congress.gov/v3";
const PAGE_SIZE = 250;
const DELAY_MS = 200;

const apiKey = process.env.CONGRESS_GOV_API_KEY;
if (!apiKey) {
  console.error("CONGRESS_GOV_API_KEY is not set in .env.local");
  process.exit(1);
}

function arg(name, fallback) {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.slice(name.length + 3) : fallback;
}
const FULL = process.argv.includes("--full");
const LIMIT = arg("limit") ? Number(arg("limit")) : Infinity;
const now = new Date();
const CONGRESS = Number(arg("congress", Math.floor((now.getFullYear() - 1789) / 2) + 1));
const SESSIONS = arg("sessions")
  ? arg("sessions").split(",").map((s) => Number(s.trim())).filter(Boolean)
  : [1, 2];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function api(path) {
  const url = `${API_BASE}${path}${path.includes("?") ? "&" : "?"}format=json&api_key=${apiKey}`;
  const res = await fetch(url, { headers: { accept: "application/json" } });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status}`);
  await sleep(DELAY_MS);
  return res.json();
}

async function main() {
  const pg = new Client({ connectionString: process.env.DATABASE_URL });
  await pg.connect();
  const driver = neo4j.driver(
    process.env.NEO4J_URI,
    neo4j.auth.basic(process.env.NEO4J_USER, process.env.NEO4J_PASSWORD),
  );
  const session = driver.session();

  let inserted = 0;
  let updated = 0;
  let skipped = 0;
  let status = "ok";
  let errorMessage = null;
  let maxKey = null;

  const { rows: runRows } = await pg.query(
    "insert into sync_runs (source, status) values ($1, 'ok') returning id",
    [SOURCE],
  );
  const runId = runRows[0].id;

  try {
    const entityRes = await session.run(
      "MATCH (e:Entity {type: 'politician'}) WHERE e.bioguideId IS NOT NULL RETURN e.bioguideId AS b, e.id AS id",
    );
    const bioguideMap = new Map(entityRes.records.map((r) => [String(r.get("b")), String(r.get("id"))]));
    console.log(`${bioguideMap.size} politician entities carry a bioguideId`);

    const cursorRes = await pg.query(
      "select cursor from sync_runs where source = $1 and finished_at is not null order by started_at desc limit 1",
      [SOURCE],
    );
    const cursor = FULL ? null : (cursorRes.rows[0]?.cursor ?? null);
    maxKey = cursor;

    const srcRes = await pg.query(
      `insert into sources (title, url, publisher, source_type, notes)
       values ($1, $2, $3, 'official_statement', $4) returning id`,
      [
        `Congress.gov roll-call import — ${CONGRESS}th Congress (${now.toISOString().slice(0, 10)})`,
        "https://www.congress.gov/roll-call-votes",
        "Clerk of the House / Secretary of the Senate",
        "Roll-call votes imported from the Congress.gov vote endpoints.",
      ],
    );
    const sourceId = srcRes.rows[0].id;

    let processed = 0;

    outer: for (const sess of SESSIONS) {
      for (const chamber of ["house", "senate"]) {
        const chamberLabel = chamber === "house" ? "House" : "Senate";
        let offset = 0;

        for (;;) {
          const page = await api(`/${chamber}-vote/${CONGRESS}/${sess}?limit=${PAGE_SIZE}&offset=${offset}`);
          const items = pickResultsArray(page);
          if (items.length === 0) break;

          for (const item of items) {
            const rollNumber = item.rollCallNumber ?? item.voteNumber ?? 0;
            const externalId = rollCallExternalId(chamberLabel, CONGRESS, sess, rollNumber);
            const sortKey = rollCallCursorKey(chamberLabel, sess, rollNumber);
            if (cursor && sortKey <= cursor && !FULL) continue;
            if (!maxKey || sortKey > maxKey) maxKey = sortKey;

            try {
              // The members payload carries the vote metadata the list
              // endpoint omits (voteQuestion), so fetch it first.
              const membersPayload = await api(
                `/${chamber}-vote/${CONGRESS}/${sess}/${rollNumber}/members`,
              );
              const meta = pickVoteMeta(membersPayload);

              const legType = meta.legislationType ?? item.legislationType;
              const legNum = meta.legislationNumber ?? item.legislationNumber;
              const billExt =
                legType && legNum != null ? billExternalId(CONGRESS, legType, legNum) : null;
              const billRes = billExt
                ? await pg.query("select id from bills where external_id = $1", [billExt])
                : null;
              const billId = billRes?.rows[0]?.id ?? null;

              const rcRes = await pg.query(
                `insert into roll_calls
                   (external_id, bill_id, congress, chamber, session, roll_number,
                    question, vote_type, result, date, source_id, updated_at)
                 values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11, now())
                 on conflict (external_id) do update set
                   bill_id = excluded.bill_id,
                   question = excluded.question,
                   vote_type = excluded.vote_type,
                   result = excluded.result,
                   source_id = excluded.source_id,
                   updated_at = now()
                 returning id, (xmax = 0) as inserted`,
                [
                  externalId,
                  billId,
                  CONGRESS,
                  chamberLabel,
                  sess,
                  rollNumber,
                  meta.voteQuestion ?? item.voteQuestion ?? item.question ?? null,
                  meta.voteType ?? item.voteType ?? null,
                  meta.result ?? item.result ?? null,
                  new Date(meta.startDate ?? item.startDate ?? item.date ?? now),
                  sourceId,
                ],
              );
              const rollCallId = rcRes.rows[0].id;

              const voteRows = [];
              for (const entry of findMemberVotes(membersPayload)) {
                const m = readMemberVote(entry);
                const entityId = m.bioguideId ? bioguideMap.get(m.bioguideId) : undefined;
                if (!entityId) continue;
                voteRows.push([entityId, normalizeVotePosition(m.position), m.party || null]);
              }

              await pg.query("begin");
              await pg.query("delete from votes where roll_call_id = $1", [rollCallId]);
              for (const [entityId, position, party] of voteRows) {
                await pg.query(
                  `insert into votes (roll_call_id, bill_id, voter_entity_id, position, party)
                   values ($1, $2, $3, $4, $5)`,
                  [rollCallId, billId, entityId, position, party],
                );
              }
              await pg.query("commit");

              if (rcRes.rows[0].inserted) inserted++;
              else updated++;
            } catch (err) {
              await pg.query("rollback").catch(() => {});
              skipped++;
              status = "partial";
              console.log(`  skip ${externalId}: ${err.message}`);
            }

            if (++processed >= LIMIT) break outer;
          }
          offset += PAGE_SIZE;
        }
      }
    }
  } catch (err) {
    status = "error";
    errorMessage = err.message;
    console.error(err);
  } finally {
    await pg.query(
      `update sync_runs set finished_at = now(), status = $2, rows_inserted = $3,
         rows_updated = $4, rows_skipped = $5, error = $6, cursor = $7 where id = $1`,
      [runId, status, inserted, updated, skipped, errorMessage, maxKey],
    );
    await session.close();
    await driver.close();
    await pg.end();
  }

  console.log(
    `\nroll calls: +${inserted} new, ~${updated} updated, ${skipped} skipped (status: ${status})`,
  );
  process.exit(status === "error" ? 1 : 0);
}

main();
