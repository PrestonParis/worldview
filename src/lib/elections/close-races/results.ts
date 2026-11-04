// One election's rows → what the results hub's Overview says: who holds each
// chamber, what is still open, what changed. Pure, so it can be tested on the
// real feeds; the loader is src/lib/db/closeRaces.ts.

import { normalizeName } from "./merge.ts";
import { seatIsDecided } from "./outcome.ts";
import type { ReportRow } from "./rows.ts";
import { chamberOf, chamberSummaries, type ChamberSummary, type SeatHolders } from "./seats.ts";
import { CONTEST_LEVELS, type ContestLevel, type ElectionKind } from "./types.ts";

export interface LevelTotal {
  level: ContestLevel;
  contests: number;
  decided: number;
  uncontested: number;
  open: number;
}

export interface ResultsSummary {
  /** Empty for an election that doesn't fill the chambers (a primary, a runoff). */
  chambers: ChamberSummary[];
  statewide: ReportRow[];
  statewideQuestions: ReportRow[];
  usHouse: ReportRow[];
  runoffs: { row: ReportRow; pair: ReportRow | null }[];
  recountRange: ReportRow[];
  tied: ReportRow[];
  ruleUnverified: ReportRow[];
  noVotes: ReportRow[];
  flips: ReportRow[];
  defeatedIncumbents: ReportRow[];
  questions: { passed: number; failed: number; tied: number };
  levels: LevelTotal[];
}

const couple = (row: Pick<ReportRow, "leaderName" | "runnerUpName" | "county">) =>
  row.leaderName && row.runnerUpName ? `${normalizeName(row.county ?? "")}|${[row.leaderName, row.runnerUpName].map(normalizeName).sort().join("|")}` : null;

/**
 * A round's runoff contests, matched on the same county and the same two
 * candidates. SOS can word a contest differently between rounds; who is on the
 * ballot doesn't change.
 */
export function pairRunoffs(general: ReportRow[], runoff: ReportRow[]): Map<string, ReportRow> {
  const byCouple = new Map<string, ReportRow>();
  for (const row of runoff) {
    const key = couple(row);
    if (key) byCouple.set(key, row);
  }
  const pairs = new Map<string, ReportRow>();
  for (const row of general) {
    if (row.outcome.kind !== "advancing_to_runoff") continue;
    const key = couple(row);
    const pair = key ? byCouple.get(key) : undefined;
    if (pair) pairs.set(row.id, pair);
  }
  return pairs;
}

/** Seats a later round has settled, by seat key. */
export function settledSeats(rows: ReportRow[], pairs: Map<string, ReportRow>): Map<string, string> {
  const settled = new Map<string, string>();
  for (const row of rows) {
    const pair = pairs.get(row.id);
    if (!row.seat || !pair || !seatIsDecided(pair.outcome.kind) || !pair.leaderParty) continue;
    settled.set(row.seat.key, pair.leaderParty);
  }
  return settled;
}

const byMargin = (a: ReportRow, b: ReportRow) => (a.marginVotes ?? Infinity) - (b.marginVotes ?? Infinity) || a.name.localeCompare(b.name);
const byDistrict = (a: ReportRow, b: ReportRow) => a.name.localeCompare(b.name, "en", { numeric: true });

// Ballot order, top of the ticket first, then the chambers.
const STATEWIDE_ORDER = ["us-senate", "governor", "lieutenant-governor", "secretary-of-state", "attorney-general", "agriculture", "insurance", "school-superintendent", "labor", "psc-3", "psc-5"];
const CHAMBER_ORDER = ["statewide", "us_house", "ga_senate", "ga_house"];

function bySeat(a: ReportRow, b: ReportRow): number {
  const [chamberA = "", seatA = ""] = a.seat?.key.split(":") ?? [];
  const [chamberB = "", seatB = ""] = b.seat?.key.split(":") ?? [];
  if (chamberA !== chamberB) return CHAMBER_ORDER.indexOf(chamberA) - CHAMBER_ORDER.indexOf(chamberB);
  if (chamberA === "statewide") {
    const rank = (seat: string) => (STATEWIDE_ORDER.indexOf(seat) + 1 || STATEWIDE_ORDER.length + 1);
    return rank(seatA) - rank(seatB) || a.name.localeCompare(b.name);
  }
  return Number(seatA) - Number(seatB);
}

export function summarizeResults(rows: ReportRow[], { kind, holders, pairs = new Map() }: { kind: ElectionKind; holders: SeatHolders; pairs?: Map<string, ReportRow> }): ResultsSummary {
  const fillsSeats = rows.some((r) => r.seat) && (kind === "general" || kind === "special");
  const levels = CONTEST_LEVELS.map((level) => {
    const list = rows.filter((r) => r.level === level);
    const uncontested = list.filter((r) => r.outcome.kind === "unopposed").length;
    const open = list.filter((r) => !["elected", "unopposed", "passed", "failed"].includes(r.outcome.kind)).length;
    return { level, contests: list.length, uncontested, open, decided: list.length - open };
  }).filter((l) => l.contests > 0);
  const questions = rows.filter((r) => r.decisionRule === "referendum");
  return {
    chambers: fillsSeats && rows.filter((r) => chamberOf(r.seat?.key ?? null)).length > 100 ? chamberSummaries(rows, holders, settledSeats(rows, pairs)) : [],
    statewide: rows.filter((r) => r.seat?.key.startsWith("statewide:")).sort(bySeat),
    statewideQuestions: rows.filter((r) => r.decisionRule === "referendum" && r.scope === "state").sort(byDistrict),
    usHouse: rows.filter((r) => r.seat?.key.startsWith("us_house:")).sort(bySeat),
    runoffs: rows
      .filter((r) => r.outcome.kind === "advancing_to_runoff")
      .sort(byMargin)
      .map((row) => ({ row, pair: pairs.get(row.id) ?? null })),
    recountRange: rows.filter((r) => r.flags.includes("recount_request_range")).sort(byMargin),
    tied: rows.filter((r) => r.outcome.kind === "tied"),
    ruleUnverified: rows.filter((r) => r.outcome.kind === "rule_unverified").sort(byMargin),
    noVotes: rows.filter((r) => r.outcome.kind === "no_votes"),
    flips: rows.filter((r) => r.seat?.change === "gained").sort(bySeat),
    defeatedIncumbents: rows.filter((r) => r.trailingIncumbent && r.outcome.kind === "elected" && !r.leaderIncumbent).sort(byMargin),
    questions: {
      passed: questions.filter((r) => r.outcome.kind === "passed").length,
      failed: questions.filter((r) => r.outcome.kind === "failed").length,
      tied: questions.filter((r) => r.outcome.kind === "tied").length,
    },
    levels,
  };
}
