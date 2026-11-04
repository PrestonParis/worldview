// One contest's precinct results, from SOS's
// /elections/{county}/{id}/ballot-items/{contest} endpoint. Used two ways: as an
// audit that precincts add up to the contest, for contests close enough that
// one batch of ballots matters; and to say where an unnamed city contest was
// voted, since the feed's "Mayor (Special)" doesn't.

import { parseCandidateName, text } from "./parse.ts";

/* eslint-disable @typescript-eslint/no-explicit-any -- untyped vendor JSON */
type Raw = any;

export interface PrecinctRow {
  precinct: string;
  totalVotes: number;
  votes: Record<string, number>;
}

export function parseBreakdown(raw: Raw): PrecinctRow[] {
  return (raw?.breakdownResults ?? []).map((row: Raw) => {
    const votes: Record<string, number> = {};
    for (const option of row.ballotOptions ?? []) {
      const name = parseCandidateName(text(option.name)).name;
      votes[name] = (votes[name] ?? 0) + (Number(option.voteCount) || 0);
    }
    return { precinct: text(row.precinct?.name) || "Unnamed precinct", totalVotes: Number(row.voteTotal) || 0, votes };
  });
}

/** Candidates whose precinct votes don't add up to their contest total. */
export function breakdownMismatches(raw: Raw, rows: PrecinctRow[]): string[] {
  if (!rows.length) return [];
  const out: string[] = [];
  for (const option of raw?.summaryResults?.ballotOptions ?? []) {
    const name = parseCandidateName(text(option.name)).name;
    const sum = rows.reduce((s, r) => s + (r.votes[name] ?? 0), 0);
    const total = Number(option.voteCount) || 0;
    if (sum !== total) out.push(`${name}: contest ${total}, precincts ${sum}`);
  }
  return out;
}

const WATCHED_FLAGS = ["tie", "recount_request_range", "runoff_required", "near_runoff", "runoff_rule_unverified"];
/** Under this, a late batch of ballots could matter. */
const CLOSE_PTS = 1;

/** Contests worth the extra requests: close ones, and city contests the feed doesn't place. */
export function watchesPrecincts(c: { flags: readonly string[]; level: string; scope: string; municipality: string | null; rule: string; marginPct: number | null }): boolean {
  if (c.flags.some((f) => WATCHED_FLAGS.includes(f))) return true;
  if (c.marginPct != null && c.marginPct < CLOSE_PTS) return true;
  if (c.rule === "unknown") return true;
  // A statewide amendment needs no placing, and is on every county's ballot.
  return c.scope !== "state" && (c.level === "municipal" || c.level === "referendum") && !c.municipality;
}

/** At most this many precincts reads as a place; more is a countywide contest. */
const PLACE_PRECINCTS = 3;

/** Where a contest was voted, when that's a short list. */
export function votedIn(precincts: { precinct: string; totalVotes: number }[]): string[] {
  const used = precincts.filter((p) => p.totalVotes > 0).map((p) => p.precinct);
  return used.length && used.length <= PLACE_PRECINCTS ? used.sort() : [];
}

/** State totals that differ from the sum of a complete set of county slices. */
export function stateCountyMismatches(contests: { name: string; scope: string; totalUnits: number; options: { name: string; votes: number }[]; areas: { options: { name: string; votes: number }[] }[] }[]): string[] {
  const out: string[] = [];
  for (const c of contests) {
    if (c.scope !== "state" || !c.areas.length || c.areas.length !== c.totalUnits) continue;
    for (const option of c.options) {
      const sum = c.areas.reduce((s, a) => s + a.options.filter((o) => o.name === option.name).reduce((t, o) => t + o.votes, 0), 0);
      if (sum !== option.votes) out.push(`${c.name} — ${option.name}: state ${option.votes}, counties ${sum}`);
    }
  }
  return out;
}
