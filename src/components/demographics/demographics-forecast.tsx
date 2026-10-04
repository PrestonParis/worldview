"use client";

import { useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { ArrowUpRight, CalendarRange, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import {
  demographicSeries,
  type DemographicCategory,
  type DemographicDimensionId,
  type DemographicPoint,
  type DemographicSeries,
} from "@/lib/demographics/forecast";

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

function linePath(
  category: DemographicCategory,
  points: DemographicPoint[],
  maximum: number,
  visibleStart: number,
  visibleEnd: number,
): string {
  return points
    .map((point, index) => {
      const x = xFor(point.year, visibleStart, visibleEnd);
      const y = yFor(point.values[category.id] ?? 0, maximum);
      return `${index === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");
}

function yMaximum(series: DemographicSeries): number {
  const maximum = Math.max(
    ...series.points.flatMap((point) =>
      series.categories.map((category) => point.values[category.id] ?? 0),
    ),
  );
  return Math.min(100, Math.max(10, Math.ceil(maximum / 10) * 10));
}

function yearTicks(start: number, end: number): number[] {
  const span = end - start;
  const step = span <= 12 ? 2 : span <= 30 ? 5 : span <= 60 ? 10 : 50;
  const ticks = [start];
  for (let year = Math.ceil(start / step) * step; year < end; year += step) ticks.push(year);
  ticks.push(end);
  return [...new Set(ticks)];
}

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
  const forecastPoints = visiblePoints.filter((point) => point.year >= series.observedThrough);
  const selectedPoint = series.points.find((point) => point.year === selectedYear) ?? series.points[0];
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
      aria-label={`${series.label} percentage lines from ${visibleStart} to ${visibleEnd}`}
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

      {series.categories.map((category) => (
        <g key={category.id}>
          {observedPoints.length > 1 ? (
            <path
              d={linePath(category, observedPoints, maximum, visibleStart, visibleEnd)}
              fill="none"
              stroke={category.color}
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
          {forecastPoints.length > 1 ? (
            <path
              d={linePath(category, forecastPoints, maximum, visibleStart, visibleEnd)}
              fill="none"
              stroke={category.color}
              strokeWidth="2.5"
              strokeDasharray="7 6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ) : null}
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
            fill="#e2e8f0"
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
            stroke="#f8fafc"
            strokeOpacity="0.9"
            strokeWidth="1.5"
          />
          {series.categories.map((category) => (
            <circle
              key={category.id}
              cx={selectedX}
              cy={yFor(selectedPoint.values[category.id] ?? 0, maximum)}
              r="4"
              fill={category.color}
              stroke="#0f172a"
              strokeWidth="1.5"
            />
          ))}
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

function CompositionRail({ series, point }: { series: DemographicSeries; point: DemographicPoint }) {
  const baseline = series.points[0];

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="flex items-end justify-between border-b border-slate-200 pb-4 dark:border-slate-800">
        <div>
          <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Composition</p>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{point.year} estimate</p>
        </div>
        <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
          {point.year}
        </p>
      </div>

      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-900">
        {series.categories.map((category) => {
          const value = point.values[category.id];
          const change = value - baseline.values[category.id];
          return (
            <div key={category.id} className="py-3">
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-xs leading-5 text-slate-600 dark:text-slate-300">{category.label}</span>
                    <span className="font-mono text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
                      {value.toFixed(1)}%
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <div className="h-1 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(1, value)}%`, backgroundColor: category.color }}
                      />
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
            </div>
          );
        })}
      </div>
      <p className="mt-2 text-[10px] text-slate-400">Change in percentage points from {baseline.year}</p>
    </aside>
  );
}

interface ViewRange {
  start: number;
  end: number;
}

function rangeAround(series: DemographicSeries, center: number, span: number): ViewRange {
  const first = series.points[0].year;
  const last = series.points.at(-1)?.year ?? first;
  const boundedSpan = Math.min(span, last - first);
  const start = Math.min(last - boundedSpan, Math.max(first, Math.round(center - boundedSpan / 2)));
  return { start, end: start + boundedSpan };
}

function initialViewRanges(): Record<DemographicDimensionId, ViewRange> {
  return Object.fromEntries(
    demographicSeries.map((item) => [item.id, rangeAround(item, 2026, 25)]),
  ) as Record<DemographicDimensionId, ViewRange>;
}

export function DemographicsForecast() {
  const [dimension, setDimension] = useState<DemographicDimensionId>("race");
  const series = demographicSeries.find((item) => item.id === dimension) ?? demographicSeries[0];
  const firstYear = series.points[0].year;
  const [years, setYears] = useState<Record<DemographicDimensionId, number>>({
    sex: 2026,
    race: 2026,
    orientation: 2026,
    religion: 2026,
  });
  const [viewRanges, setViewRanges] = useState<Record<DemographicDimensionId, ViewRange>>(
    initialViewRanges,
  );
  const selectedYear = Math.min(2050, Math.max(firstYear, years[dimension]));
  const viewRange = viewRanges[dimension];
  const point = useMemo(
    () => series.points.find((item) => item.year === selectedYear) ?? series.points[0],
    [selectedYear, series],
  );

  const moveView = (nextStart: number) => {
    const first = series.points[0].year;
    const last = series.points.at(-1)?.year ?? first;
    const span = viewRange.end - viewRange.start;
    const start = Math.min(last - span, Math.max(first, nextStart));
    const end = start + span;
    setViewRanges((current) => ({ ...current, [dimension]: { start, end } }));
    if (selectedYear < start || selectedYear > end) {
      setYears((current) => ({
        ...current,
        [dimension]: Math.min(end, Math.max(start, selectedYear)),
      }));
    }
  };

  const setViewSpan = (span: number | "all") => {
    const first = series.points[0].year;
    const last = series.points.at(-1)?.year ?? first;
    const next = span === "all" ? { start: first, end: last } : rangeAround(series, selectedYear, span);
    setViewRanges((current) => ({ ...current, [dimension]: next }));
  };

  const selectYear = (year: number) => {
    setYears((current) => ({ ...current, [dimension]: year }));
    if (year < viewRange.start || year > viewRange.end) {
      const span = viewRange.end - viewRange.start;
      setViewRanges((current) => ({ ...current, [dimension]: rangeAround(series, year, span) }));
    }
  };

  return (
    <div className="space-y-5">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950">
        <div className="flex min-w-0 flex-wrap gap-1">
          {demographicSeries.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setDimension(item.id)}
              className={`rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
                dimension === item.id
                  ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 px-2 text-xs text-slate-500 dark:text-slate-400">
          <span className="inline-flex items-center gap-1.5"><MapPin size={14} /> United States</span>
          <span className="inline-flex items-center gap-1.5"><CalendarRange size={14} /> Through 2050</span>
        </div>
      </section>

      <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_310px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">{series.label}</h2>
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
              </p>
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
                  ? viewRange.start === firstYear && viewRange.end === 2050
                  : viewRange.end - viewRange.start === span;
                return (
                  <button
                    key={span}
                    type="button"
                    onClick={() => setViewSpan(span)}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors ${
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

          <div className="border-t border-slate-200 px-5 py-4 dark:border-slate-800">
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

        <CompositionRail series={series} point={point} />
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
