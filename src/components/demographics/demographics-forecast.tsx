"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  demographicSeries,
  getDemographicSeries,
  type DemographicDimensionId,
  type DemographicPoint,
  type DemographicSeries,
} from "@/lib/demographics/forecast";
import {
  packedValue,
  unpackSeries,
  type RegionFile,
  type RegionRecord,
} from "@/lib/demographics/regional";
import { DemographicsMap, valueExtent, type MapArea, type MapCity } from "./demographics-map";

const CHART_WIDTH = 960;
const CHART_HEIGHT = 350;
const MARGIN = { top: 24, right: 12, bottom: 34, left: 42 };
const PLOT_WIDTH = CHART_WIDTH - MARGIN.left - MARGIN.right;
const PLOT_HEIGHT = CHART_HEIGHT - MARGIN.top - MARGIN.bottom;

function xFor(year: number, start: number, end: number): number {
  return MARGIN.left + ((year - start) / Math.max(1, end - start)) * PLOT_WIDTH;
}

function yFor(percent: number, maximum: number): number {
  return MARGIN.top + ((maximum - percent) / maximum) * PLOT_HEIGHT;
}

type Pick = (point: DemographicPoint) => number;

function pathThrough(
  points: DemographicPoint[],
  pick: Pick,
  maximum: number,
  visibleStart: number,
  visibleEnd: number,
): string {
  return points
    .map((point, index) => {
      const x = xFor(point.year, visibleStart, visibleEnd);
      const y = yFor(pick(point), maximum);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

// Closed polygon: along the high bound, back along the low bound.
function bandPath(
  points: DemographicPoint[],
  low: Pick,
  high: Pick,
  maximum: number,
  visibleStart: number,
  visibleEnd: number,
): string {
  const top = points.map((point) => `${xFor(point.year, visibleStart, visibleEnd)} ${yFor(high(point), maximum)}`);
  const bottom = [...points]
    .reverse()
    .map((point) => `${xFor(point.year, visibleStart, visibleEnd)} ${yFor(low(point), maximum)}`);
  return `M ${top.join(" L ")} L ${bottom.join(" L ")} Z`;
}

function yMaximum(series: DemographicSeries): number {
  const maximum = Math.max(
    ...series.points.flatMap((point) =>
      series.categories.map((category) => point.high?.[category.id] ?? point.values[category.id] ?? 0),
    ),
  );
  return Math.min(100, Math.max(10, Math.ceil(maximum / 10) * 10));
}

function yearTicks(start: number, end: number): number[] {
  const span = end - start;
  const step = span <= 12 ? 2 : span <= 30 ? 5 : span <= 60 ? 10 : 50;
  const ticks = [start];
  // Skip round years that would crowd the labelled first and last years.
  for (let year = Math.ceil(start / step) * step; year < end; year += step) {
    if (year - start >= step * 0.6 && end - year >= step * 0.6) ticks.push(year);
  }
  ticks.push(end);
  return [...new Set(ticks)];
}

const isProjected = (series: DemographicSeries, point: DemographicPoint) =>
  point.year > series.observedThrough && point.low !== undefined && point.high !== undefined;

function LineChart({
  series,
  selectedYear,
  visibleStart,
  visibleEnd,
  onPan,
}: {
  series: DemographicSeries;
  selectedYear: number;
  visibleStart: number;
  visibleEnd: number;
  onPan: (start: number) => void;
}) {
  const ticks = yearTicks(visibleStart, visibleEnd);
  const forecastStart = Math.max(visibleStart, series.observedThrough);
  const forecastX = xFor(forecastStart, visibleStart, visibleEnd);
  const selectedX = xFor(selectedYear, visibleStart, visibleEnd);
  const maximum = yMaximum(series);
  const yTicks = Array.from({ length: 5 }, (_, index) => (maximum / 4) * index);
  const visiblePoints = series.points.filter(
    (point) => point.year >= visibleStart && point.year <= visibleEnd,
  );
  const observedPoints = visiblePoints.filter((point) => point.year <= series.observedThrough);
  const forecastPoints = visiblePoints.filter(
    (point) => point.year >= series.observedThrough && point.low && point.high,
  );
  const selectedPoint = series.points.find((point) => point.year === selectedYear) ?? series.points[0];
  const selectedProjected = isProjected(series, selectedPoint);
  const drag = useRef<{ pointerId: number; clientX: number; start: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, start: visibleStart };
    setDragging(true);
  };

  const continueDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    const pixelWidth = event.currentTarget.getBoundingClientRect().width * (PLOT_WIDTH / CHART_WIDTH);
    const delta = Math.round(
      ((drag.current.clientX - event.clientX) / pixelWidth) * (visibleEnd - visibleStart),
    );
    onPan(drag.current.start + delta);
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId === event.pointerId) drag.current = null;
    setDragging(false);
  };

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={`${series.label} percentage lines from ${visibleStart} to ${visibleEnd}, with projection ranges after ${series.observedThrough}`}
      className={`block h-auto w-full select-none ${dragging ? "cursor-grabbing" : "cursor-grab"}`}
      style={{ touchAction: "pan-y" }}
      onPointerDown={beginDrag}
      onPointerMove={continueDrag}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
    >
      {visibleEnd > series.observedThrough ? (
        <rect
          x={forecastX}
          y={MARGIN.top}
          width={CHART_WIDTH - MARGIN.right - forecastX}
          height={PLOT_HEIGHT}
          fill="#64748b"
          opacity="0.07"
        />
      ) : null}

      {yTicks.map((value) => (
        <g key={value}>
          <line
            x1={MARGIN.left}
            x2={CHART_WIDTH - MARGIN.right}
            y1={yFor(value, maximum)}
            y2={yFor(value, maximum)}
            stroke="#64748b"
            strokeOpacity="0.22"
            strokeWidth="1"
          />
          <text
            x={MARGIN.left - 9}
            y={yFor(value, maximum) + 4}
            textAnchor="end"
            fill="#94a3b8"
            fontSize="11"
          >
            {Number.isInteger(value) ? value : value.toFixed(1)}%
          </text>
        </g>
      ))}

      {/* Bands first so every line sits above every wash. */}
      {forecastPoints.length > 1
        ? series.categories.map((category) => (
            <path
              key={`band-${category.id}`}
              d={bandPath(
                forecastPoints,
                (point) => point.low?.[category.id] ?? 0,
                (point) => point.high?.[category.id] ?? 0,
                maximum,
                visibleStart,
                visibleEnd,
              )}
              fill={category.color}
              fillOpacity="0.14"
              stroke="none"
            />
          ))
        : null}

      {series.categories.map((category) => (
        <g key={category.id}>
          {observedPoints.length > 1 ? (
            <path
              d={pathThrough(observedPoints, (point) => point.values[category.id] ?? 0, maximum, visibleStart, visibleEnd)}
              fill="none"
              stroke={category.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {forecastPoints.length > 1
            ? (["low", "high"] as const).map((bound) => (
                <path
                  key={bound}
                  d={pathThrough(
                    forecastPoints,
                    (point) => point[bound]?.[category.id] ?? 0,
                    maximum,
                    visibleStart,
                    visibleEnd,
                  )}
                  fill="none"
                  stroke={category.color}
                  strokeWidth="2"
                  strokeDasharray="7 6"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              ))
            : null}
        </g>
      ))}

      {series.observedThrough > visibleStart && series.observedThrough < visibleEnd ? (
        <g>
          <line
            x1={forecastX}
            x2={forecastX}
            y1={MARGIN.top}
            y2={CHART_HEIGHT - MARGIN.bottom}
            stroke="#cbd5e1"
            strokeOpacity="0.8"
            strokeWidth="1"
            strokeDasharray="4 5"
          />
          <text
            x={Math.min(forecastX + 8, CHART_WIDTH - 74)}
            y={MARGIN.top + 15}
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.3"
          >
            FORECAST
          </text>
        </g>
      ) : null}

      {selectedYear >= visibleStart && selectedYear <= visibleEnd ? (
        <g>
          <line
            x1={selectedX}
            x2={selectedX}
            y1={MARGIN.top}
            y2={CHART_HEIGHT - MARGIN.bottom}
            stroke="#94a3b8"
            strokeOpacity="0.9"
            strokeWidth="1.5"
          />
          {series.categories.flatMap((category) =>
            (selectedProjected
              ? [selectedPoint.low?.[category.id] ?? 0, selectedPoint.high?.[category.id] ?? 0]
              : [selectedPoint.values[category.id] ?? 0]
            ).map((value, index) => (
              <circle
                key={`${category.id}-${index}`}
                cx={selectedX}
                cy={yFor(value, maximum)}
                r="4"
                fill={category.color}
                stroke="#0f172a"
                strokeWidth="1.5"
              />
            )),
          )}
        </g>
      ) : null}

      {ticks.map((year) => (
        <text
          key={year}
          x={xFor(year, visibleStart, visibleEnd)}
          y={CHART_HEIGHT - 10}
          textAnchor={year === ticks[0] ? "start" : year === ticks.at(-1) ? "end" : "middle"}
          fill="#94a3b8"
          fontSize="11"
        >
          {year}
        </text>
      ))}
    </svg>
  );
}

function CompositionRail({
  series,
  point,
  focus,
  onFocus,
}: {
  series: DemographicSeries;
  point: DemographicPoint;
  focus: string;
  onFocus: (category: string) => void;
}) {
  const baseline = series.points[0];
  const projected = isProjected(series, point);

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-end justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Composition</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {projected ? `${point.year} projected range` : `${point.year} estimate`}
          </p>
        </div>
        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
          {point.year}
        </p>
      </div>

      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-900">
        {series.categories.map((category) => {
          const value = point.values[category.id] ?? 0;
          const low = point.low?.[category.id] ?? value;
          const high = point.high?.[category.id] ?? value;
          const change = value - (baseline.values[category.id] ?? 0);
          const active = category.id === focus;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onFocus(category.id)}
              aria-pressed={active}
              className={`-mx-2 block w-[calc(100%+1rem)] rounded-lg px-2 py-3 text-left transition-colors ${
                active ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex items-center gap-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      {category.label}
                      {active ? <MapPin size={11} className="shrink-0 text-slate-400" aria-label="Shown on map" /> : null}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
                      {projected ? `${low.toFixed(1)}–${high.toFixed(1)}%` : `${value.toFixed(1)}%`}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="relative h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                      {projected ? (
                        <>
                          <div
                            className="absolute inset-y-0 left-0 rounded-full opacity-30"
                            style={{ width: `${low}%`, backgroundColor: category.color }}
                          />
                          <div
                            className="absolute inset-y-0 rounded-full"
                            style={{
                              left: `${low}%`,
                              width: `max(4px, ${high - low}%)`,
                              backgroundColor: category.color,
                            }}
                          />
                        </>
                      ) : (
                        <div
                          className="h-full rounded-full"
                          style={{ width: `${Math.max(1, value)}%`, backgroundColor: category.color }}
                        />
                      )}
                    </div>
                    <span
                      className={`w-12 text-right font-mono text-[10px] tabular-nums ${
                        change > 0.045
                          ? "text-emerald-600 dark:text-emerald-400"
                          : change < -0.045
                            ? "text-rose-600 dark:text-rose-400"
                            : "text-slate-400"
                      }`}
                    >
                      {Math.abs(change) < 0.045 ? "—" : `${change > 0 ? "+" : ""}${change.toFixed(1)}`}
                    </span>
                  </div>
                </div>
              </div>
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">
        Change in percentage points from {baseline.year}
        {projected ? " (midpoint of range)" : ""} · select a group to map it
      </p>
    </aside>
  );
}

interface ViewRange {
  start: number;
  end: number;
}

function seriesBounds(series: DemographicSeries): [number, number] {
  const first = series.points[0].year;
  return [first, series.points.at(-1)?.year ?? first];
}

function rangeAround(series: DemographicSeries, center: number, span: number): ViewRange {
  const [first, last] = seriesBounds(series);
  const boundedSpan = Math.min(span, last - first);
  const start = Math.min(last - boundedSpan, Math.max(first, Math.round(center - boundedSpan / 2)));
  return { start, end: start + boundedSpan };
}

// Keep a stored view inside a (possibly shorter) geography's years.
function fitRange(range: ViewRange, series: DemographicSeries): ViewRange {
  const [first, last] = seriesBounds(series);
  const span = Math.min(range.end - range.start, last - first);
  const start = Math.min(last - span, Math.max(first, range.start));
  return { start, end: start + span };
}

function initialViewRanges(): Record<DemographicDimensionId, ViewRange> {
  return Object.fromEntries(
    demographicSeries.map((item) => [item.id, rangeAround(item, 2026, 25)]),
  ) as Record<DemographicDimensionId, ViewRange>;
}

// Which group the map shows first: the one whose geography varies most.
const DEFAULT_FOCUS: Record<DemographicDimensionId, string> = {
  sex: "female",
  race: "hispanic",
  orientation: "bisexual",
  religion: "unaffiliated",
};

function formatPopulation(value: number): string {
  if (value >= 1e6) return `${(value / 1e6).toFixed(1)}M`;
  if (value >= 1e3) return `${Math.round(value / 1e3)}K`;
  return String(value);
}

function regionSeries(
  region: RegionRecord,
  file: RegionFile,
  dimension: DemographicDimensionId,
): DemographicSeries | null {
  const packed = region.series[dimension];
  const meta = file.dimensions[dimension];
  if (!packed || !meta) return null;
  const national = getDemographicSeries(dimension);
  const who = national.population.includes("adults") ? "Adults" : "Residents";
  return unpackSeries(packed, national, meta, `${who} of ${region.name}`);
}

async function loadRegions(url: string): Promise<RegionFile | null> {
  try {
    const res = await fetch(url);
    return res.ok ? ((await res.json()) as RegionFile) : null;
  } catch {
    return null;
  }
}

export function DemographicsForecast() {
  const searchParams = useSearchParams();
  const requestedState = searchParams.get("state");
  const requestedCity = searchParams.get("city");

  const [statesFile, setStatesFile] = useState<RegionFile | null>(null);
  const [cityFiles, setCityFiles] = useState<Record<string, RegionFile | null>>({});

  useEffect(() => {
    void loadRegions("/data/demographics/states.json").then(setStatesFile);
  }, []);

  useEffect(() => {
    if (!requestedState || requestedState in cityFiles) return;
    void loadRegions(`/data/demographics/cities/${requestedState}.json`).then((file) =>
      setCityFiles((current) => ({ ...current, [requestedState]: file })),
    );
  }, [requestedState, cityFiles]);

  const state = statesFile?.regions.find((region) => region.id === requestedState) ?? null;
  const cityFile = state ? cityFiles[state.id] ?? null : null;
  const city = cityFile?.regions.find((region) => region.id === requestedCity) ?? null;
  const region = city ?? state;
  const regionFile = city ? cityFile : statesFile;

  const [dimension, setDimension] = useState<DemographicDimensionId>("race");
  const available = (id: DemographicDimensionId) => !region || Boolean(region.series[id]);
  const activeDimension = available(dimension) ? dimension : "race";

  const series = useMemo(
    () =>
      (region && regionFile && regionSeries(region, regionFile, activeDimension)) ||
      getDemographicSeries(activeDimension),
    [region, regionFile, activeDimension],
  );
  const [firstYear, lastYear] = seriesBounds(series);

  const [years, setYears] = useState<Record<DemographicDimensionId, number>>({
    sex: 2026,
    race: 2026,
    orientation: 2026,
    religion: 2026,
  });
  const [viewRanges, setViewRanges] = useState<Record<DemographicDimensionId, ViewRange>>(
    initialViewRanges,
  );
  const [focus, setFocus] = useState<Partial<Record<DemographicDimensionId, string>>>({});
  const selectedYear = Math.min(lastYear, Math.max(firstYear, years[activeDimension]));
  const viewRange = fitRange(viewRanges[activeDimension], series);
  const point = useMemo(
    () => series.points.find((item) => item.year === selectedYear) ?? series.points[0],
    [selectedYear, series],
  );
  const focusCategory =
    series.categories.find((category) => category.id === (focus[activeDimension] ?? DEFAULT_FOCUS[activeDimension])) ??
    series.categories[0];

  const navigate = useCallback((next: { state: string | null; city: string | null }) => {
    const params = new URLSearchParams();
    if (next.state) params.set("state", next.state);
    if (next.state && next.city) params.set("city", next.city);
    const query = params.toString();
    window.history.pushState(null, "", query ? `?${query}` : window.location.pathname);
  }, []);
  const selectState = useCallback((id: string) => navigate({ state: id, city: null }), [navigate]);
  const selectCity = useCallback(
    (id: string) => navigate({ state: id.slice(0, 2), city: id }),
    [navigate],
  );

  const moveView = (nextStart: number) => {
    const span = viewRange.end - viewRange.start;
    const start = Math.min(lastYear - span, Math.max(firstYear, nextStart));
    const end = start + span;
    setViewRanges((current) => ({ ...current, [activeDimension]: { start, end } }));
    if (selectedYear < start || selectedYear > end) {
      setYears((current) => ({
        ...current,
        [activeDimension]: Math.min(end, Math.max(start, selectedYear)),
      }));
    }
  };

  const setViewSpan = (span: number | "all") => {
    const next = span === "all" ? { start: firstYear, end: lastYear } : rangeAround(series, selectedYear, span);
    setViewRanges((current) => ({ ...current, [activeDimension]: next }));
  };

  const selectYear = (year: number) => {
    setYears((current) => ({ ...current, [activeDimension]: year }));
    if (year < viewRange.start || year > viewRange.end) {
      const span = viewRange.end - viewRange.start;
      setViewRanges((current) => ({ ...current, [activeDimension]: rangeAround(series, year, span) }));
    }
  };

  const mapStates = useMemo<MapArea[]>(
    () =>
      (statesFile?.regions ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        value: packedValue(item.series[activeDimension], focusCategory.id, selectedYear),
      })),
    [statesFile, activeDimension, focusCategory.id, selectedYear],
  );
  const mapCities = useMemo<MapCity[]>(
    () =>
      (cityFile?.regions ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        lat: item.lat ?? 0,
        lon: item.lon ?? 0,
        population: item.population,
        value: packedValue(item.series[activeDimension], focusCategory.id, selectedYear),
      })),
    [cityFile, activeDimension, focusCategory.id, selectedYear],
  );
  const legendAreas = state ? mapCities : mapStates;
  const [legendMin, legendMax] = valueExtent(legendAreas.map((area) => area.value));
  const legendHasData = legendAreas.some((area) => area.value !== null);
  const formatValue = useCallback(
    (value: number | null) => (value === null ? "no data" : `${focusCategory.label} ${value.toFixed(1)}%`),
    [focusCategory.label],
  );

  const placeName = city ? `${city.name}, ${state?.abbr}` : state?.name ?? "United States";
  const loadingRegion = (requestedState && !state && !statesFile) || (requestedCity && !city && !cityFile);

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex min-w-0 flex-wrap gap-1">
          {demographicSeries.map((item) => {
            const enabled = available(item.id);
            return (
              <button
                key={item.id}
                type="button"
                disabled={!enabled}
                title={enabled ? undefined : "Not published at the city level"}
                onClick={() => setDimension(item.id)}
                className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all disabled:cursor-not-allowed disabled:opacity-40 ${
                  activeDimension === item.id
                    ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                    : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 disabled:hover:bg-transparent dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-4 px-2 text-xs text-slate-500 dark:text-slate-400">
          <nav aria-label="Geography" className="flex items-center gap-1.5">
            <MapPin size={14} className="shrink-0" />
            {state ? (
              <button
                type="button"
                onClick={() => navigate({ state: null, city: null })}
                className="hover:text-slate-950 hover:underline dark:hover:text-white"
              >
                United States
              </button>
            ) : (
              <span className="font-medium text-slate-900 dark:text-slate-100">United States</span>
            )}
            {state ? (
              <>
                <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />
                {city ? (
                  <button
                    type="button"
                    onClick={() => navigate({ state: state.id, city: null })}
                    className="hover:text-slate-950 hover:underline dark:hover:text-white"
                  >
                    {state.name}
                  </button>
                ) : (
                  <span className="font-medium text-slate-900 dark:text-slate-100">{state.name}</span>
                )}
              </>
            ) : null}
            {city ? (
              <>
                <ChevronRight size={12} className="text-slate-300 dark:text-slate-600" />
                <span className="font-medium text-slate-900 dark:text-slate-100">{city.name}</span>
              </>
            ) : null}
          </nav>
          <span className="hidden items-center gap-1.5 sm:inline-flex"><CalendarRange size={14} /> Through 2050</span>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <div className="min-w-0 space-y-5">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {focusCategory.label} · {selectedYear}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {state
                    ? `Cities in ${state.name} with 65,000+ residents — select one to open it`
                    : "Select a state to open it"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <label className="sr-only" htmlFor="demographics-state">State</label>
                <select
                  id="demographics-state"
                  value={state?.id ?? ""}
                  onChange={(event) =>
                    event.target.value ? selectState(event.target.value) : navigate({ state: null, city: null })
                  }
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                >
                  <option value="">All states</option>
                  {[...(statesFile?.regions ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => (
                      <option key={item.id} value={item.id}>{item.name}</option>
                    ))}
                </select>
                {state && cityFile ? (
                  <>
                    <label className="sr-only" htmlFor="demographics-city">City</label>
                    <select
                      id="demographics-city"
                      value={city?.id ?? ""}
                      onChange={(event) =>
                        event.target.value
                          ? selectCity(event.target.value)
                          : navigate({ state: state.id, city: null })
                      }
                      className="max-w-48 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                    >
                      <option value="">All of {state.name}</option>
                      {cityFile.regions.map((item) => (
                        <option key={item.id} value={item.id}>{item.name}</option>
                      ))}
                    </select>
                  </>
                ) : null}
              </div>
            </div>

            <DemographicsMap
              states={mapStates}
              cities={mapCities}
              selectedStateId={state?.id ?? null}
              selectedCityId={city?.id ?? null}
              color={focusCategory.color}
              formatValue={formatValue}
              onSelectState={selectState}
              onSelectCity={selectCity}
            />

            <div className="flex flex-wrap items-center gap-3 px-5 py-3 text-[10px] text-slate-500 dark:text-slate-400">
              {legendHasData ? (
                <>
                  <span className="font-mono tabular-nums">{legendMin.toFixed(1)}%</span>
                  <span
                    className="h-2 w-40 rounded-full"
                    style={{
                      background: `linear-gradient(to right, color-mix(in srgb, ${focusCategory.color} 12%, white), ${focusCategory.color})`,
                    }}
                  />
                  <span className="font-mono tabular-nums">{legendMax.toFixed(1)}%</span>
                  <span>{focusCategory.label}, {state ? "by city" : "by state"}</span>
                </>
              ) : (
                <span>
                  {state
                    ? `${series.label} is not published for individual cities`
                    : `No state figures for ${selectedYear}`}
                </span>
              )}
            </div>
          </section>

          <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2.5">
                  <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                    {series.label} · {placeName}
                  </h2>
                  <span
                    className={`rounded-full px-2 py-1 text-[9px] font-bold tracking-[0.12em] uppercase ${
                      selectedYear > series.observedThrough
                        ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"
                        : "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300"
                    }`}
                  >
                    {selectedYear > series.observedThrough ? "Forecast" : "Observed"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  {series.description} · {series.population}
                  {region ? ` · ${formatPopulation(region.population)} residents` : ""}
                  {loadingRegion ? " · loading…" : ""}
                </p>
                {series.basis ? (
                  <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">{series.basis}</p>
                ) : null}
              </div>
              <p className="font-mono text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">{selectedYear}</p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
              <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                <button
                  type="button"
                  onClick={() => moveView(viewRange.start - Math.max(1, Math.round((viewRange.end - viewRange.start) / 3)))}
                  className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white"
                  aria-label="Show earlier years"
                >
                  <ChevronLeft size={15} />
                </button>
                <span className="min-w-24 text-center font-mono font-medium tabular-nums">
                  {viewRange.start}–{viewRange.end}
                </span>
                <button
                  type="button"
                  onClick={() => moveView(viewRange.start + Math.max(1, Math.round((viewRange.end - viewRange.start) / 3)))}
                  className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white"
                  aria-label="Show later years"
                >
                  <ChevronRight size={15} />
                </button>
                <span className="ml-2 hidden text-[10px] tracking-wide uppercase sm:inline">Drag chart to pan</span>
              </div>

              <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
                {([10, 25, 50, "all"] as const).map((span) => {
                  const active = span === "all"
                    ? viewRange.start === firstYear && viewRange.end === lastYear
                    : viewRange.end - viewRange.start === span;
                  const fits = span === "all" || span <= lastYear - firstYear;
                  return (
                    <button
                      key={span}
                      type="button"
                      disabled={!fits}
                      onClick={() => setViewSpan(span)}
                      className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-30 ${
                        active
                          ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                          : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                      }`}
                      aria-pressed={active}
                    >
                      {span === "all" ? "All" : `${span}Y`}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="px-4 pt-1 sm:px-5">
              <LineChart
                series={series}
                selectedYear={selectedYear}
                visibleStart={viewRange.start}
                visibleEnd={viewRange.end}
                onPan={moveView}
              />
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 pb-1 text-[10px] text-slate-500 dark:text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden="true"><line x1="1" x2="21" y1="3" y2="3" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" /></svg>
                Observed
              </span>
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="12" aria-hidden="true">
                  <rect x="0" y="2" width="22" height="8" fill="currentColor" opacity="0.14" />
                  <line x1="1" x2="21" y1="2" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                  <line x1="1" x2="21" y1="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                </svg>
                Highest and lowest projection — {series.rangeNote}
              </span>
            </div>

            <div className="mt-3 border-t border-slate-200 px-5 py-4 dark:border-slate-800">
              <div className="mb-2 flex items-center justify-between text-[10px] font-medium text-slate-400">
                <span>{viewRange.start}</span>
                <span>Drag to inspect</span>
                <span>{viewRange.end}</span>
              </div>
              <label className="block">
                <span className="sr-only">Select year in the visible range</span>
                <input
                  type="range"
                  min={viewRange.start}
                  max={viewRange.end}
                  step={1}
                  value={selectedYear}
                  onChange={(event) => selectYear(Number(event.target.value))}
                  className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-slate-200 accent-slate-950 dark:bg-slate-800 dark:accent-white"
                />
              </label>
            </div>
          </section>
        </div>

        <div className="xl:sticky xl:top-6">
          <CompositionRail
            series={series}
            point={point}
            focus={focusCategory.id}
            onFocus={(category) => setFocus((current) => ({ ...current, [activeDimension]: category }))}
          />
        </div>
      </div>

      <section className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-200 pt-4 dark:border-slate-800">
        <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">Sources</span>
        {series.sources.map((source) => (
          <a
            key={source.href}
            href={source.href}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
          >
            {source.label}
            <ArrowUpRight size={11} />
          </a>
        ))}
      </section>
    </div>
  );
}

