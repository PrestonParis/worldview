// Coverage without hand counts (docs/elections/ga-close-races.md, "Coverage").
// SOS publishes every contest, with zero votes, before polls close, so the
// first copy of a county feed is that county's ballot definition. It is kept
// as the baseline (tracked_contest_baseline); every later copy is measured
// against it. A contest that drops out of a county feed, or a county feed
// that never arrives, shows on the report and raises an alert.

import { normalizeName } from "./merge.ts";
import type { ParsedFeed } from "./types.ts";

export interface BaselineContest {
  key: string;
  name: string;
}

export type CoverageStatus = "complete" | "partial" | "missing";

export interface CoverageRecord {
  source_election_id: string;
  jurisdiction_id: string;
  jurisdiction_name: string;
  jurisdiction_type: "county" | "municipality";
  expected_count: number | null;
  observed_count: number;
  status: CoverageStatus;
  source_url: string | null;
  local_results_url: string | null;
  notes: string | null;
}

/** One entry per distinct contest name in a county feed (state contests' county slices included). */
export function feedContests(feed: ParsedFeed): BaselineContest[] {
  const seen = new Map<string, BaselineContest>();
  for (const c of feed.contests) {
    const key = normalizeName(c.name);
    if (!seen.has(key)) seen.set(key, { key, name: c.name });
  }
  return [...seen.values()];
}

/** Baseline contests a feed adds: never removes, so a dropped contest stays expected. */
export function newBaselineContests(baseline: BaselineContest[] | undefined, current: BaselineContest[]): BaselineContest[] {
  const known = new Set((baseline ?? []).map((c) => c.key));
  return current.filter((c) => !known.has(c.key));
}

export interface CountyObservation {
  slug: string;
  name: string;
  /** Null when the county feed wasn't fetched this round. */
  contests: BaselineContest[] | null;
  feedUrl?: string | null;
}

export interface CityObservation {
  id: string;
  name: string;
  resultsUrl: string;
  source: string | null;
  expected: number;
  tracked: number;
  note: string | null;
}

const SHOWN_DROPPED = 5;

export function coverageRecords({
  electionId,
  counties,
  baseline,
  cities = [],
}: {
  electionId: string;
  counties: CountyObservation[];
  /** County slug → baseline contests, including any this round added. */
  baseline: Map<string, BaselineContest[]>;
  cities?: CityObservation[];
}): CoverageRecord[] {
  const rows: CoverageRecord[] = [];
  for (const c of counties) {
    const expected = baseline.get(c.slug) ?? [];
    const present = new Set((c.contests ?? []).map((x) => x.key));
    const dropped = expected.filter((x) => !present.has(x.key));
    const observed = expected.length - dropped.length;
    let status: CoverageStatus;
    if (!c.contests) status = "missing";
    else if (!dropped.length) status = "complete";
    else status = observed === 0 ? "missing" : "partial";
    const notes = !c.contests
      ? "county feed unavailable this round"
      : dropped.length
        ? `no longer in the feed: ${dropped.slice(0, SHOWN_DROPPED).map((x) => x.name).join("; ")}${dropped.length > SHOWN_DROPPED ? ` and ${dropped.length - SHOWN_DROPPED} more` : ""}`
        : null;
    rows.push({
      source_election_id: electionId,
      jurisdiction_id: c.slug,
      jurisdiction_name: c.name,
      jurisdiction_type: "county",
      expected_count: expected.length || null,
      observed_count: c.contests ? observed : 0,
      status,
      source_url: c.feedUrl ?? null,
      local_results_url: null,
      notes,
    });
  }
  for (const city of cities) {
    rows.push({
      source_election_id: electionId,
      jurisdiction_id: `municipality:${city.id}`,
      jurisdiction_name: city.name,
      jurisdiction_type: "municipality",
      expected_count: city.expected,
      observed_count: city.tracked,
      status: city.tracked >= city.expected ? "complete" : city.tracked === 0 ? "missing" : "partial",
      source_url: city.source,
      local_results_url: city.resultsUrl,
      notes: ["runs its own election", city.note].filter(Boolean).join("; "),
    });
  }
  return rows;
}
