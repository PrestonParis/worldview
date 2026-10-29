// Imports chosen roll calls, with every member's vote, from Voteview into
// `roll_calls` + `votes` — for votes outside what import:congress-votes
// covers (Congress.gov has no Senate vote endpoint, and its House endpoint
// starts with the 118th Congress). The default set is KEY_VOTES from
// src/lib/israel/records.ts; --ids picks others by roll_calls.external_id.
// Members resolve to politician entities through member_ideology (run
// import:voteview first), so each vote shows on the member's profile.
//
// Source: https://voteview.com/data — free CSV, no key.
//
// Usage:
//   node scripts/import-voteview-rollcalls.mjs [--ids=s118-2-292,h118-2-152]
//   ENV_FILE=.env.cloud node scripts/import-voteview-rollcalls.mjs

import { arg, fetchRetry, parseCsv, runImport } from "./lib/bulk.mjs";
import { KEY_VOTES } from "../src/lib/israel/records.ts";

const BASE = "https://voteview.com/static/data/out";
// Voteview cast codes: 1–3 yea, 4–6 nay, 7–8 present, 9 not voting.
const POSITION = { 1: "yea", 2: "yea", 3: "yea", 4: "nay", 5: "nay", 6: "nay", 7: "present", 8: "present", 9: "absent" };
const PARTY = { 100: "D", 200: "R", 328: "I" };

const wanted = arg("ids", "")
  ? arg("ids", "").split(",").map((id) => {
      const m = /^([hs])(\d+)-(\d)-(\d+)$/.exec(id.trim());
      if (!m) throw new Error(`bad id ${id}`);
      return { id: id.trim(), chamber: m[1] === "s" ? "Senate" : "House", congress: Number(m[2]), session: Number(m[3]), roll: Number(m[4]) };
    })
  : KEY_VOTES;

await runImport("voteview-rollcalls", async (pg) => {
  let rollCalls = 0;
  let votes = 0;
  const groups = Map.groupBy(wanted, (v) => `${v.chamber[0]}${v.congress}`);
  for (const [key, list] of groups) {
    const { chamber, congress } = list[0];
    const [rcCsv, voteCsv] = await Promise.all([
      fetchRetry(`${BASE}/rollcalls/${key}_rollcalls.csv`).then((r) => r.text()),
      fetchRetry(`${BASE}/votes/${key}_votes.csv`).then((r) => r.text()),
    ]);
    const calls = parseCsv(rcCsv);
    const members = await pg.query(
      `select icpsr, entity_id, party_code from member_ideology where congress = $1 and chamber = $2 and entity_id is not null`,
      [congress, chamber],
    );
    const entityOf = new Map(members.rows.map((r) => [String(r.icpsr), r]));
    const castByRoll = Map.groupBy(parseCsv(voteCsv), (v) => v.rollnumber);

    for (const want of list) {
      const rc = calls.find((c) => Number(c.session) === want.session && Number(c.clerk_rollnumber) === want.roll);
      if (!rc) throw new Error(`${want.id}: not in Voteview ${key}`);
      const bill = rc.bill_number ? await pg.query(`select id from bills where external_id = $1`, [billKey(congress, rc.bill_number)]) : { rows: [] };
      const [row] = (
        await pg.query(
          `insert into roll_calls (external_id, congress, chamber, session, roll_number, question, vote_type, result, date, bill_id, jurisdiction)
           values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'us')
           on conflict (external_id) do update set question = excluded.question, result = excluded.result,
             bill_id = coalesce(roll_calls.bill_id, excluded.bill_id), updated_at = now()
           returning id`,
          [want.id, congress, chamber, want.session, want.roll, rc.vote_question || rc.vote_desc, "Yea-And-Nay", rc.vote_result, rc.date, bill.rows[0]?.id ?? null],
        )
      ).rows;
      rollCalls++;
      const out = [];
      for (const v of castByRoll.get(rc.rollnumber) ?? []) {
        const m = entityOf.get(v.icpsr);
        const position = POSITION[v.cast_code];
        if (!m || !position) continue;
        out.push({ roll_call_id: row.id, bill_id: bill.rows[0]?.id ?? null, voter_entity_id: m.entity_id, position, party: PARTY[m.party_code] ?? null });
      }
      const yeas = out.filter((o) => o.position === "yea").length;
      console.log(`  ${want.id} ${rc.date} ${rc.vote_result}: ${out.length} members linked, ${yeas} yea (Voteview ${rc.yea_count}-${rc.nay_count})`);
      // Replaced wholesale: votes' unique key is a partial index, which an
      // upsert can't target.
      if (out.length) {
        await pg.query(`delete from votes where roll_call_id = $1`, [row.id]);
        await pg.query(
          `insert into votes (roll_call_id, bill_id, voter_entity_id, position, party)
           select * from unnest($1::uuid[], $2::uuid[], $3::uuid[], $4::vote_position[], $5::text[])`,
          [out.map((o) => o.roll_call_id), out.map((o) => o.bill_id), out.map((o) => o.voter_entity_id), out.map((o) => o.position), out.map((o) => o.party)],
        );
        votes += out.length;
      }
    }
  }
  return { inserted: votes, updated: rollCalls };
});

// Voteview "HR8034" / "SJRES111" → bills.external_id "118-hr-8034".
function billKey(congress, number) {
  const m = /^([A-Z]+)(\d+)$/.exec(number.replace(/[\s.]/g, "").toUpperCase());
  return m ? `${congress}-${m[1].toLowerCase()}-${m[2]}` : "";
}
