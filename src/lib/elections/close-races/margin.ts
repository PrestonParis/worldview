// Margin, flags and result status for one contest (docs/writ-close-races.md
// §4). The canonical ranking is the raw vote margin; percentage-point margin
// is the alternate sort.

import type { CloseRaceSort, ContestFlag, DecisionRule, MarginResult, ParsedOption, ResultStatus } from "./types.ts";

/** Margin at or under this many points is in recount-request range (O.C.G.A. § 21-2-495(c)). */
export const RECOUNT_REQUEST_PCT = 0.5;
/** A majority contest whose leader is within this many points of 50% is "near runoff". */
export const NEAR_RUNOFF_PTS = 1;

export function computeMargin({
  options,
  voteFor,
  rule,
  threshold,
}: {
  options: ParsedOption[];
  voteFor: number;
  rule: DecisionRule;
  threshold: number | null;
}): MarginResult {
  const totalVotes = options.reduce((sum, o) => sum + o.votes, 0);
  const sorted = [...options].sort((a, b) => b.votes - a.votes || a.name.localeCompare(b.name));
  const candidates = options.filter((o) => !o.isWriteIn).length;
  const uncontested = rule !== "referendum" && candidates <= voteFor;
  const seats = rule === "referendum" ? 1 : Math.max(1, voteFor);
  const hasCutoff = sorted.length > seats;
  const cutoffWinner = hasCutoff ? sorted[seats - 1] : null;
  const cutoffLoser = hasCutoff ? sorted[seats] : null;
  const marginVotes = cutoffWinner && cutoffLoser ? cutoffWinner.votes - cutoffLoser.votes : null;
  const marginPct = marginVotes != null && totalVotes > 0 ? (marginVotes / totalVotes) * 100 : null;
  const leader = sorted[0] && sorted[0].votes > 0 ? sorted[0] : null;
  const runnerUp = sorted[1] ?? null;
  const leaderShare = leader && totalVotes > 0 ? leader.votes / totalVotes : null;
  const tie = marginVotes === 0 && totalVotes > 0;
  const withVotes = options.filter((o) => o.votes > 0).length;
  const rankable = !uncontested && marginVotes != null && totalVotes > 0 && withVotes >= 2;

  const flags: ContestFlag[] = [];
  if (rankable && tie) flags.push("tie");
  if (rankable && rule !== "referendum" && marginPct != null && marginPct <= RECOUNT_REQUEST_PCT) {
    flags.push("recount_request_range");
  }
  if (rankable && leaderShare != null && seats === 1) {
    const line = (threshold ?? 0.5) * 100;
    const share = leaderShare * 100;
    if (rule === "majority") {
      // A majority means more than half: exactly 50% still goes to a runoff.
      if (leader!.votes * 2 <= totalVotes) flags.push("runoff_required");
      else if (share - line <= NEAR_RUNOFF_PTS) flags.push("near_runoff");
    } else if (rule === "unknown" && share - line <= NEAR_RUNOFF_PTS) {
      flags.push("runoff_rule_unverified");
    }
  }

  const ranked = sorted.map((option, i) => ({
    ...option,
    rank: i + 1,
    // Inside the cutoff, and not tied with the first loser.
    isApparentWinner:
      totalVotes > 0 && option.votes > 0 && i < seats && !(cutoffLoser && option.votes === cutoffLoser.votes),
    isCurrentLeader: leader != null && i === 0 && !(runnerUp && runnerUp.votes === leader.votes),
  }));

  return {
    totalVotes,
    ranked,
    leader,
    runnerUp,
    cutoffWinner,
    cutoffLoser,
    marginVotes,
    marginPct,
    leaderShare,
    uncontested,
    rankable,
    flags,
  };
}

export function resultStatus({
  totalVotes,
  reportingUnits,
  totalUnits,
  isOfficial,
  scope,
  override,
}: {
  totalVotes: number;
  reportingUnits: number;
  totalUnits: number;
  isOfficial: boolean;
  scope: "state" | "county";
  override?: ResultStatus | null;
}): ResultStatus {
  if (override) return override;
  if (isOfficial) return scope === "state" ? "state_certified" : "county_certified";
  if (totalVotes === 0 && reportingUnits === 0) return "no_results";
  if (totalUnits > 0 && reportingUnits >= totalUnits) return "unofficial_complete";
  return "reporting";
}

interface Sortable {
  marginVotes: number | null;
  marginPct: number | null;
  name: string;
}

const last = Number.POSITIVE_INFINITY;

/** Smallest vote gap first; ties at zero naturally lead. */
export function compareByVotes(a: Sortable, b: Sortable): number {
  return (
    (a.marginVotes ?? last) - (b.marginVotes ?? last) ||
    (a.marginPct ?? last) - (b.marginPct ?? last) ||
    a.name.localeCompare(b.name)
  );
}

export function compareByPercent(a: Sortable, b: Sortable): number {
  return (
    (a.marginPct ?? last) - (b.marginPct ?? last) ||
    (a.marginVotes ?? last) - (b.marginVotes ?? last) ||
    a.name.localeCompare(b.name)
  );
}

export function comparator(sort: CloseRaceSort) {
  return sort === "percent" ? compareByPercent : compareByVotes;
}
