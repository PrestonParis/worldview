// Small pure helpers shared by the topic pages (immigration, crime) to turn
// stored Points into chart input and to compute comparison windows.

import { formatPeriod, periodToX } from "../format";
import type { Point } from "../db/stats";

export interface ChartPoint {
  x: number;
  label: string;
  value: number;
}

export function toChartPoints(points: Point[]): ChartPoint[] {
  return points.map((p) => ({ x: periodToX(p.period), label: formatPeriod(p.period), value: p.value }));
}

// "2026-08" shifted by n months (negative = back) -> "2025-09".
export function shiftMonth(period: string, n: number): string {
  const [y, m] = period.split("-").map(Number);
  const t = y * 12 + (m - 1) + n;
  return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, "0")}`;
}

// The point exactly n steps before the last one, by period label.
export function valueAt(points: Point[], period: string): number | null {
  return points.find((p) => p.period === period)?.value ?? null;
}

// Sum of the last n points ending at index `end` (inclusive).
export function trailingSum(points: Point[], n: number, end = points.length - 1): number | null {
  if (end - n + 1 < 0) return null;
  return points.slice(end - n + 1, end + 1).reduce((t, p) => t + p.value, 0);
}

// Calendar-year totals from monthly points; only complete years unless
// `partial` is set.
export function yearlyTotals(points: Point[], { partial = false } = {}): Point[] {
  const byYear = new Map<string, { sum: number; months: number }>();
  for (const p of points) {
    const y = p.period.slice(0, 4);
    const cur = byYear.get(y) ?? { sum: 0, months: 0 };
    cur.sum += p.value;
    cur.months += 1;
    byYear.set(y, cur);
  }
  return [...byYear]
    .filter(([, v]) => partial || v.months === 12)
    .map(([year, v]) => ({ period: year, periodStart: `${year}-01-01`, value: v.sum }));
}
