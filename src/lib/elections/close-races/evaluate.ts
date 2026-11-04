// An assembled contest → everything the tracker stores about it: level,
// decision rule, margin, flags and result status.

import { classifyContest } from "./level.ts";
import { computeMargin, resultStatus } from "./margin.ts";
import type { AssembledContest } from "./merge.ts";
import { decisionRule, type MunicipalRules } from "./rules.ts";
import type { ContestFlag, ContestLevel, DecisionRule, ElectionKind, MarginResult, ResultStatus } from "./types.ts";

export interface Overrides {
  /** Contest key or exact contest name → a status the feed can't express. */
  status?: Record<string, ResultStatus>;
  /** Contest names that must never merge across counties. */
  split?: string[];
  /** Ballot-question names that are one question across several counties. */
  merge?: string[];
  /** Municipal rules that apply to this election only. */
  municipalRules?: MunicipalRules;
  /**
   * Counts from a county's certified records, by contest key or exact name, for
   * a contest SOS shows at zero. Every entry cites its source, and it applies
   * only while the feed's total is zero: SOS's own numbers win once posted.
   */
  votes?: Record<string, { source: string; options: Record<string, number> }>;
}

function withCountyVotes(contest: AssembledContest, overrides: Overrides): { contest: AssembledContest; source: string | null } {
  const sourced = overrides.votes?.[contest.key] ?? overrides.votes?.[contest.name];
  if (!sourced || contest.options.some((o) => o.votes > 0)) return { contest, source: null };
  return {
    contest: { ...contest, options: contest.options.map((o) => ({ ...o, votes: sourced.options[o.name] ?? 0 })) },
    source: sourced.source,
  };
}

export interface EvaluatedContest extends AssembledContest {
  level: ContestLevel;
  office: string;
  district: string | null;
  municipality: string | null;
  rule: DecisionRule;
  ruleSource: string;
  threshold: number | null;
  margin: MarginResult;
  status: ResultStatus;
  flags: ContestFlag[];
}

export function evaluateContest(
  fromFeed: AssembledContest,
  { electionKind, municipalRules = {}, overrides = {} }: { electionKind: ElectionKind; municipalRules?: MunicipalRules; overrides?: Overrides },
): EvaluatedContest {
  const { contest, source: votesSource } = withCountyVotes(fromFeed, overrides);
  const cls = classifyContest(contest.name, { fromCounty: contest.scope !== "state", isReferendum: contest.isReferendum });
  const rule = decisionRule({
    name: contest.name,
    level: cls.level,
    voteFor: contest.voteFor,
    isReferendum: contest.isReferendum,
    electionKind,
    municipality: cls.municipality,
    municipalRules: { ...municipalRules, ...(overrides.municipalRules ?? {}) },
  });
  const complete = contest.totalUnits > 0 && contest.reportingUnits >= contest.totalUnits;
  const margin = computeMargin({ options: contest.options, voteFor: contest.voteFor, rule: rule.rule, threshold: rule.threshold, complete });
  const status = resultStatus({
    totalVotes: margin.totalVotes,
    reportingUnits: contest.reportingUnits,
    totalUnits: contest.totalUnits,
    isOfficial: contest.isOfficial,
    scope: contest.scope === "state" ? "state" : "county",
    units: contest.unitStatus,
    override: overrides.status?.[contest.key] ?? overrides.status?.[contest.name] ?? null,
  });
  const flags: ContestFlag[] = [...margin.flags];
  if (contest.merged) flags.push("merged");
  if (contest.unlinkedCounties.length) flags.push("unlinked_counties");
  if (votesSource) flags.push("votes_from_county");
  return {
    ...contest,
    ...cls,
    rule: rule.rule,
    ruleSource: votesSource ? `${rule.source}. Votes from the county's records: ${votesSource}` : rule.source,
    threshold: rule.threshold,
    margin,
    status,
    flags,
  };
}
