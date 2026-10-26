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
  contest: AssembledContest,
  { electionKind, municipalRules = {}, overrides = {} }: { electionKind: ElectionKind; municipalRules?: MunicipalRules; overrides?: Overrides },
): EvaluatedContest {
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
  const margin = computeMargin({ options: contest.options, voteFor: contest.voteFor, rule: rule.rule, threshold: rule.threshold });
  const status = resultStatus({
    totalVotes: margin.totalVotes,
    reportingUnits: contest.reportingUnits,
    totalUnits: contest.totalUnits,
    isOfficial: contest.isOfficial,
    scope: contest.scope === "state" ? "state" : "county",
    override: overrides.status?.[contest.key] ?? overrides.status?.[contest.name] ?? null,
  });
  const flags: ContestFlag[] = [...margin.flags];
  if (contest.merged) flags.push("merged");
  if (contest.unlinkedCounties.length) flags.push("unlinked_counties");
  return {
    ...contest,
    ...cls,
    rule: rule.rule,
    ruleSource: rule.source,
    threshold: rule.threshold,
    margin,
    status,
    flags,
  };
}
