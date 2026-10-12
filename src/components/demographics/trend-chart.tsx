"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import type { DemographicPoint, DemographicSeries } from "@/lib/demographics/forecast";

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

function yMaximum(series: DemographicSeries, extra: number[]): number {
  const maximum = Math.max(
    ...extra,
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

export const isProjected = (series: DemographicSeries, point: DemographicPoint) =>
  point.year > series.observedThrough && point.low !== undefined && point.high !== undefined;

export interface CompareLine {
  label: string;
  points: DemographicPoint[];
}

export function TrendChart({
  series,
  focus,
  selectedYear,
  visibleStart,
  visibleEnd,
  onPan,
  onSelectYear,
  compare,
  published,
  pastModeled,
}: {
  series: DemographicSeries;
  focus: string;
  selectedYear: number;
  visibleStart: number;
  visibleEnd: number;
  onPan: (start: number) => void;
  onSelectYear: (year: number) => void;
  compare: CompareLine | null;
  // Years with a published survey figure (dots); null when every past year is.
  published: number[] | null;
  // Every past value is a Worldview model (drawn dotted).
  pastModeled: boolean;
}) {
  const ticks = yearTicks(visibleStart, visibleEnd);
  const forecastStart = Math.max(visibleStart, series.observedThrough);
  const forecastX = xFor(forecastStart, visibleStart, visibleEnd);
  const selectedX = xFor(selectedYear, visibleStart, visibleEnd);
  const comparePoints = (compare?.points ?? []).filter(
    (point) => point.year >= visibleStart && point.year <= visibleEnd && point.values[focus] !== undefined,
  );
  const maximum = yMaximum(series, comparePoints.map((point) => point.values[focus]));
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
  const focusCategory = series.categories.find((category) => category.id === focus);
  const drag = useRef<{ pointerId: number; clientX: number; start: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);
  // Others first so the focused group draws on top.
  const ordered = [
    ...series.categories.filter((category) => category.id !== focus),
    ...(focusCategory ? [focusCategory] : []),
  ];

  const yearAt = (event: ReactPointerEvent<SVGSVGElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    const x = ((event.clientX - box.left) / box.width) * CHART_WIDTH;
    const year = visibleStart + ((x - MARGIN.left) / PLOT_WIDTH) * (visibleEnd - visibleStart);
    return Math.min(visibleEnd, Math.max(visibleStart, Math.round(year)));
  };

  const beginDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { pointerId: event.pointerId, clientX: event.clientX, start: visibleStart, moved: false };
  };

  const continueDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (!drag.current || drag.current.pointerId !== event.pointerId) return;
    if (!drag.current.moved && Math.abs(event.clientX - drag.current.clientX) < 5) return;
    drag.current.moved = true;
    setDragging(true);
    const pixelWidth = event.currentTarget.getBoundingClientRect().width * (PLOT_WIDTH / CHART_WIDTH);
    const delta = Math.round(
      ((drag.current.clientX - event.clientX) / pixelWidth) * (visibleEnd - visibleStart),
    );
    onPan(drag.current.start + delta);
  };

  const endDrag = (event: ReactPointerEvent<SVGSVGElement>) => {
    if (drag.current?.pointerId !== event.pointerId) return;
    // A press without a drag picks the year under the pointer.
    if (!drag.current.moved && event.type === "pointerup") onSelectYear(yearAt(event));
    drag.current = null;
    setDragging(false);
  };

  return (
    <svg
      viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
      role="img"
      aria-label={`${series.label} percentage lines from ${visibleStart} to ${visibleEnd}, with projection ranges after ${series.observedThrough}`}
      className={`block h-auto w-full select-none ${dragging ? "cursor-grabbing" : "cursor-crosshair"}`}
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
          fill="#6366f1"
          opacity="0.06"
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
        ? ordered.map((category) => (
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
              fillOpacity={category.id === focus ? 0.2 : 0.06}
              stroke="none"
            />
          ))
        : null}

      {comparePoints.length > 1 ? (
        <path
          d={pathThrough(comparePoints, (point) => point.values[focus] ?? 0, maximum, visibleStart, visibleEnd)}
          fill="none"
          stroke="#64748b"
          strokeWidth="1.75"
          strokeDasharray="1 4"
          strokeLinecap="round"
        />
      ) : null}

      {ordered.map((category) => {
        const active = category.id === focus;
        return (
          <g key={category.id} opacity={active ? 1 : 0.4}>
            {observedPoints.length > 1 ? (
              <path
                d={pathThrough(observedPoints, (point) => point.values[category.id] ?? 0, maximum, visibleStart, visibleEnd)}
                fill="none"
                stroke={category.color}
                strokeWidth={active ? 3 : 1.75}
                strokeDasharray={pastModeled ? "2 5" : undefined}
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
                    strokeWidth={active ? 2 : 1.25}
                    strokeDasharray="7 6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                ))
              : null}
            {active && published
              ? observedPoints
                  .filter((point) => published.includes(point.year))
                  .map((point) => (
                    <circle
                      key={point.year}
                      cx={xFor(point.year, visibleStart, visibleEnd)}
                      cy={yFor(point.values[category.id] ?? 0, maximum)}
                      r="3.5"
                      fill={category.color}
                    />
                  ))
              : null}
          </g>
        );
      })}

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
            x={Math.min(forecastX + 8, CHART_WIDTH - 84)}
            y={MARGIN.top + 15}
            fill="#818cf8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.3"
          >
            PROJECTED
          </text>
          <text
            x={forecastX - 8}
            y={MARGIN.top + 15}
            textAnchor="end"
            fill="#94a3b8"
            fontSize="10"
            fontWeight="700"
            letterSpacing="1.3"
          >
            {pastModeled ? "MODELED" : "ESTIMATED"}
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
          {focusCategory
            ? (selectedProjected
                ? [selectedPoint.low?.[focus] ?? 0, selectedPoint.high?.[focus] ?? 0]
                : [selectedPoint.values[focus] ?? 0]
              ).map((value, index) => (
                <circle
                  key={index}
                  cx={selectedX}
                  cy={yFor(value, maximum)}
                  r="4.5"
                  fill={focusCategory.color}
                  stroke="#0f172a"
                  strokeWidth="1.5"
                />
              ))
            : null}
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
