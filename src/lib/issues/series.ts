// Shared plumbing for the issue pages built on area_stats (economy, health
// care, guns, housing, education, energy): chart points from stored periods,
// state cross-sections for the StateExplorer, and source dataset lists.

import { datasetCoverage, getCrossSection, listDatasets, type Point } from "@/lib/db/stats";
import { formatPeriod, periodToX } from "@/lib/format";
import { STATES_51 } from "@/lib/geo/states";
import type { DatasetWithCoverage } from "@/components/data/dataset-list";
import type { RankedItem } from "@/components/charts/ranked-bars";
import type { StateMetric, StateRow } from "@/components/charts/state-explorer";
import type { Marker, SeriesPoint } from "@/components/charts/time-series-chart";

/** Chart points for any stored period ("2026", "2026-08", "2026-Q2"), optionally from a year on. */
export function toPoints(points: Point[] | undefined, from?: number): SeriesPoint[] {
  return (points ?? [])
    .map((p) => ({ x: periodToX(p.period), label: formatPeriod(p.period), value: p.value }))
    .filter((p) => from === undefined || p.x >= from);
}

export const last = (points: Point[] | undefined) => points?.at(-1) ?? null;
export const first = (points: Point[] | undefined) => points?.[0] ?? null;

/** The point `years` before the latest one with the same month/quarter, if stored. */
export function yearAgo(points: Point[] | undefined, years = 1): Point | null {
  const now = last(points);
  if (!now) return null;
  const target = now.period.replace(/^\d{4}/, (y) => String(Number(y) - years));
  return points!.find((p) => p.period === target) ?? null;
}

/** The highest and lowest points. */
export function extremes(points: Point[] | undefined) {
  if (!points?.length) return { max: null, min: null };
  return {
    max: points.reduce((a, b) => (b.value > a.value ? b : a)),
    min: points.reduce((a, b) => (b.value < a.value ? b : a)),
  };
}

/** Calendar-year averages of a monthly series, complete years only. */
export function annualAverage(points: Point[] | undefined): Point[] {
  const byYear = new Map<string, number[]>();
  for (const p of points ?? []) {
    const y = p.period.slice(0, 4);
    byYear.set(y, [...(byYear.get(y) ?? []), p.value]);
  }
  return [...byYear.entries()]
    .filter(([, vs]) => vs.length === 12)
    .map(([y, vs]) => ({ period: y, periodStart: `${y}-01-01`, value: vs.reduce((a, b) => a + b, 0) / 12 }));
}

/** Shaded spans for NBER recession months (a 0/1 monthly series), from a year on. */
export function recessionMarkers(flags: Point[] | undefined, from = 0): Marker[] {
  const out: Marker[] = [];
  let start: number | null = null;
  for (const p of flags ?? []) {
    const x = periodToX(p.period);
    if (p.value === 1 && start === null) start = x;
    if (p.value !== 1 && start !== null) {
      if (x >= from) out.push({ x: Math.max(start, from), to: x, label: "" });
      start = null;
    }
  }
  return out;
}

// ---- States ----

export interface StateSpec {
  source: string;
  metric: string;
  key?: string; // column key when the same metric comes from two sources
  label: string;
  unit: string;
  group: string;
  sourceLabel: string;
  description?: string;
}

/** Latest value of each spec for every state, shaped for StateExplorer. */
export async function stateTable(specs: StateSpec[]): Promise<{ metrics: StateMetric[]; rows: StateRow[] }> {
  const cross = await Promise.all(specs.map((s) => getCrossSection(s.source, s.metric, "state")));
  const keyOf = (s: StateSpec) => s.key ?? s.metric;
  const metrics: StateMetric[] = specs.map((s, i) => ({
    key: keyOf(s), label: s.label, unit: s.unit, group: s.group, source: s.sourceLabel,
    period: cross[i].period ? formatPeriod(cross[i].period!) : "",
    ...(s.description ? { description: s.description } : {}),
  }));
  const maps = cross.map((c) => new Map(c.values.map((v) => [v.geoid, v.value])));
  const rows: StateRow[] = STATES_51.map((st) => ({
    abbr: st.abbr,
    name: st.name,
    values: Object.fromEntries(specs.map((s, i) => [keyOf(s), maps[i].get(st.fips) ?? null])),
  }));
  return { metrics, rows };
}

/** Top (or, with `low`, bottom) states on one StateExplorer column. */
export function rankStates(rows: StateRow[], key: string, { n = 10, low = false } = {}): RankedItem[] {
  return rows
    .filter((r) => r.values[key] !== null && r.values[key] !== undefined)
    .sort((a, b) => (low ? a.values[key]! - b.values[key]! : b.values[key]! - a.values[key]!))
    .slice(0, n)
    .map((r) => ({ label: r.name, value: r.values[key]! }));
}

// ---- Sources ----

/** Catalog datasets by slug, in the order given, with coverage. */
export async function datasetsFor(slugs: string[]): Promise<DatasetWithCoverage[]> {
  const [all, cov] = await Promise.all([listDatasets(), datasetCoverage(slugs)]);
  return slugs.flatMap((slug) => {
    const d = all.find((x) => x.slug === slug);
    return d ? [{ ...d, coverage: cov[slug] ?? null }] : [];
  });
}
