// Loaders for Writ's close-races report (docs/elections/ga-close-races.md,
// "Report"). The ranked rows come from the one shared query in
// src/lib/elections/close-races/rows.ts; results are cached for 60 s under
// CLOSE_RACES_TAG, which the ingester expires after every write
// (/api/writ/revalidate).

import { unstable_cache } from "next/cache";
import { db } from "./client";
import { CLOSE_RACE_ROWS_SQL, filterReport, toReportRow, type CloseRaceFilters, type DbCloseRaceRow, type FilteredReport, type ReportRow } from "../elections/close-races/rows";
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

const loadRows = cached("rows", async (election: string): Promise<ReportRow[]> => {
  const { rows } = await db.$client.query<DbCloseRaceRow>(CLOSE_RACE_ROWS_SQL, [election]);
  return rows.map(toReportRow);
});

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

/** The election a retired id now lives under (SOS published it under a new id). */
export function movedElection(elections: TrackedElection[], id: string): TrackedElection | null {
  if (elections.some((e) => e.id === id)) return null;
  return elections.find((e) => e.replaces === id) ?? null;
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
