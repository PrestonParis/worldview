import {
  normalize,
  type DemographicDimensionId,
  type DemographicPoint,
  type DemographicSeries,
  type DemographicSource,
} from "./forecast.ts";

// State and city demographic series. scripts/build-demographics.mjs builds
// them from Census / Pew / Gallup files and writes them, packed, to
// public/data/demographics/; the page unpacks them against the national
// series, which supplies category labels and colors.

export const PROJECTION_END = 2050;

export interface PackedSeries {
  start: number;
  observedThrough: number;
  categories: string[];
  // One row per year from `start` to PROJECTION_END, one column per category.
  values: number[][];
  // One row per year from `observedThrough` to PROJECTION_END.
  low: number[][];
  high: number[][];
}

export interface DimensionMeta {
  // How this level's figures were derived.
  basis: string;
  sources: DemographicSource[];
}

export interface RegionRecord {
  id: string; // state FIPS or place GEOID
  name: string;
  abbr?: string;
  stateId?: string;
  lat?: number;
  lon?: number;
  population: number;
  series: Partial<Record<DemographicDimensionId, PackedSeries>>;
}

// One file per level: public/data/demographics/states.json and
// public/data/demographics/cities/<state FIPS>.json.
export interface RegionFile {
  dimensions: Partial<Record<DemographicDimensionId, DimensionMeta>>;
  regions: RegionRecord[];
}

const round = (value: number) => Math.round(value * 100) / 100;

export function packSeries(
  points: DemographicPoint[],
  observedThrough: number,
  categories: string[],
): PackedSeries {
  const row = (values: Record<string, number>) => categories.map((key) => round(values[key] ?? 0));
  const projected = points.filter((point) => point.year >= observedThrough);
  return {
    start: points[0].year,
    observedThrough,
    categories,
    values: points.map((point) => row(point.values)),
    low: projected.map((point) => row(point.low ?? point.values)),
    high: projected.map((point) => row(point.high ?? point.values)),
  };
}

export function unpackSeries(
  packed: PackedSeries,
  national: DemographicSeries,
  meta: DimensionMeta,
  population: string,
): DemographicSeries {
  const record = (row: number[]) =>
    Object.fromEntries(packed.categories.map((key, index) => [key, row[index]]));
  return {
    ...national,
    population,
    basis: meta.basis,
    scenarios: undefined,
    observedThrough: packed.observedThrough,
    categories: national.categories.filter((category) => packed.categories.includes(category.id)),
    points: packed.values.map((row, index) => {
      const year = packed.start + index;
      const offset = year - packed.observedThrough;
      if (offset < 0) return { year, values: record(row) };
      return {
        year,
        values: record(row),
        low: record(packed.low[offset]),
        high: record(packed.high[offset]),
      };
    }),
    sources: meta.sources,
  };
}

// One category's central value in a given year straight from the packed
// rows (the maps color 51 states / hundreds of cities per frame without
// unpacking each one). Null outside the series' years.
export function packedValue(packed: PackedSeries | undefined, category: string, year: number): number | null {
  if (!packed) return null;
  const column = packed.categories.indexOf(category);
  const row = packed.values[year - packed.start];
  return column === -1 || !row ? null : row[column];
}

// Damped log-linear extrapolation of each category's share from its change
// over the last `window` observed years; `hold` categories keep their last
// observed share. Returns compositions for observedThrough+1..PROJECTION_END.
export function trendPath(
  history: DemographicPoint[],
  observedThrough: number,
  { window = 10, damping = 0.94, hold = [] as string[] } = {},
): DemographicPoint[] {
  const base = history.find((point) => point.year === observedThrough)!;
  const earlier =
    history.find((point) => point.year === observedThrough - window) ??
    history.find((point) => point.year < observedThrough) ??
    base;
  const span = Math.max(1, observedThrough - earlier.year);
  const rates = Object.fromEntries(
    Object.keys(base.values).map((key) => {
      const now = base.values[key];
      const then = earlier.values[key];
      const moving = !hold.includes(key) && now > 0 && then > 0;
      return [key, moving ? Math.log(now / then) / span : 0];
    }),
  );
  const out: DemographicPoint[] = [];
  let horizon = 0;
  for (let year = observedThrough + 1; year <= PROJECTION_END; year += 1) {
    horizon += damping ** (year - observedThrough - 1);
    out.push({
      year,
      values: normalize(Object.fromEntries(
        Object.entries(base.values).map(([key, value]) => [key, value * Math.exp(rates[key] * horizon)]),
      )),
    });
  }
  return out;
}

export interface ProjectionReference {
  points: DemographicPoint[]; // central path, annual
  scenarios: DemographicPoint[][]; // alternative paths; missing years fall back to `points`
}

export interface RegionProjection {
  points: DemographicPoint[]; // history + central projection, with low/high
  scenarios: DemographicPoint[][]; // this region's scaled scenario (and trend) paths
}

// Project a region from its last observed composition. Each reference path
// (central and every scenario) is applied proportionally — every category is
// multiplied by that path's change since the base year, then the composition
// is renormalized — so each scenario stays a coherent whole. With
// `includeTrend` the region's own damped trend is one more path and is
// averaged into the central line. low/high are the envelope of all paths.
export function projectRegion({
  history,
  observedThrough,
  reference,
  includeTrend,
  holdInTrend = [],
}: {
  history: DemographicPoint[];
  observedThrough: number;
  reference: ProjectionReference;
  includeTrend: boolean;
  holdInTrend?: string[];
}): RegionProjection {
  const observed = history.filter((point) => point.year <= observedThrough);
  const base = observed.at(-1)!.values;
  const keys = Object.keys(base);
  const centralAt = (year: number) => reference.points.find((point) => point.year === year)!.values;
  const at = (path: DemographicPoint[], year: number) =>
    path.find((point) => point.year === year)?.values ?? centralAt(year);

  const years = Array.from(
    { length: PROJECTION_END - observedThrough },
    (_, index) => observedThrough + 1 + index,
  );
  const scale = (path: DemographicPoint[]): DemographicPoint[] => {
    const from = at(path, observedThrough);
    return years.map((year) => {
      const to = at(path, year);
      return {
        year,
        values: normalize(Object.fromEntries(
          keys.map((key) => [key, base[key] * (from[key] > 0 && to[key] !== undefined ? to[key] / from[key] : 1)]),
        )),
      };
    });
  };

  const mid = scale(reference.points);
  const trend = includeTrend ? trendPath(observed, observedThrough, { hold: holdInTrend }) : null;
  const scenarios = [...reference.scenarios.map(scale), ...(trend ? [trend] : [])];

  const projected = years.map((year, index) => {
    const central = trend
      ? normalize(Object.fromEntries(
          keys.map((key) => [key, (mid[index].values[key] + trend[index].values[key]) / 2]),
        ))
      : mid[index].values;
    const low: Record<string, number> = {};
    const high: Record<string, number> = {};
    for (const key of keys) {
      const candidates = [central[key], mid[index].values[key], ...scenarios.map((path) => path[index].values[key])];
      low[key] = round(Math.max(0, Math.min(...candidates)));
      high[key] = round(Math.min(100, Math.max(...candidates)));
    }
    return { year, values: central, low, high };
  });

  return {
    points: [
      ...observed.map((point) =>
        point.year === observedThrough
          ? { ...point, low: { ...point.values }, high: { ...point.values } }
          : point,
      ),
      ...projected,
    ],
    scenarios,
  };
}
