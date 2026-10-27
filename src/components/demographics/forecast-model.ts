import {
  demographicSeries,
  getDemographicSeries,
  type DemographicDimensionId,
  type DemographicPoint,
  type DemographicSeries,
} from "@/lib/demographics/forecast";
import { unpackSeries, type RegionFile, type RegionRecord } from "@/lib/demographics/regional";

export type MapMode = "share" | "change";

export const DEFAULT_YEAR = 2025;
export const END_YEAR = 2050;

export const DEFAULT_FOCUS: Record<DemographicDimensionId, string> = {
  age: "age65plus",
  sex: "female",
  race: "hispanic",
  religion: "unaffiliated",
  orientation: "bisexual",
};

export const TOPIC_PAGES: Partial<Record<DemographicDimensionId, { href: string; label: string; blurb: string }>> = {
  religion: {
    href: "/religion",
    label: "Religion",
    blurb: "Attendance at services, religious traditions, beliefs, and party lean by state",
  },
};

export interface ViewRange {
  start: number;
  end: number;
}

export const isDimension = (value: string | null): value is DemographicDimensionId =>
  demographicSeries.some((series) => series.id === value);

export const isMode = (value: string | null): value is MapMode => value === "share" || value === "change";

export function writeParams(patch: Record<string, string | null>, push = false) {
  const params = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) params.delete(key);
    else params.set(key, value);
  }
  const query = params.toString();
  const url = query ? `?${query}` : window.location.pathname;
  if (push) window.history.pushState(null, "", url);
  else window.history.replaceState(null, "", url);
}

export function seriesBounds(series: DemographicSeries): [number, number] {
  const first = series.points[0].year;
  return [first, series.points.at(-1)?.year ?? first];
}

export function rangeAround(series: DemographicSeries, center: number, span: number): ViewRange {
  const [first, last] = seriesBounds(series);
  const boundedSpan = Math.min(span, last - first);
  const start = Math.min(last - boundedSpan, Math.max(first, Math.round(center - boundedSpan / 2)));
  return { start, end: start + boundedSpan };
}

export function fitRange(range: ViewRange, series: DemographicSeries): ViewRange {
  const [first, last] = seriesBounds(series);
  const span = Math.min(range.end - range.start, last - first);
  const start = Math.min(last - span, Math.max(first, range.start));
  return { start, end: start + span };
}

export function initialViewRanges(year: number): Record<DemographicDimensionId, ViewRange> {
  return Object.fromEntries(demographicSeries.map((item) => [item.id, rangeAround(item, year, 25)])) as Record<
    DemographicDimensionId,
    ViewRange
  >;
}

export function changeBaseline(series: DemographicSeries): DemographicPoint | null {
  return series.points.find((point) => point.year >= 2000) ?? null;
}

export const pointAt = (series: DemographicSeries, year: number) => series.points.find((point) => point.year === year);

export function regionSeries(
  region: RegionRecord,
  file: RegionFile,
  dimension: DemographicDimensionId,
): DemographicSeries | null {
  const packed = region.series[dimension];
  const meta = file.dimensions[dimension];
  if (!packed || !meta) return null;
  const national = getDemographicSeries(dimension);
  const who = national.universe === "adults" ? "Adults" : "Residents";
  return unpackSeries(packed, national, meta, `${who} of ${region.name}`);
}

export function cityNotice(series: DemographicSeries, cityName: string | null, stateName: string): string {
  const label = series.label.toLowerCase();
  if (!series.geographies.includes("city")) {
    return `City-level ${label} estimates aren't available. Showing ${stateName} instead.`;
  }
  return cityName
    ? `${series.label} figures aren't published for ${cityName}. Showing ${stateName} instead.`
    : `That city isn't in the data. Showing ${stateName} instead.`;
}

export async function loadRegions(url: string): Promise<RegionFile | null> {
  try {
    const response = await fetch(url);
    return response.ok ? ((await response.json()) as RegionFile) : null;
  } catch {
    return null;
  }
}
