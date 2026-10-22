// Shared vocabulary for the close-races tracker (docs/elections/ga-close-races.md).
// Everything in this folder is plain TypeScript with no path aliases and
// explicit `.ts` imports, so both the app and the Node ingester
// (scripts/sync-ga-results.mjs) import it directly.

export type ContestLevel =
  | "federal"
  | "statewide"
  | "legislative"
  | "judicial"
  | "county"
  | "municipal"
  | "school"
  | "referendum";

export const CONTEST_LEVELS: ContestLevel[] = [
  "federal",
  "statewide",
  "legislative",
  "judicial",
  "county",
  "municipal",
  "school",
  "referendum",
];

export type DecisionRule = "majority" | "plurality" | "top_n" | "referendum" | "unknown";

export type ResultStatus =
  | "no_results"
  | "reporting"
  | "unofficial_complete"
  | "county_certified"
  | "state_certified"
  | "recount_pending"
  | "contested";

export const RESULT_STATUSES: ResultStatus[] = [
  "no_results",
  "reporting",
  "unofficial_complete",
  "county_certified",
  "state_certified",
  "recount_pending",
  "contested",
];

export type ElectionKind = "general" | "primary" | "runoff" | "special" | "recount";

export type ContestFlag =
  | "tie"
  | "recount_request_range"
  | "runoff_required"
  | "near_runoff"
  | "runoff_rule_unverified"
  | "merged";

export type CloseRaceSort = "votes" | "percent";

export interface ParsedOption {
  sourceId: string;
  name: string;
  party: string | null;
  incumbent: boolean;
  isWriteIn: boolean;
  votes: number;
  votesByMethod: Record<string, number>;
}

export interface ParsedContest {
  sourceId: string;
  parentId: string | null;
  /** English name with any translation after "/ " removed. */
  name: string;
  rawName: string;
  voteFor: number;
  isReferendum: boolean;
  /** Party letter for a partisan primary contest ("US Senate - Rep"). */
  primaryParty: string | null;
  reportingUnits: number;
  totalUnits: number;
  asOf: string | null;
  options: ParsedOption[];
}

export interface ParsedLocality {
  id: string;
  shortName: string;
  name: string;
  percentReporting: number | null;
}

export interface ParsedElectionHeader {
  id: string;
  jurisdictionId: string;
  name: string;
  electionDate: string;
  isOfficialResults: boolean;
  isPrimary: boolean;
  asOf: string | null;
  lastUpdated: string | null;
}

export interface ParsedFeed {
  jurisdiction: string;
  jurisdictionName: string;
  election: ParsedElectionHeader;
  localities: ParsedLocality[];
  /** One per county: lets the watcher fetch only counties that changed. */
  localityElections: ParsedElectionHeader[];
  contests: ParsedContest[];
}

export interface MarginResult {
  totalVotes: number;
  /** Options sorted by votes (desc), then name, with 1-based rank. */
  ranked: (ParsedOption & { rank: number; isApparentWinner: boolean; isCurrentLeader: boolean })[];
  leader: ParsedOption | null;
  runnerUp: ParsedOption | null;
  /** The two options whose gap is the margin: last winner and first loser. */
  cutoffWinner: ParsedOption | null;
  cutoffLoser: ParsedOption | null;
  marginVotes: number | null;
  marginPct: number | null;
  leaderShare: number | null;
  uncontested: boolean;
  /** True when the contest belongs in the ranked list. */
  rankable: boolean;
  flags: ContestFlag[];
}

/** One row of the ranked report, as the page and the CSV both see it. */
export interface CloseRaceRow {
  id: string;
  rank: number;
  name: string;
  level: ContestLevel;
  county: string | null;
  counties: string[];
  municipality: string | null;
  electionKind: ElectionKind;
  primaryParty: string | null;
  voteFor: number;
  leaderName: string | null;
  leaderParty: string | null;
  leaderIncumbent: boolean;
  leaderVotes: number | null;
  runnerUpName: string | null;
  runnerUpParty: string | null;
  runnerUpIncumbent: boolean;
  runnerUpVotes: number | null;
  totalVotes: number;
  marginVotes: number | null;
  marginPct: number | null;
  leaderShare: number | null;
  decisionRule: DecisionRule;
  reportingUnits: number;
  totalUnits: number;
  resultStatus: ResultStatus;
  flags: ContestFlag[];
  marginChange: number | null;
  sourceUpdatedAt: string | null;
  ingestedAt: string | null;
  electionId: string | null;
}
