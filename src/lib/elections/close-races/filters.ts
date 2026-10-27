// URL query ⇄ report filters, shared by the Writ page and the CSV route so
// a shared link and its download always list the same contests.

import type { CloseRaceFilters } from "./rows.ts";
import { CONTEST_LEVELS, RESULT_STATUSES, type ContestFlag, type ContestLevel, type ResultStatus } from "./types.ts";

const FLAGS: ContestFlag[] = ["tie", "recount_request_range", "runoff_required", "near_runoff", "runoff_rule_unverified", "merged", "unlinked_counties"];

type Params = Record<string, string | string[] | undefined> | URLSearchParams;

function get(params: Params, key: string): string | null {
  const value = params instanceof URLSearchParams ? params.get(key) : params[key];
  const one = Array.isArray(value) ? value[0] : value;
  return one && one.trim() ? one.trim() : null;
}

function positive(value: string | null): number | null {
  if (value == null) return null;
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export function parseCloseRaceFilters(params: Params): CloseRaceFilters {
  const level = get(params, "level");
  const status = get(params, "status");
  const flag = get(params, "flag");
  return {
    sort: get(params, "sort") === "percent" ? "percent" : "votes",
    level: level && (CONTEST_LEVELS as string[]).includes(level) ? (level as ContestLevel) : null,
    county: get(params, "county"),
    municipality: get(params, "city"),
    office: get(params, "q"),
    maxPct: positive(get(params, "max_pts")),
    maxVotes: positive(get(params, "max_votes")),
    status: status && (RESULT_STATUSES as string[]).includes(status) ? (status as ResultStatus) : null,
    flag: flag && (FLAGS as string[]).includes(flag) ? (flag as ContestFlag) : null,
  };
}

export function closeRaceQuery(f: CloseRaceFilters, changes: Partial<CloseRaceFilters> = {}): string {
  const merged = { ...f, ...changes };
  const q = new URLSearchParams();
  if (merged.sort === "percent") q.set("sort", "percent");
  if (merged.level) q.set("level", merged.level);
  if (merged.county) q.set("county", merged.county);
  if (merged.municipality) q.set("city", merged.municipality);
  if (merged.office) q.set("q", merged.office);
  if (merged.maxPct != null) q.set("max_pts", String(merged.maxPct));
  if (merged.maxVotes != null) q.set("max_votes", String(merged.maxVotes));
  if (merged.status) q.set("status", merged.status);
  if (merged.flag) q.set("flag", merged.flag);
  const s = q.toString();
  return s ? `?${s}` : "";
}

export const FLAG_LABELS: Record<ContestFlag, string> = {
  tie: "Exact tie",
  recount_request_range: "Within recount-request range",
  runoff_required: "Below majority",
  near_runoff: "Near runoff line",
  runoff_rule_unverified: "Runoff rule unverified",
  merged: "Merged across counties",
  unlinked_counties: "County results not linked by SOS",
};

export const STATUS_LABELS: Record<ResultStatus, string> = {
  no_results: "No results yet",
  reporting: "Reporting",
  unofficial_complete: "Unofficially complete",
  county_certified: "County certified",
  state_certified: "State certified",
  recount_pending: "Recount pending",
  contested: "Contested",
};

export const LEVEL_LABELS: Record<ContestLevel, string> = {
  federal: "Federal",
  statewide: "Statewide",
  legislative: "Legislature",
  judicial: "Courts & DAs",
  county: "County",
  municipal: "City",
  school: "School board",
  referendum: "Ballot question",
};

export const FILTER_FLAGS = FLAGS;
