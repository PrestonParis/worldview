import { validQuizMode, type QuizModeId } from "@/lib/quiz/modes";
import type { AnalyticsOptions } from "@/lib/quiz/analytics";

// Daily buckets and "new" times read in the owner's zone, not the server's UTC.
export const STATS_TIME_ZONE = "America/New_York";

export const RANGES = { "7d": "Last 7 days", "30d": "Last 30 days", all: "All time" } as const;
export type Range = keyof typeof RANGES;

export interface StatsFilters {
  range: Range;
  mode: QuizModeId | null;
  bank: string | null;
  flagged: boolean;
}

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);

export function parseFilters(sp: Params): StatsFilters {
  const range = one(sp.range);
  const mode = one(sp.mode);
  const bank = one(sp.bank);
  return {
    range: range && range in RANGES ? (range as Range) : "all",
    mode: mode ? validQuizMode(mode, "standard") : null,
    bank: bank && /^[\w.-]{1,20}$/.test(bank) ? bank : null,
    flagged: one(sp.flagged) === "1",
  };
}

export function analyticsOptions(f: StatsFilters, now: Date): AnalyticsOptions {
  const days = f.range === "7d" ? 7 : f.range === "30d" ? 30 : null;
  return {
    now,
    from: days ? new Date(now.getTime() - days * 86_400_000) : null,
    mode: f.mode,
    bank: f.bank,
    includeFlagged: f.flagged,
    timeZone: STATS_TIME_ZONE,
  };
}

export function filterQuery(f: StatsFilters, extra: Record<string, string> = {}): string {
  const q = new URLSearchParams(extra);
  if (f.range !== "all") q.set("range", f.range);
  if (f.mode) q.set("mode", f.mode);
  if (f.bank) q.set("bank", f.bank);
  if (f.flagged) q.set("flagged", "1");
  const s = q.toString();
  return s ? `?${s}` : "";
}
