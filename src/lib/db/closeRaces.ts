// Loaders for Writ's close-races report (docs/elections/ga-close-races.md,
// "Report"). The ranked rows come from the one shared query in
// src/lib/elections/close-races/rows.ts; results are cached for 60 s under
// CLOSE_RACES_TAG, which the ingester expires after every write
// (/api/writ/revalidate).

import { unstable_cache } from "next/cache";
import { db } from "./client";
import { CLOSE_RACE_ROWS_SQL, everyContest, filterReport, toReportRow, withSeats, type CloseRaceFilters, type DbCloseRaceRow, type FilteredReport, type ReportRow } from "../elections/close-races/rows";
import { applyRecounts, pairRecounts, pairRunoffs, settleUnverified, summarizeResults, type ResultsSummary } from "../elections/close-races/results";
import type { SeatHolders } from "../elections/close-races/seats";
import { votedIn } from "../elections/close-races/precincts";
import { etDate } from "../elections/close-races/schedule";
import seatHolderFile from "../../../data/elections/ga/seat-holders-2026.json";
import scheduleFile from "../../../data/elections/ga/schedule.json";
import type { ContestLevel, ElectionKind, ResultStatus } from "../elections/close-races/types";

export const CLOSE_RACES_TAG = "tracked-contests";

function cached<A extends unknown[], R>(name: string, fn: (...args: A) => Promise<R>) {
  return unstable_cache(fn, ["close-races", name], { tags: [CLOSE_RACES_TAG], revalidate: 60 });
}

const iso = (v: unknown) => (v == null ? null : new Date(v as string).toISOString());

export interface TrackedElection {
  id: string;
  name: string;
  date: string;
  kind: ElectionKind;
  isOfficial: boolean;
  contests: number;
  countiesFetched: number;
  heartbeatAt: string | null;
  lastStateFetchAt: string | null;
  lastWriteAt: string | null;
  sourceUpdatedAt: string | null;
  fetchSource: string | null;
  mode: string;
  workerId: string | null;
  errorCount: number;
  lastError: string | null;
  /** The id this election was first watched under, before SOS listed it under this one. */
  replaces: string | null;
}

export const listTrackedElections = cached("elections", async (): Promise<TrackedElection[]> => {
  const { rows } = await db.$client.query(
    `select * from tracked_ingest_status where source = 'ga-sos' order by election_date desc, source_election_id`,
  );
  return rows.map((r) => ({
    id: r.source_election_id,
    name: r.election_name,
    date: new Date(r.election_date).toISOString().slice(0, 10),
    kind: r.election_kind,
    isOfficial: r.is_official,
    contests: r.contests,
    countiesFetched: r.counties_fetched,
    heartbeatAt: iso(r.heartbeat_at),
    lastStateFetchAt: iso(r.last_state_fetch_at),
    lastWriteAt: iso(r.last_write_at),
    sourceUpdatedAt: iso(r.source_updated_at),
    fetchSource: r.fetch_source,
    mode: r.mode,
    workerId: r.worker_id,
    errorCount: r.error_count,
    lastError: r.last_error,
    replaces: r.replaces ?? null,
  }));
});

/**
 * The election the report opens on: the latest general, else the latest
 * election with a full slate (a primary or its runoff), else the latest.
 * Before Nov 3 that's the June primary runoff; from election night on, the
 * general.
 */
export function defaultElection(elections: TrackedElection[]): TrackedElection | null {
  return elections.find((e) => e.kind === "general") ?? elections.find((e) => e.contests >= 50) ?? elections[0] ?? null;
}

const SEAT_HOLDERS = seatHolderFile.seats as SeatHolders;

const loadBaseRows = cached("rows", async (election: string): Promise<ReportRow[]> => {
  const [{ rows }, { rows: places }] = await Promise.all([
    db.$client.query<DbCloseRaceRow>(CLOSE_RACE_ROWS_SQL, [election]),
    db.$client.query(
      `select p.contest_id, p.precinct, p.total_votes from tracked_contest_precincts p
         join tracked_contests c on c.id = p.contest_id
        where c.source_election_id = $1 and c.municipality is null and c.level in ('municipal', 'referendum')`,
      [election],
    ),
  ]);
  const byContest = new Map<string, { precinct: string; totalVotes: number }[]>();
  for (const p of places) byContest.set(p.contest_id, [...(byContest.get(p.contest_id) ?? []), { precinct: p.precinct, totalVotes: p.total_votes }]);
  return rows.map(toReportRow).map((r) => (byContest.has(r.id) ? { ...r, votedIn: votedIn(byContest.get(r.id)!) } : r));
});

// One election as the hub reports it: later rounds applied first, so seats,
// flips and every CSV follow a recount's result or a runoff's answer.
async function loadRows(election: string): Promise<ReportRow[]> {
  const [base, elections] = await Promise.all([loadBaseRows(election), listTrackedElections()]);
  const me = elections.find((e) => e.id === election);
  let rows = base;
  if (me && me.kind !== "recount" && me.kind !== "primary") {
    for (const later of elections.filter((e) => e.kind === "recount" && e.date >= me.date)) rows = applyRecounts(rows, await loadBaseRows(later.id));
    const round = runoffAfter(elections, me);
    if (round) rows = settleUnverified(rows, await loadBaseRows(round.id));
  }
  return withSeats(rows, SEAT_HOLDERS);
}

export interface CoverageRow {
  id: string;
  name: string;
  type: string;
  expected: number | null;
  observed: number;
  status: "complete" | "partial" | "missing";
  sourceUrl: string | null;
  resultsUrl: string | null;
  notes: string | null;
}

export interface CoverageSummary {
  jurisdictions: number;
  complete: number;
  partial: number;
  missing: number;
  expectedContests: number;
  observedContests: number;
  rows: CoverageRow[];
}

const loadCoverage = cached("coverage", async (election: string): Promise<CoverageSummary> => {
  const { rows } = await db.$client.query(
    `select jurisdiction_id, jurisdiction_name, jurisdiction_type, expected_count, observed_count, status, source_url, local_results_url, notes
       from tracked_contest_coverage where source_election_id = $1 order by jurisdiction_type, jurisdiction_name`,
    [election],
  );
  const list: CoverageRow[] = rows.map((r) => ({
    id: r.jurisdiction_id,
    name: r.jurisdiction_name,
    type: r.jurisdiction_type,
    expected: r.expected_count,
    observed: r.observed_count,
    status: r.status,
    sourceUrl: r.source_url,
    resultsUrl: r.local_results_url,
    notes: r.notes,
  }));
  const count = (s: CoverageRow["status"]) => list.filter((r) => r.status === s).length;
  return {
    jurisdictions: list.length,
    complete: count("complete"),
    partial: count("partial"),
    missing: count("missing"),
    expectedContests: list.reduce((s, r) => s + (r.expected ?? 0), 0),
    observedContests: list.reduce((s, r) => s + Math.min(r.observed, r.expected ?? 0), 0),
    rows: list,
  };
});

export interface TrackedAlert {
  id: string;
  kind: string;
  severity: string;
  message: string;
  createdAt: string;
  sent: boolean;
}

const loadAlerts = cached("alerts", async (election: string): Promise<TrackedAlert[]> => {
  const { rows } = await db.$client.query(
    `select id, kind, severity, message, created_at, sent_at from tracked_alerts
      where source_election_id = $1 and resolved_at is null order by created_at desc limit 40`,
    [election],
  );
  return rows.map((r) => ({ id: r.id, kind: r.kind, severity: r.severity, message: r.message, createdAt: iso(r.created_at)!, sent: r.sent_at != null }));
});

export interface CloseRacesData {
  election: TrackedElection;
  elections: TrackedElection[];
  report: FilteredReport;
  statusCounts: Partial<Record<ResultStatus, number>>;
  levelCounts: Partial<Record<ContestLevel, { ranked: number; uncontested: number }>>;
  counties: { slug: string; name: string }[];
  totalContests: number;
  coverage: CoverageSummary;
  alerts: TrackedAlert[] | null;
}

export async function loadCloseRaces(electionId: string, filters: CloseRaceFilters, { withAlerts = false } = {}): Promise<CloseRacesData | null> {
  const elections = await listTrackedElections();
  const election = elections.find((e) => e.id === electionId);
  if (!election) return null;
  const [rows, coverage, alerts] = await Promise.all([loadRows(electionId), loadCoverage(electionId), withAlerts ? loadAlerts(electionId) : null]);
  const statusCounts: CloseRacesData["statusCounts"] = {};
  const levelCounts: CloseRacesData["levelCounts"] = {};
  const counties = new Map<string, string>();
  for (const r of rows) {
    statusCounts[r.resultStatus] = (statusCounts[r.resultStatus] ?? 0) + 1;
    const level = (levelCounts[r.level] ??= { ranked: 0, uncontested: 0 });
    if (r.ranked) level.ranked++;
    if (r.uncontested) level.uncontested++;
    if (r.countySlug && r.county) counties.set(r.countySlug, r.county);
  }
  for (const c of coverage.rows) if (c.type === "county") counties.set(c.id, c.name);
  return {
    election,
    elections,
    report: filterReport(rows, filters),
    statusCounts,
    levelCounts,
    counties: [...counties.entries()].map(([slug, name]) => ({ slug, name })).sort((a, b) => a.name.localeCompare(b.name)),
    totalContests: rows.length,
    coverage,
    alerts,
  };
}

export interface CountyStatusRow {
  slug: string;
  county: string;
  registered: number | null;
  ballotsCast: number | null;
  unitsFully: number;
  unitsNight: number;
  unitsPartial: number;
  unitsNotReported: number;
  percentReporting: number | null;
  groupsUnreported: string[];
  isOfficial: boolean;
  sourceUpdatedAt: string | null;
}

export interface CountyStatusSummary {
  rows: CountyStatusRow[];
  registered: number;
  ballotsCast: number | null;
  unitsFully: number;
  unitsNight: number;
  unitsTotal: number;
}

export const loadCountyStatus = cached("county-status", async (election: string): Promise<CountyStatusSummary> => {
  const { rows } = await db.$client.query(
    `select county_slug, county, registered, ballots_cast, units_fully_reported, units_night_complete, units_partial, units_not_reported, percent_reporting, groups_unreported, is_official, source_updated_at
       from tracked_county_status where source_election_id = $1 order by county`,
    [election],
  );
  const list: CountyStatusRow[] = rows.map((r) => ({
    slug: r.county_slug,
    county: r.county,
    registered: r.registered,
    ballotsCast: r.ballots_cast,
    unitsFully: r.units_fully_reported ?? 0,
    unitsNight: r.units_night_complete ?? 0,
    unitsPartial: r.units_partial ?? 0,
    unitsNotReported: r.units_not_reported ?? 0,
    percentReporting: r.percent_reporting,
    groupsUnreported: r.groups_unreported ?? [],
    isOfficial: r.is_official,
    sourceUpdatedAt: iso(r.source_updated_at),
  }));
  const sum = (fn: (c: CountyStatusRow) => number) => list.reduce((s, c) => s + fn(c), 0);
  return {
    rows: list,
    registered: sum((c) => c.registered ?? 0),
    ballotsCast: list.some((c) => c.ballotsCast != null) ? sum((c) => c.ballotsCast ?? 0) : null,
    unitsFully: sum((c) => c.unitsFully),
    unitsNight: sum((c) => c.unitsNight),
    unitsTotal: sum((c) => c.unitsFully + c.unitsNight + c.unitsPartial + c.unitsNotReported),
  };
});

// How far each still-open contest's margin has moved since the count as it
// stood the morning after: the last snapshot before 12:00 UTC on the next day.
const loadMarginMoves = cached("moves", async (date: string, rows: { id: string; margin: number | null }[]): Promise<Record<string, number>> => {
  if (!rows.length) return {};
  const cutoff = new Date(`${date}T12:00:00Z`);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1);
  const { rows: found } = await db.$client.query(
    `select distinct on (contest_id) contest_id, margin_votes from tracked_snapshots
      where contest_id = any($1::uuid[]) and ingested_at <= $2 order by contest_id, ingested_at desc`,
    [rows.map((r) => r.id), cutoff],
  );
  const out: Record<string, number> = {};
  for (const f of found) {
    const now = rows.find((r) => r.id === f.contest_id)?.margin;
    if (now != null && f.margin_votes != null && now !== f.margin_votes) out[f.contest_id] = now - f.margin_votes;
  }
  return out;
});

export interface ResultsData {
  election: TrackedElection;
  elections: TrackedElection[];
  summary: ResultsSummary;
  counties: CountyStatusSummary;
  moves: Record<string, number>;
  totalContests: number;
  mapContests: { id: string; name: string }[];
  /** The election date of the runoff round, once it is on the schedule. */
  runoffDate: string | null;
  calendar: { date: string; label: string; meaning?: string; signal?: string; source: string }[];
  /** Today in Georgia, for the timeline. */
  today: string;
}

/** The runoff round that follows a general: SOS lists it near the day. */
function runoffAfter(elections: TrackedElection[], election: TrackedElection): TrackedElection | null {
  if (election.kind !== "general") return null;
  return [...elections].reverse().find((e) => e.kind === "runoff" && e.date > election.date) ?? null;
}

async function runoffPairs(elections: TrackedElection[], election: TrackedElection, rows: ReportRow[]) {
  const round = runoffAfter(elections, election);
  if (!round) return new Map<string, ReportRow>();
  return pairRunoffs(rows, await loadRows(round.id));
}

export async function loadResults(electionId: string): Promise<ResultsData | null> {
  const elections = await listTrackedElections();
  const election = elections.find((e) => e.id === electionId);
  if (!election) return null;
  const [rows, counties] = await Promise.all([loadRows(electionId), loadCountyStatus(electionId)]);
  const pairs = await runoffPairs(elections, election, rows);
  const summary = summarizeResults(rows, { kind: election.kind, holders: SEAT_HOLDERS, pairs });
  const watched = [...summary.recountRange, ...summary.runoffs.map((r) => r.row)].map((r) => ({ id: r.id, margin: r.marginVotes }));
  const moves = await loadMarginMoves(election.date, watched);
  return {
    election,
    elections,
    summary,
    counties,
    moves,
    totalContests: rows.length,
    mapContests: [...summary.statewide, ...summary.statewideQuestions].map((r) => ({ id: r.id, name: r.name })),
    runoffDate: runoffAfter(elections, election)?.date ?? null,
    calendar: (scheduleFile.elections as { date: string; calendar?: ResultsData["calendar"] }[]).find((e) => e.date === election.date)?.calendar ?? [],
    today: etDate(),
  };
}

export interface RaceData {
  election: TrackedElection;
  row: ReportRow;
  detail: ContestDetail;
  /** The other round of this contest: its runoff or recount, or the count it came from. */
  otherRound: { sourceElectionId: string; key: string; label: string } | null;
  precincts: { county: string; precinct: string; totalVotes: number; votes: Record<string, number> }[];
}

export async function loadRace(electionId: string, key: string): Promise<RaceData | null> {
  const elections = await listTrackedElections();
  const election = elections.find((e) => e.id === electionId);
  if (!election) return null;
  const rows = await loadRows(electionId);
  const row = rows.find((r) => r.key === key);
  if (!row) return null;
  const detail = await loadContestDetail(row.id);
  if (!detail) return null;
  let otherRound: RaceData["otherRound"] = null;
  if (row.recount) otherRound = { sourceElectionId: row.recount.sourceElectionId, key: row.recount.key, label: "The recount" };
  else if (election.kind === "general") {
    const pair = (await runoffPairs(elections, election, rows)).get(row.id);
    if (pair) otherRound = { sourceElectionId: pair.sourceElectionId, key: pair.key, label: "The runoff" };
  } else if (election.kind === "runoff" || election.kind === "recount") {
    const original = [...elections].filter((e) => e.kind !== "recount" && e.kind !== "primary" && e.date <= election.date && e.id !== election.id).sort((a, b) => b.date.localeCompare(a.date))[0];
    if (original) {
      const earlier = await loadBaseRows(original.id);
      const match = [...(election.kind === "recount" ? pairRecounts(earlier, [row]) : pairRunoffs(earlier, [row])).keys()][0];
      const found = earlier.find((r) => r.id === match);
      if (found) otherRound = { sourceElectionId: found.sourceElectionId, key: found.key, label: election.kind === "recount" ? "The original count" : "The general election" };
    }
  }
  const { rows: precincts } = await db.$client.query(
    "select county_slug, precinct, total_votes, votes from tracked_contest_precincts where contest_id = $1 order by county_slug, precinct",
    [row.id],
  );
  return { election, row, detail, otherRound, precincts: precincts.map((p) => ({ county: p.county_slug, precinct: p.precinct, totalVotes: p.total_votes, votes: p.votes ?? {} })) };
}

/** A county's own numbers for each contest it votes on. */
const loadCountyVotes = cached("county-votes", async (election: string, slug: string): Promise<Record<string, { name: string; party: string | null; incumbent: boolean; votes: number }[]>> => {
  const { rows } = await db.$client.query(
    `select a.contest_id, o.name, o.party, o.incumbent, a.votes
       from tracked_contest_areas a
       join tracked_contest_options o on o.id = a.option_id
       join tracked_contests c on c.id = a.contest_id
      where a.county_slug = $1 and c.source_election_id = $2 and c.removed_at is null
      order by a.contest_id, a.votes desc`,
    [slug, election],
  );
  const out: Record<string, { name: string; party: string | null; incumbent: boolean; votes: number }[]> = {};
  for (const r of rows) (out[r.contest_id] ??= []).push({ name: r.name, party: r.party, incumbent: r.incumbent, votes: r.votes });
  return out;
});

export interface CountyData {
  election: TrackedElection;
  status: CountyStatusRow | null;
  county: string;
  slug: string;
  rows: ReportRow[];
  votes: Record<string, { name: string; party: string | null; incumbent: boolean; votes: number }[]>;
}

export async function loadCounty(electionId: string, slug: string): Promise<CountyData | null> {
  const election = (await listTrackedElections()).find((e) => e.id === electionId);
  if (!election) return null;
  const [rows, counties, votes] = await Promise.all([loadRows(electionId), loadCountyStatus(electionId), loadCountyVotes(electionId, slug)]);
  const list = rows.filter((r) => r.countySlug === slug || r.counties.includes(slug));
  if (!list.length) return null;
  const status = counties.rows.find((c) => c.slug === slug) ?? null;
  return { election, status, county: status?.county ?? list.find((r) => r.county)?.county ?? slug, slug, rows: list, votes };
}

export interface CountyIndexData {
  election: TrackedElection;
  elections: TrackedElection[];
  counties: CountyStatusSummary;
}

export async function loadCountyIndex(electionId: string): Promise<CountyIndexData | null> {
  const elections = await listTrackedElections();
  const election = elections.find((e) => e.id === electionId);
  if (!election) return null;
  return { election, elections, counties: await loadCountyStatus(electionId) };
}

/** The election a retired id now lives under (SOS published it under a new id). */
export function movedElection(elections: TrackedElection[], id: string): TrackedElection | null {
  if (elections.some((e) => e.id === id)) return null;
  return elections.find((e) => e.replaces === id) ?? null;
}

/** Every contest, ranked or not, for the full-results CSV. */
export async function loadAllResultRows(electionId: string): Promise<ReportRow[] | null> {
  const elections = await listTrackedElections();
  if (!elections.some((e) => e.id === electionId)) return null;
  return everyContest(await loadRows(electionId));
}

/** The ranked rows only, for the CSV route. */
export async function loadCloseRaceRows(electionId: string, filters: CloseRaceFilters): Promise<ReportRow[] | null> {
  const elections = await listTrackedElections();
  if (!elections.some((e) => e.id === electionId)) return null;
  return filterReport(await loadRows(electionId), filters).ranked;
}

export interface ContestDetail {
  id: string;
  name: string;
  ruleSource: string | null;
  options: { id: string; name: string; party: string | null; incumbent: boolean; isWriteIn: boolean; votes: number; votesByMethod: Record<string, number>; rank: number; isApparentWinner: boolean }[];
  areas: { county: string; countySlug: string; reportingUnits: number; totalUnits: number; votes: Record<string, number> }[];
  history: { at: string; marginVotes: number | null; marginPct: number | null; reportingUnits: number; totalUnits: number; status: string }[];
}

export const loadContestDetail = cached("detail", async (id: string): Promise<ContestDetail | null> => {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const [{ rows: contest }, { rows: options }, { rows: areas }, { rows: history }] = await Promise.all([
    db.$client.query("select id, name, rule_source from tracked_contests where id = $1", [id]),
    db.$client.query(
      "select id, name, party, incumbent, is_write_in, votes, votes_by_method, rank, is_apparent_winner from tracked_contest_options where contest_id = $1 order by rank",
      [id],
    ),
    db.$client.query("select option_id, county, county_slug, votes, reporting_units, total_units from tracked_contest_areas where contest_id = $1 order by county", [id]),
    db.$client.query(
      "select ingested_at, margin_votes, margin_pct, reporting_units, total_units, result_status from tracked_snapshots where contest_id = $1 order by ingested_at desc limit 30",
      [id],
    ),
  ]);
  if (!contest.length) return null;
  const byCounty = new Map<string, ContestDetail["areas"][number]>();
  for (const a of areas) {
    const entry: ContestDetail["areas"][number] = byCounty.get(a.county_slug) ?? {
      county: a.county,
      countySlug: a.county_slug,
      reportingUnits: a.reporting_units,
      totalUnits: a.total_units,
      votes: {},
    };
    entry.votes[a.option_id] = a.votes;
    byCounty.set(a.county_slug, entry);
  }
  return {
    id,
    name: contest[0].name,
    ruleSource: contest[0].rule_source,
    options: options.map((o) => ({
      id: o.id,
      name: o.name,
      party: o.party,
      incumbent: o.incumbent,
      isWriteIn: o.is_write_in,
      votes: o.votes,
      votesByMethod: o.votes_by_method ?? {},
      rank: o.rank,
      isApparentWinner: o.is_apparent_winner,
    })),
    areas: [...byCounty.values()],
    history: history.map((h) => ({
      at: iso(h.ingested_at)!,
      marginVotes: h.margin_votes,
      marginPct: h.margin_pct,
      reportingUnits: h.reporting_units,
      totalUnits: h.total_units,
      status: h.result_status,
    })),
  };
});

/** Live numbers for a Writ race docket whose election the tracker follows. */
export const loadLiveResultsForElection = cached("live", async (electionId: string) => {
  const { rows } = await db.$client.query(
    `select c.id, c.source_election_id, c.name, c.result_status, c.reporting_units, c.total_units, c.margin_votes, c.margin_pct, c.flags, c.ingested_at,
            coalesce(json_agg(json_build_object('name', o.name, 'party', o.party, 'votes', o.votes, 'incumbent', o.incumbent) order by o.rank)
                     filter (where o.id is not null), '[]') as options
       from tracked_contests c left join tracked_contest_options o on o.contest_id = c.id
      where c.election_id = $1 and c.removed_at is null
      group by c.id order by c.election_date desc limit 1`,
    [electionId],
  );
  if (!rows.length) return null;
  const r = rows[0];
  return {
    contestId: r.id as string,
    sourceElectionId: r.source_election_id as string,
    name: r.name as string,
    status: r.result_status as ResultStatus,
    reportingUnits: r.reporting_units as number,
    totalUnits: r.total_units as number,
    marginVotes: r.margin_votes as number | null,
    marginPct: r.margin_pct as number | null,
    flags: r.flags as string[],
    ingestedAt: iso(r.ingested_at),
    options: r.options as { name: string; party: string | null; votes: number; incumbent: boolean }[],
  };
});
