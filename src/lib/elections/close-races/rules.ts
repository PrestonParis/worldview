// Which rule decides a contest. Georgia requires a majority for most
// candidate contests (O.C.G.A. § 21-2-501(a)(1)); presidential electors are
// exempt, and municipal charters may allow plurality winners, so municipal
// contests stay `unknown` until their rule is sourced in
// data/elections/ga/municipal-rules.json.

import type { ContestLevel, DecisionRule, ElectionKind } from "./types.ts";

export interface MunicipalRule {
  rule: "majority" | "plurality";
  source: string;
}

export type MunicipalRules = Record<string, MunicipalRule>;

export interface RuleResult {
  rule: DecisionRule;
  source: string;
  threshold: number | null;
}

const MAJORITY_SOURCE = "O.C.G.A. § 21-2-501(a)(1)";

export function municipalKey(name: string): string {
  return name.trim().toLowerCase().replace(/\s+/g, " ");
}

export function decisionRule({
  name,
  level,
  voteFor,
  isReferendum,
  electionKind,
  municipality,
  municipalRules = {},
}: {
  name: string;
  level: ContestLevel;
  voteFor: number;
  isReferendum: boolean;
  electionKind: ElectionKind;
  municipality: string | null;
  municipalRules?: MunicipalRules;
}): RuleResult {
  if (isReferendum) return { rule: "referendum", source: "ballot question", threshold: 0.5 };
  if (voteFor > 1) return { rule: "top_n", source: `vote for ${voteFor}`, threshold: null };
  // A runoff is the last round: the top vote-getter wins.
  if (electionKind === "runoff") return { rule: "plurality", source: "runoff round", threshold: null };
  if (/^President/i.test(name)) return { rule: "plurality", source: "O.C.G.A. § 21-2-501(a)(1) (presidential electors exempt)", threshold: null };
  if (level === "municipal") {
    const known = municipality ? municipalRules[municipalKey(municipality)] : undefined;
    if (!known) return { rule: "unknown", source: "municipal rule not yet sourced", threshold: null };
    return { rule: known.rule, source: known.source, threshold: known.rule === "majority" ? 0.5 : null };
  }
  return { rule: "majority", source: MAJORITY_SOURCE, threshold: 0.5 };
}
