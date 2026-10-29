"use client";

import { useState } from "react";
import { axisFormat, niceTicks, useWidth } from "@/components/charts/use-width";
import { formatValue } from "@/lib/format";

export interface TrendLine {
  id: string;
  label: string;
  color: string;
  values: (number | null)[]; // aligned with `years`
}

const M = { top: 12, right: 12, bottom: 26, left: 44 };

// The Atlas's history chart. Each year is a click target that sets the Atlas
// year; the chosen year is marked, and partial-reporting years are shaded.
export function AtlasTrend({
  years,
  lines,
  unit,
  year,
  flagged,
  onYear,
  height = 220,
}: {
  years: string[];
  lines: TrendLine[];
  unit: string;
  year: string | null;
  flagged: Set<string>;
  onYear: (y: string) => void;
  height?: number;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const values = lines.flatMap((l) => l.values.filter((v): v is number => v !== null));
  if (!values.length) return <p className="py-10 text-center text-sm text-slate-400">No data for this selection.</p>;

  const ticks = niceTicks(Math.min(0, ...values), Math.max(...values));
  const [y0, y1] = [ticks[0], ticks.at(-1)!];
  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const band = plotW / years.length;
  const x = (i: number) => M.left + band * (i + 0.5);
  const y = (v: number) => M.top + ((y1 - v) / (y1 - y0)) * plotH;
  const sel = year ? years.indexOf(year) : -1;
  const shown = hover ?? sel;
  const labelEvery = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(plotW / 48))));

  const path = (vals: (number | null)[]) => {
    let d = "";
    let pen = false;
    vals.forEach((v, i) => {
      if (v === null) return void (pen = false);
      d += `${pen ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`;
      pen = true;
    });
    return d;
  };

  return (
    <div ref={ref} className="relative">
      <svg width={width} height={height} role="img" aria-label="Trend by year; select a year to update the map" className="block">
        {years.map((yr, i) =>
          flagged.has(yr) ? <rect key={`f-${yr}`} x={x(i) - band / 2} y={M.top} width={band} height={plotH} style={{ fill: "var(--viz-grid)", opacity: 0.6 }} /> : null,
        )}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={y(t)} y2={y(t)} style={{ stroke: "var(--viz-grid)" }} />
            <text x={M.left - 6} y={y(t)} textAnchor="end" dominantBaseline="central" className="text-[11px]" style={{ fill: "var(--viz-muted)" }}>
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {years.map((yr, i) =>
          i === sel || i === years.length - 1 || (i % labelEvery === 0 && Math.abs(i - (sel >= 0 ? sel : years.length - 1)) >= labelEvery && years.length - 1 - i >= labelEvery) ? (
            <text
              key={`t-${yr}`}
              x={x(i)}
              y={height - 8}
              textAnchor="middle"
              className={`text-[11px] ${i === sel ? "font-semibold" : ""}`}
              style={{ fill: i === sel ? "var(--foreground)" : "var(--viz-muted)" }}
            >
              {yr}
            </text>
          ) : null,
        )}
        {sel >= 0 && <line x1={x(sel)} x2={x(sel)} y1={M.top} y2={M.top + plotH} style={{ stroke: "var(--foreground)", strokeWidth: 1.5 }} />}
        {lines.map((l) => (
          <g key={l.id}>
            <path d={path(l.values)} fill="none" style={{ stroke: l.color, strokeWidth: 2.25, strokeLinejoin: "round", strokeLinecap: "round" }} />
            {shown >= 0 && l.values[shown] !== null && (
              <circle cx={x(shown)} cy={y(l.values[shown]!)} r={4} style={{ fill: l.color, stroke: "var(--viz-surface)", strokeWidth: 1.5 }} />
            )}
          </g>
        ))}
        {years.map((yr, i) => (
          <rect
            key={`hit-${yr}`}
            x={x(i) - band / 2}
            y={M.top}
            width={band}
            height={plotH + M.bottom}
            fill="transparent"
            className="cursor-pointer"
            onPointerEnter={() => setHover(i)}
            onPointerLeave={() => setHover(null)}
            onClick={() => onYear(yr)}
          >
            <title>{`${yr}${flagged.has(yr) ? " · partial reporting" : ""}`}</title>
          </rect>
        ))}
      </svg>
      {shown >= 0 && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs" aria-live="polite">
          <span className="font-semibold text-slate-900 dark:text-white">
            {years[shown]}
            {flagged.has(years[shown]) && <span className="font-normal text-slate-500"> · partial reporting</span>}
          </span>
          {lines.map((l) => (
            <span key={l.id} className="inline-flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
              <span className="inline-block h-0.5 w-3 rounded" style={{ background: l.color }} aria-hidden />
              {l.label} <span className="font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(l.values[shown], unit)}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
