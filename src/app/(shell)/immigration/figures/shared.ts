// Shared pieces for the stage modules beside this file: each one builds the
// charts and headline figures for one stage of the /immigration guide.

import type { ReactNode } from "react";
import type { ChartSource } from "@/components/charts/chart-card";
import type { SourceSpec } from "@/components/charts/citation";
import { periodTags } from "@/components/charts/period-tag";
import type { Headline } from "@/components/immigration/system/system-explorer";
import { formatPeriod, formatValue } from "@/lib/format";
import type { ImmigrationData } from "@/lib/immigration/data";
import type { StatKey } from "@/lib/immigration/system";
import type { ChartPoint } from "@/lib/stats/series";

export const SOURCE_SPECS = {
  cbp: { label: "U.S. Customs and Border Protection", href: "/datasets/cbp" },
  yearbook: { label: "DHS Yearbook of Immigration Statistics", href: "/datasets/dhs-yearbook" },
  unauthorized: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/dhs-unauthorized" },
  ohss: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/ohss-enforcement" },
  eoir: { label: "Executive Office for Immigration Review", href: "/datasets/eoir" },
  uscis: { label: "U.S. Citizenship and Immigration Services", href: "/datasets/uscis-forms" },
  refugees: { label: "State Department Refugee Processing Center", href: "/datasets/wraps-refugees" },
  overstays: { label: "CBP Entry/Exit Overstay Report", href: "/datasets/dhs-overstays" },
  lprPopulation: { label: "DHS Office of Homeland Security Statistics", href: "/datasets/ohss-lpr-population" },
  pep: { label: "Census Bureau Population Estimates", href: "/datasets/census-pep" },
  historical: {
    label: "Census Bureau decennial census and American Community Survey",
    href: "/datasets/census-historical-nativity",
  },
  acs: { label: "Census Bureau American Community Survey", href: "/datasets/census-acs1-immigration" },
  ice: { label: "ICE Detention Statistics", href: "/datasets/ice-detention" },
  flows: { label: "Census Bureau State-to-State Migration Flows", href: "/datasets/census-state-migration" },
  un: { label: "UN DESA International Migrant Stock", href: "/datasets/un-migrant-stock" },
} satisfies Record<string, SourceSpec>;

export type Sources = Record<keyof typeof SOURCE_SPECS, ChartSource>;

export interface FigureContext {
  d: ImmigrationData;
  SOURCES: Sources;
  trailing: string; // the last 12 months of CBP data, as a label
}

export interface StageFigures {
  stats: Partial<Record<StatKey, ReactNode>>;
  headlines: Partial<Record<StatKey, Headline>>;
}

export const compact = (v: number | null | undefined, unit = "people") => formatValue(v, unit, { compact: true });
export const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
export const fyLabel = (period: string | null | undefined) => (period ? formatPeriod(period) : "");
export const july = (period: string) => periodTags.july(period).label;

export const recent = (points: { value: number }[] | undefined, n = 24) =>
  points && points.length > 1 ? points.slice(-n).map((p) => p.value) : undefined;

export const summed = (series: { points: ChartPoint[] }[]) => {
  const byX = new Map<number, ChartPoint>();
  for (const p of series.flatMap((x) => x.points)) byX.set(p.x, { ...p, value: (byX.get(p.x)?.value ?? 0) + p.value });
  return [...byX.values()].sort((a, b) => a.x - b.x);
};

export const head = (
  value: number | null | undefined,
  label: string,
  spark?: number[],
  unit?: string,
): Headline | undefined =>
  value === null || value === undefined
    ? undefined
    : { value: unit === "percent" ? `${value.toFixed(1)}%` : compact(value), label, spark };

// A chart is only worth a figure when it has something to draw.
export const hasPoints = (series: { points: unknown[] }[]) => series.some((s) => s.points.length > 0);
