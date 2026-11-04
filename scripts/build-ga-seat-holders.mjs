// Who held each Georgia seat going into Nov 3, 2026, for the results hub's
// flips and net change. Writes data/elections/ga/seat-holders-2026.json; run it
// once per cycle: node scripts/build-ga-seat-holders.mjs [--dry-run]
//
// The feed marks incumbents, but says nothing about an open seat, so holders
// are rebuilt from results: the last general that filled each seat, then every
// special and runoff since, in date order. Replaying matters: House 121's
// incumbent won a Dec 2025 special, so the 2024 general alone has the wrong
// party. A 2026 incumbent must then agree with the result. A disagreement
// fails the build until data/elections/ga/seat-holder-overrides.json records
// the sourced reason (a party switch, or a seat no feed covers).

import fs from "node:fs";
import path from "node:path";
import { flag } from "./lib/bulk.mjs";
import { sosClient } from "./lib/ga-sos.mjs";
import { electionKind, parseElectionList, parseFeed, primaryPartyFromName } from "../src/lib/elections/close-races/parse.ts";
import { seatKey } from "../src/lib/elections/close-races/seats.ts";

const CURRENT = "11032026GeneralAndSpecialElection";
const OUT = "data/elections/ga/seat-holders-2026.json";
const OVERRIDES = "data/elections/ga/seat-holder-overrides.json";
const DRY_RUN = flag("dry-run");

// Oldest first. Statewide offices last filled in 2022; the legislature and
// U.S. House in 2024. Everything after is walked from the SOS election list.
const BASE = ["2020NovGen", "2021JanFedRun", "2022NovGen", "2022DecGenRun", "2024NovGen"];
const REPLAY_FROM = "2024-11-06";

/** The winner a general or special settles: a majority, or the top of a runoff. */
export function settledWinner(contest, kind) {
  const candidates = contest.options.filter((o) => !o.isWriteIn);
  const total = contest.options.reduce((s, o) => s + o.votes, 0);
  const sorted = [...candidates].sort((a, b) => b.votes - a.votes);
  const top = sorted[0];
  if (!top || !total) return null;
  if (sorted[1] && sorted[1].votes === top.votes) return null;
  if (kind === "runoff" || kind === "recount") return top;
  return top.votes * 2 > total ? top : null;
}

const client = sosClient({ concurrency: 2 });

async function main() {
  const { json } = await client.list();
  const elections = parseElectionList(json).map((e) => ({ ...e, sort: e.date }));
  const replay = elections
    .filter((e) => e.date >= REPLAY_FROM && e.id !== CURRENT && e.kind !== "primary" && !/primary/i.test(e.name))
    .sort((a, b) => a.date.localeCompare(b.date) || rankKind(a.kind) - rankKind(b.kind));
  const base = BASE.map((id) => elections.find((e) => e.id === id)).filter(Boolean);

  const holders = {};
  const log = [];
  for (const election of [...base, ...replay]) {
    const { json: raw } = await client.state(election.id);
    const feed = parseFeed(raw);
    const kind = electionKind(election.name);
    let filled = 0;
    for (const contest of feed.contests) {
      const key = seatKey(contest.name);
      // A party's primary or its recount ("PSC - District 3 - Rep") fills no seat.
      if (!key || primaryPartyFromName(contest.name)) continue;
      const winner = settledWinner(contest, kind);
      if (!winner) continue;
      // Some special feeds list no party. The seat keeps its last known party,
      // and the file says so.
      const prior = holders[key];
      if (!winner.party && !prior) continue;
      holders[key] = winner.party
        ? { party: winner.party, name: winner.name, source: election.id }
        : { party: prior.party, name: winner.name, source: `${election.id} (feed lists no party; party from ${prior.source})` };
      filled++;
    }
    log.push(`${election.date} ${election.id}: ${filled} seats`);
  }
  console.log(log.join("\n"));

  // Overrides apply before validation: they exist to explain a disagreement.
  const overrides = fs.existsSync(OVERRIDES) ? JSON.parse(fs.readFileSync(OVERRIDES, "utf8")) : {};
  for (const [key, value] of Object.entries(overrides)) {
    if (key.startsWith("_")) continue;
    if (!value.source) throw new Error(`override ${key} has no source`);
    holders[key] = value;
  }

  const current = parseFeed((await client.state(CURRENT)).json);
  const problems = [];
  const seats = new Set();
  for (const contest of current.contests) {
    const key = seatKey(contest.name);
    if (!key) continue;
    seats.add(key);
    const incumbent = contest.options.find((o) => o.incumbent);
    const holder = holders[key];
    if (!holder) {
      // A running incumbent is itself a source for a seat no replayed feed filled.
      if (incumbent?.party) holders[key] = { party: incumbent.party, name: incumbent.name, source: `${CURRENT} (incumbent marker)` };
      else problems.push(`${key} ${contest.name}: no holder and no incumbent running`);
    } else if (incumbent?.party && incumbent.party !== holder.party) {
      problems.push(`${key} ${contest.name}: 2026 incumbent ${incumbent.name} (${incumbent.party}) but replay says ${holder.name} (${holder.party}, ${holder.source})`);
    } else if (incumbent) {
      // Appointees and the other U.S. Senate seat: the party agrees, the name is the incumbent's.
      holder.name = incumbent.name;
    }
  }
  const counts = {};
  for (const key of seats) counts[key.split(":")[0]] = (counts[key.split(":")[0]] ?? 0) + 1;
  console.log("seats on the 2026 ballot", counts);
  if (problems.length) {
    console.error(`\n${problems.length} seat(s) need a sourced entry in ${OVERRIDES}:\n${problems.join("\n")}`);
    process.exitCode = 1;
    return;
  }
  const seatsOut = Object.fromEntries([...seats].sort().map((k) => [k, holders[k]]));
  const body = {
    _comment: "Built by scripts/build-ga-seat-holders.mjs from SOS results; see that file. Don't edit by hand; add to seat-holder-overrides.json.",
    seats: seatsOut,
  };
  if (DRY_RUN) console.log(`dry run: ${Object.keys(seatsOut).length} seats, nothing written`);
  else {
    fs.mkdirSync(path.dirname(OUT), { recursive: true });
    fs.writeFileSync(OUT, `${JSON.stringify(body, null, 2)}\n`);
    console.log(`wrote ${OUT} (${Object.keys(seatsOut).length} seats)`);
  }
}

// On one date a recount replaces the count it re-ran, and a runoff settles a special.
function rankKind(kind) {
  return kind === "recount" ? 2 : kind === "runoff" ? 1 : 0;
}

await main();
