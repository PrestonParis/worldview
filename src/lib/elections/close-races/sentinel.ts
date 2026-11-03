// Decisions behind the election-night sentinel (scripts/ga-results-health.mjs
// --loop) and the alert policy: what reaches the phone at once, what waits for
// the digest, when a run counts as stuck. Kept free of I/O so they can be tested.

import type { ScheduledElection } from "./schedule.ts";

const DAY_MS = 24 * 60 * 60_000;

/** A heartbeat this old, on a run this old, means the worker is hung, not starting. */
export const STUCK_HEARTBEAT_MIN = 20;
export const STUCK_RUN_MIN = 15;

/** Supabase disk limit, per the Oct 29 resize. */
export const DB_LIMIT_BYTES = 8 * 1024 ** 3;
export const DB_WARN_SHARE = 0.85;

/** The most jurisdictions that may be short before coverage pushes at once. */
export const COVERAGE_PUSH_AT = 16;

// Only these races push a lead change, tie or correction at once; hundreds of
// local races flip during the first hour and go into the digest.
const TOP_LEVELS = new Set(["federal", "statewide"]);
const CONTEST_EVENTS = new Set(["leader_change", "tie", "vote_decrease", "certification_regressed"]);

export function pushesAtOnce({ kind, level, severity, shortCount = 0 }: { kind: string; level?: string | null; severity?: string; shortCount?: number }): boolean {
  if (severity === "info") return false;
  if (CONTEST_EVENTS.has(kind)) return TOP_LEVELS.has(level ?? "");
  if (kind === "stale_county") return false;
  if (kind === "coverage") return shortCount >= COVERAGE_PUSH_AT;
  return true;
}

/** Hung: the heartbeat stopped (or never began), and the run has had time to start. */
export function runIsStuck({ heartbeatMinutes, runAgeMinutes }: { heartbeatMinutes: number | null; runAgeMinutes: number }): boolean {
  return runAgeMinutes >= STUCK_RUN_MIN && (heartbeatMinutes == null || heartbeatMinutes > STUCK_HEARTBEAT_MIN);
}

/** The sentinel runs from each election's watch start to 17:00 UTC two days after it. */
export function sentinelActive(schedule: ScheduledElection[], at: Date = new Date()): boolean {
  return schedule.some((e) => at.getTime() >= Date.parse(e.watchStartUtc) && at.getTime() < Date.parse(`${e.date}T17:00:00Z`) + 2 * DAY_MS);
}

/** 7 pm Eastern on a November or December election date (both on EST). */
export const pollsCloseMs = (date: string) => Date.parse(`${date}T00:00:00Z`) + DAY_MS;

export const digestStarted = (date: string, at: Date = new Date()) => at.getTime() >= pollsCloseMs(date);

/** Half-hourly through the count, hourly overnight. */
export function digestEveryMinutes(at: Date = new Date()): number {
  const hour = Number(at.toLocaleString("en-US", { timeZone: "America/New_York", hour: "numeric", hourCycle: "h23" }));
  return hour >= 1 && hour < 7 ? 60 : 30;
}

/** 7 am Eastern the day after the election: when the morning load and CSV are due. */
export const morningDueMs = (date: string) => pollsCloseMs(date) + 12 * 60 * 60_000;

export interface DigestInput {
  electionName: string;
  contests: number;
  withVotes: number;
  ranked: number;
  countiesFetched: number | null;
  heartbeatMinutes: number | null;
  closest: { name: string; county: string | null; marginVotes: number; marginPct: number | null }[];
  held: Record<string, number>;
  citiesWaiting: string[];
  reportUrl: string | null;
}

const HELD_LABELS: Record<string, string> = {
  leader_change: "lead changes",
  tie: "ties",
  vote_decrease: "corrections",
  certification_regressed: "certification reversals",
  stale_county: "stale-county notices",
  coverage: "coverage notices",
};

export function digestMessage(d: DigestInput): string {
  const lines = [
    `${d.electionName}: ${d.withVotes.toLocaleString("en-US")} of ${d.contests.toLocaleString("en-US")} contests have votes, ${d.ranked.toLocaleString("en-US")} ranked.`,
    `Counties ${d.countiesFetched ?? "?"}/159. Heartbeat ${d.heartbeatMinutes == null ? "none" : `${Math.round(d.heartbeatMinutes)} min ago`}.`,
  ];
  if (d.closest.length) {
    lines.push("Closest:");
    for (const c of d.closest) lines.push(`• ${c.marginVotes} votes: ${c.name}${c.county ? ` (${c.county})` : ""}`);
  }
  const held = Object.entries(d.held).filter(([, n]) => n > 0);
  if (held.length) lines.push(`Since last digest: ${held.map(([k, n]) => `${n} ${HELD_LABELS[k] ?? k}`).join(", ")}.`);
  if (d.citiesWaiting.length) lines.push(`No results yet: ${d.citiesWaiting.join(", ")}.`);
  if (d.reportUrl) lines.push(d.reportUrl);
  return lines.join("\n");
}
