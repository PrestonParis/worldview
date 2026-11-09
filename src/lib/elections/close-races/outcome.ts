// What a contest's count means: who won, who advances, what is still open.
// Derived only from the SOS count and the contest's decision rule; a contest
// still counting has no outcome, so the tracker never calls a race.

import type { DecisionRule, ResultStatus } from "./types.ts";

export type OutcomeKind =
  | "counting"
  | "elected"
  | "unopposed"
  | "advancing_to_runoff"
  | "tied"
  | "passed"
  | "failed"
  | "rule_unverified"
  | "no_votes";

export interface OutcomeInput {
  resultStatus: ResultStatus;
  decisionRule: DecisionRule;
  voteFor: number;
  totalVotes: number;
  marginVotes: number | null;
  leaderShare: number | null;
  uncontested: boolean;
  flags: readonly string[];
  /** For a single seat, first place; for vote-for-N, the last winner. */
  leaderName: string | null;
  runnerUpName: string | null;
  runnerUpVotes: number | null;
  /** The option after the runner-up: a tie with it leaves a runoff slot open. */
  thirdVotes?: number | null;
}

export interface Outcome {
  kind: OutcomeKind;
  label: string;
  /** Names the runoff is between. One name and `secondSlotTied` when second place is tied. */
  advancing: string[];
  secondSlotTied: boolean;
}

const CERTIFIED = new Set<ResultStatus>(["county_certified", "state_certified"]);
const COUNTING = new Set<ResultStatus>(["no_results", "reporting"]);
const YES = /^(yes|si|sí)\b/i;

const plain = (kind: OutcomeKind, label: string): Outcome => ({ kind, label, advancing: [], secondSlotTied: false });

export function contestOutcome(c: OutcomeInput): Outcome {
  if (COUNTING.has(c.resultStatus)) return plain("counting", c.resultStatus === "reporting" ? "Counting" : "No results yet");
  if (c.flags.includes("no_votes_reported")) return plain("no_votes", "No votes posted");
  const certified = CERTIFIED.has(c.resultStatus);
  if (c.uncontested) return plain("unopposed", "Unopposed");
  if (c.decisionRule === "referendum") {
    if (c.marginVotes === 0) return plain("tied", "Tied");
    const pass = YES.test(c.leaderName ?? "");
    return plain(pass ? "passed" : "failed", certified ? (pass ? "Passed" : "Failed") : pass ? "Passing" : "Failing");
  }
  if (c.marginVotes === 0 && !c.flags.includes("runoff_required")) return plain("tied", "Tied");
  if (c.flags.includes("runoff_required")) {
    if (c.marginVotes === 0 && c.runnerUpVotes === c.thirdVotes) return plain("tied", "Tied");
    const secondSlotTied = c.runnerUpVotes != null && c.runnerUpVotes === c.thirdVotes;
    return {
      kind: "advancing_to_runoff",
      label: "Runoff",
      advancing: [c.leaderName, secondSlotTied ? null : c.runnerUpName].filter((n): n is string => Boolean(n)),
      secondSlotTied,
    };
  }
  if (c.decisionRule === "unknown" && c.voteFor === 1 && c.leaderShare != null && c.leaderShare <= 0.5) {
    return plain("rule_unverified", "Runoff rule unverified");
  }
  return plain("elected", certified ? "Winner" : "Apparent winner");
}

/**
 * A settled contest's outcome changing: what a late batch of ballots can do
 * without changing the leader, like falling under 50%. Once a contest has an
 * outcome only; the first results coming in aren't news.
 */
export function outcomeChange(
  before: { kind: OutcomeKind; inRecountRange: boolean },
  after: { kind: OutcomeKind; inRecountRange: boolean },
): string | null {
  if (before.kind === "counting" || after.kind === "counting") return null;
  if (before.kind !== after.kind) return `${KIND_WORDS[before.kind]} → ${KIND_WORDS[after.kind]}`;
  if (before.inRecountRange !== after.inRecountRange) return after.inRecountRange ? "entered recount-request range" : "left recount-request range";
  return null;
}

const KIND_WORDS: Record<OutcomeKind, string> = {
  counting: "counting",
  elected: "winner",
  unopposed: "unopposed",
  advancing_to_runoff: "runoff",
  tied: "tied",
  passed: "passing",
  failed: "failing",
  rule_unverified: "below 50%, rule unverified",
  no_votes: "no votes posted",
};

/** True when the outcome names a winner a seat count can credit. */
export function seatIsDecided(kind: OutcomeKind): boolean {
  return kind === "elected" || kind === "unopposed";
}
