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
  recounts: ReportRow[];
  tied: ReportRow[];
  ruleUnverified: ReportRow[];
  noVotes: ReportRow[];
  flips: ReportRow[];
  defeatedIncumbents: ReportRow[];
  questions: { passed: number; failed: number; tied: number };
  levels: LevelTotal[];
}

const couple = (row: Pick<ReportRow, "leaderName" | "runnerUpName" | "county">) =>
  row.leaderName && row.runnerUpName
    ? `${normalizeName(row.county ?? "")}|${[row.leaderName, row.runnerUpName].map(normalizeName).sort().join("|")}`
    : null;

/**
 * A round's runoff contests, matched on the same county and the same two
 * candidates. SOS can word a contest differently between rounds; who is on the
 * ballot doesn't change.
 */
export function pairRunoffs(general: ReportRow[], runoff: ReportRow[]): Map<string, ReportRow> {
  return pairRounds(
    general.filter((r) => r.outcome.kind === "advancing_to_runoff" || r.outcome.kind === "rule_unverified"),
    runoff,
  );
}

/** Recount contests carry a different name ("… Recount"), so they match the same way. */
export function pairRecounts(original: ReportRow[], recount: ReportRow[]): Map<string, ReportRow> {
  return pairRounds(original, recount);
}

function pairRounds(earlier: ReportRow[], later: ReportRow[]): Map<string, ReportRow> {
  const byCouple = new Map<string, ReportRow>();
  for (const row of later) {
    const key = couple(row);
    if (key) byCouple.set(key, row);
  }
  const pairs = new Map<string, ReportRow>();
  for (const row of earlier) {
    const key = couple(row);
    const pair = key ? byCouple.get(key) : undefined;
    if (pair) pairs.set(row.id, pair);
  }
  return pairs;
}

/**
 * A recount's result in place of the original count, everywhere the row is
 * used: seats, flips, the CSV. Until the recount has an outcome the original
 * stands and the row only says one is under way.
 */
export function applyRecounts(rows: ReportRow[], recount: ReportRow[]): ReportRow[] {
  const pairs = pairRecounts(rows, recount);
  return rows.map((row) => {
    const r = pairs.get(row.id);
    if (!r) return row;
    const link = { key: r.key, sourceElectionId: r.sourceElectionId };
    if (r.outcome.kind === "counting") return { ...row, recount: { ...link, final: false } };
    const sameLeader = r.leaderName === row.leaderName;
    return {
      ...row,
      leaderName: r.leaderName,
      leaderParty: r.leaderParty ?? (sameLeader ? row.leaderParty : row.runnerUpParty),
      leaderIncumbent: sameLeader ? row.leaderIncumbent : row.runnerUpIncumbent,
      leaderVotes: r.leaderVotes,
      runnerUpName: r.runnerUpName,
      runnerUpParty: r.runnerUpParty ?? (sameLeader ? row.runnerUpParty : row.leaderParty),
      runnerUpIncumbent: sameLeader ? row.runnerUpIncumbent : row.leaderIncumbent,
      runnerUpVotes: r.runnerUpVotes,
      thirdVotes: r.thirdVotes,
      totalVotes: r.totalVotes,
      marginVotes: r.marginVotes,
      marginPct: r.marginPct,
      leaderShare: r.leaderShare,
      flags: r.flags,
      resultStatus: r.resultStatus,
      outcome: r.outcome,
      // The incumbent can only trail the recount's leader if they aren't it.
      trailingIncumbent: sameLeader
        ? row.trailingIncumbent
        : row.leaderIncumbent && row.leaderName
          ? { name: row.leaderName, party: row.leaderParty }
          : null,
      recount: { ...link, final: true },
    };
  });
}

/**
 * City contests below 50% whose runoff rule isn't sourced. SOS's runoff feed
 * answers it: a contest with a runoff listed goes to one; once the feed has
 * contests, one without is decided by its leader.
 */
export function settleUnverified(rows: ReportRow[], runoff: ReportRow[]): ReportRow[] {
  if (!runoff.length) return rows;
  const pairs = pairRunoffs(rows, runoff);
  return rows.map((row) => {
    if (row.outcome.kind !== "rule_unverified") return row;
    if (pairs.has(row.id))
      return {
        ...row,
        outcome: {
          kind: "advancing_to_runoff",
          label: "Runoff",
          advancing: [row.leaderName, row.runnerUpName].filter((n): n is string => Boolean(n)),
          secondSlotTied: false,
        },
      };
    return {
      ...row,
      outcome: { kind: "elected", label: "Apparent winner, no runoff listed", advancing: [], secondSlotTied: false },
    };
  });
}

/** What the two rounds disagree on: an expected runoff SOS doesn't list, and a listed one nobody expected. */
export function runoffMismatches(
  general: ReportRow[],
  runoff: ReportRow[],
): { noRunoff: ReportRow[]; noParent: ReportRow[] } {
  const pairs = pairRunoffs(general, runoff);
  const paired = new Set([...pairs.values()].map((r) => r.id));
  return {
    noRunoff: general.filter((r) => r.outcome.kind === "advancing_to_runoff" && !pairs.has(r.id)),
    noParent: runoff.filter((r) => !paired.has(r.id)),
  };
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

const byMargin = (a: ReportRow, b: ReportRow) =>
  (a.marginVotes ?? Infinity) - (b.marginVotes ?? Infinity) || a.name.localeCompare(b.name);
const byDistrict = (a: ReportRow, b: ReportRow) => a.name.localeCompare(b.name, "en", { numeric: true });

// Ballot order, top of the ticket first, then the chambers.
const STATEWIDE_ORDER = [
  "us-senate",
  "governor",
  "lieutenant-governor",
  "secretary-of-state",
  "attorney-general",
  "agriculture",
  "insurance",
  "school-superintendent",
  "labor",
  "psc-3",
  "psc-5",
];
const CHAMBER_ORDER = ["statewide", "us_house", "ga_senate", "ga_house"];

function bySeat(a: ReportRow, b: ReportRow): number {
  const [chamberA = "", seatA = ""] = a.seat?.key.split(":") ?? [];
  const [chamberB = "", seatB = ""] = b.seat?.key.split(":") ?? [];
  if (chamberA !== chamberB) return CHAMBER_ORDER.indexOf(chamberA) - CHAMBER_ORDER.indexOf(chamberB);
  if (chamberA === "statewide") {
    const rank = (seat: string) => STATEWIDE_ORDER.indexOf(seat) + 1 || STATEWIDE_ORDER.length + 1;
    return rank(seatA) - rank(seatB) || a.name.localeCompare(b.name);
  }
  return Number(seatA) - Number(seatB);
}

/** Seats a runoff has moved, shown with the runoff's winner: they count in the chamber totals too. */
function runoffFlips(rows: ReportRow[], pairs: Map<string, ReportRow>): ReportRow[] {
  return rows.flatMap((row) => {
    const pair = pairs.get(row.id);
    if (
      !row.seat?.priorParty ||
      !pair?.leaderParty ||
      !seatIsDecided(pair.outcome.kind) ||
      pair.leaderParty === row.seat.priorParty
    )
      return [];
    return [{ ...row, leaderName: pair.leaderName, leaderParty: pair.leaderParty, marginPct: pair.marginPct }];
  });
}

export function summarizeResults(
  rows: ReportRow[],
  { kind, holders, pairs = new Map() }: { kind: ElectionKind; holders: SeatHolders; pairs?: Map<string, ReportRow> },
): ResultsSummary {
  const fillsSeats = rows.some((r) => r.seat) && (kind === "general" || kind === "special");
  const levels = CONTEST_LEVELS.map((level) => {
    const list = rows.filter((r) => r.level === level);
    const uncontested = list.filter((r) => r.outcome.kind === "unopposed").length;
    const open = list.filter((r) => !["elected", "unopposed", "passed", "failed"].includes(r.outcome.kind)).length;
    return { level, contests: list.length, uncontested, open, decided: list.length - open };
  }).filter((l) => l.contests > 0);
  const questions = rows.filter((r) => r.decisionRule === "referendum");
  return {
    chambers:
      fillsSeats && rows.filter((r) => chamberOf(r.seat?.key ?? null)).length > 100
        ? chamberSummaries(rows, holders, settledSeats(rows, pairs))
        : [],
    statewide: rows.filter((r) => r.seat?.key.startsWith("statewide:")).sort(bySeat),
    statewideQuestions: rows.filter((r) => r.decisionRule === "referendum" && r.scope === "state").sort(byDistrict),
    usHouse: rows.filter((r) => r.seat?.key.startsWith("us_house:")).sort(bySeat),
    runoffs: rows
      .filter((r) => r.outcome.kind === "advancing_to_runoff")
      .sort(byMargin)
      .map((row) => ({ row, pair: pairs.get(row.id) ?? null })),
    recountRange: rows.filter((r) => r.flags.includes("recount_request_range")).sort(byMargin),
    recounts: rows.filter((r) => r.recount).sort(byMargin),
    tied: rows.filter((r) => r.outcome.kind === "tied"),
    ruleUnverified: rows.filter((r) => r.outcome.kind === "rule_unverified").sort(byMargin),
    noVotes: rows.filter((r) => r.outcome.kind === "no_votes"),
    flips: [...rows.filter((r) => r.seat?.change === "gained"), ...runoffFlips(rows, pairs)].sort(bySeat),
    defeatedIncumbents: rows
      .filter((r) => r.trailingIncumbent && r.outcome.kind === "elected" && !r.leaderIncumbent)
      .sort(byMargin),
    questions: {
      passed: questions.filter((r) => r.outcome.kind === "passed").length,
      failed: questions.filter((r) => r.outcome.kind === "failed").length,
      tied: questions.filter((r) => r.outcome.kind === "tied").length,
    },
    levels,
  };
}
