// The one query behind the ranked report, plus the in-memory filter and
// sort. The Writ page (src/lib/db/closeRaces.ts), the CSV route and the
// morning snapshot (scripts/sync-ga-results.mjs --snapshot) all run this
// SQL and these functions, so the page and every CSV list the same
// contests in the same order. One election is a few thousand rows, so
// filtering happens after the query, against a cached result.

import { comparator } from "./margin.ts";
import { contestOutcome, seatIsDecided, type Outcome } from "./outcome.ts";
import { seatChange, seatKey, type SeatChange, type SeatHolders } from "./seats.ts";
import type { CloseRaceRow, CloseRaceSort, ContestFlag, ContestLevel, DecisionRule, ElectionKind, ResultStatus } from "./types.ts";

// The two options the margin is measured between: first and second, or for
// vote-for-N the last apparent winner and the first loser.
export const CLOSE_RACE_ROWS_SQL = `
select c.id, c.external_id, c.source_election_id, c.election_date::text as election_date, c.name, c.office, c.level, c.scope, c.county, c.county_slug, c.counties, c.municipality,
       c.election_kind, c.primary_party, c.vote_for, c.total_votes, c.margin_votes, c.margin_pct,
       c.leader_share, c.decision_rule, c.reporting_units, c.total_units, c.result_status, c.flags,
       c.ranked, c.uncontested, c.source_updated_at, c.ingested_at, c.election_id,
       w.name as w_name, w.party as w_party, w.incumbent as w_incumbent, w.votes as w_votes,
       l.name as l_name, l.party as l_party, l.incumbent as l_incumbent, l.votes as l_votes,
       t.votes as t_votes,
       inc.name as inc_name, inc.party as inc_party,
       prev.margin_votes as prev_margin_votes
  from tracked_contests c
  left join lateral (
    select name, party, incumbent, votes from tracked_contest_options o
     where o.contest_id = c.id and o.rank = case when c.decision_rule = 'top_n' then c.vote_for else 1 end
     limit 1) w on true
  left join lateral (
    select name, party, incumbent, votes from tracked_contest_options o
     where o.contest_id = c.id and o.rank = case when c.decision_rule = 'top_n' then c.vote_for else 1 end + 1
     limit 1) l on true
  left join lateral (
    select votes from tracked_contest_options o
     where o.contest_id = c.id and o.rank = case when c.decision_rule = 'top_n' then c.vote_for else 1 end + 2
     limit 1) t on true
  left join lateral (
    select name, party from tracked_contest_options o
     where o.contest_id = c.id and o.incumbent and o.rank > case when c.decision_rule = 'top_n' then c.vote_for else 1 end
     order by o.rank limit 1) inc on true
  left join lateral (
    select margin_votes from tracked_snapshots s
     where s.contest_id = c.id
     order by s.ingested_at desc offset 1 limit 1) prev on true
 where c.source_election_id = $1 and c.removed_at is null
`;

export interface DbCloseRaceRow {
  id: string;
  external_id: string;
  source_election_id: string;
  election_date: string;
  name: string;
  office: string;
  level: string;
  scope: string;
  county: string | null;
  county_slug: string | null;
  counties: string[];
  municipality: string | null;
  election_kind: string;
  primary_party: string | null;
  vote_for: number;
  total_votes: number;
  margin_votes: number | null;
  margin_pct: number | null;
  leader_share: number | null;
  decision_rule: string;
  reporting_units: number;
  total_units: number;
  result_status: string;
  flags: string[];
  ranked: boolean;
  uncontested: boolean;
  source_updated_at: Date | string | null;
  ingested_at: Date | string | null;
  election_id: string | null;
  w_name: string | null;
  w_party: string | null;
  w_incumbent: boolean | null;
  w_votes: number | null;
  l_name: string | null;
  l_party: string | null;
  l_incumbent: boolean | null;
  l_votes: number | null;
  t_votes: number | null;
  inc_name: string | null;
  inc_party: string | null;
  prev_margin_votes: number | null;
}

export interface ReportRow extends CloseRaceRow {
  /** The contest's stable address within its election, for the race page URL. */
  key: string;
  sourceElectionId: string;
  electionDate: string;
  scope: string;
  countySlug: string | null;
  office: string;
  ranked: boolean;
  uncontested: boolean;
  thirdVotes: number | null;
  outcome: Outcome;
  /** An incumbent outside the winning places. */
  trailingIncumbent: { name: string; party: string | null } | null;
  seat: { key: string; priorParty: string | null; priorName: string | null; change: SeatChange | null } | null;
  /** Where an unnamed city contest was voted, from its precinct results. */
  votedIn?: string[];
  /** A recount SOS listed for this contest. `final`: its result has replaced the original count here. */
  recount?: { key: string; sourceElectionId: string; final: boolean };
}

const iso = (v: Date | string | null) => (v == null ? null : v instanceof Date ? v.toISOString() : new Date(v).toISOString());

export function toReportRow(r: DbCloseRaceRow): ReportRow {
  const outcome = contestOutcome({
    resultStatus: r.result_status as ResultStatus,
    decisionRule: r.decision_rule as DecisionRule,
    voteFor: r.vote_for,
    totalVotes: r.total_votes,
    marginVotes: r.margin_votes,
    leaderShare: r.leader_share,
    uncontested: r.uncontested,
    flags: r.flags ?? [],
    leaderName: r.w_name,
    runnerUpName: r.l_name,
    runnerUpVotes: r.l_votes,
    thirdVotes: r.t_votes,
  });
  return {
    id: r.id,
    // `{source}:{election}:{key}`; a city source has a colon of its own.
    key: r.external_id.slice(r.external_id.indexOf(`:${r.source_election_id}:`) + r.source_election_id.length + 2),
    sourceElectionId: r.source_election_id,
    electionDate: r.election_date,
    scope: r.scope,
    thirdVotes: r.t_votes,
    outcome,
    trailingIncumbent: r.inc_name ? { name: r.inc_name, party: r.inc_party } : null,
    seat: null,
    rank: 0,
    name: r.name,
    office: r.office,
    level: r.level as ContestLevel,
    county: r.county,
    countySlug: r.county_slug,
    counties: r.counties ?? [],
    municipality: r.municipality,
    electionKind: r.election_kind as ElectionKind,
    primaryParty: r.primary_party,
    voteFor: r.vote_for,
    leaderName: r.w_name,
    leaderParty: r.w_party,
    leaderIncumbent: Boolean(r.w_incumbent),
    leaderVotes: r.w_votes,
    runnerUpName: r.l_name,
    runnerUpParty: r.l_party,
    runnerUpIncumbent: Boolean(r.l_incumbent),
    runnerUpVotes: r.l_votes,
    totalVotes: r.total_votes,
    marginVotes: r.margin_votes,
    marginPct: r.margin_pct,
    leaderShare: r.leader_share,
    decisionRule: r.decision_rule as DecisionRule,
    reportingUnits: r.reporting_units,
    totalUnits: r.total_units,
    resultStatus: r.result_status as ResultStatus,
    flags: (r.flags ?? []) as ContestFlag[],
    marginChange: r.margin_votes != null && r.prev_margin_votes != null ? r.margin_votes - r.prev_margin_votes : null,
    sourceUpdatedAt: iso(r.source_updated_at),
    ingestedAt: iso(r.ingested_at),
    electionId: r.election_id,
    ranked: r.ranked,
    uncontested: r.uncontested,
  };
}

/** The first election the holder file speaks to: it records who held each seat going into Nov 3, 2026. */
export const SEAT_HOLDERS_FROM = "2026-11-03";

/** Adds the prior holder and seat change. A primary fills no seat, and earlier elections predate the file. */
export function withSeats(rows: ReportRow[], holders: SeatHolders): ReportRow[] {
  return rows.map((row) => {
    const key = row.electionDate >= SEAT_HOLDERS_FROM && !row.primaryParty ? seatKey(row.name) : null;
    if (!key) return row;
    const holder = holders[key];
    const change = seatChange(seatIsDecided(row.outcome.kind) ? row.leaderParty : null, holder);
    return { ...row, seat: { key, priorParty: change.priorParty, priorName: holder?.name ?? null, change: change.change } };
  });
}

export interface CloseRaceFilters {
  sort: CloseRaceSort;
  level?: ContestLevel | null;
  county?: string | null;
  municipality?: string | null;
  office?: string | null;
  /** Show only margins at or under this many percentage points. */
  maxPct?: number | null;
  /** Show only margins at or under this many votes. */
  maxVotes?: number | null;
  status?: ResultStatus | null;
  flag?: ContestFlag | null;
}

/** Every contest in one list: ranked ones in order, then those with no margin to rank (rank 0). */
export function everyContest(rows: ReportRow[]): ReportRow[] {
  const { ranked, uncontested, waiting } = filterReport(rows, { sort: "votes" });
  return [...ranked, ...uncontested, ...waiting];
}

export interface FilteredReport {
  ranked: ReportRow[];
  uncontested: ReportRow[];
  /** Contested but not rankable yet (fewer than two options with votes). */
  waiting: ReportRow[];
}

const lower = (s: string | null | undefined) => (s ?? "").toLowerCase();

export function filterReport(rows: ReportRow[], f: CloseRaceFilters): FilteredReport {
  const office = lower(f.office).trim();
  const municipality = lower(f.municipality).trim();
  const keep = rows.filter(
    (r) =>
      (!f.level || r.level === f.level) &&
      (!f.county || r.countySlug === f.county || r.counties.includes(f.county)) &&
      (!municipality || lower(r.municipality) === municipality) &&
      (!office || lower(r.name).includes(office)) &&
      (!f.status || r.resultStatus === f.status) &&
      (!f.flag || r.flags.includes(f.flag)),
  );
  const ranked = keep
    .filter((r) => r.ranked)
    .filter((r) => f.maxPct == null || (r.marginPct != null && r.marginPct <= f.maxPct))
    .filter((r) => f.maxVotes == null || (r.marginVotes != null && r.marginVotes <= f.maxVotes))
    .sort(comparator(f.sort))
    .map((r, i) => ({ ...r, rank: i + 1 }));
  return {
    ranked,
    uncontested: keep.filter((r) => r.uncontested).sort((a, b) => a.name.localeCompare(b.name)),
    waiting: keep.filter((r) => !r.ranked && !r.uncontested).sort((a, b) => a.name.localeCompare(b.name)),
  };
}
