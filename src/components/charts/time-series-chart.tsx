"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatValue } from "@/lib/format";
import { axisFormat, niceTicks, useWidth } from "./use-width";

export interface SeriesPoint {
  x: number; // year, or year + month/12
  label: string; // "Aug 2026", "FY 2024"
  value: number;
}

export interface Series {
  id: string;
  label: string;
  slot: 1 | 2 | 3;
  points: SeriesPoint[];
}

export interface Marker {
  x: number;
  label: string;
}

const M = { top: 16, right: 16, bottom: 28, left: 48 };

// Line or column chart over time, one shared y-axis, with a crosshair
// tooltip that lists every series at the hovered x. Columns stack when
// there is more than one series. Line series get one direct label at the
// end; ≥2 series also get a legend.
export function TimeSeriesChart({
  series,
  type = "line",
  height = 260,
  unit,
  markers = [],
  endLabels = true,
}: {
  series: Series[];
  type?: "line" | "column";
  height?: number;
  unit?: string;
  markers?: Marker[];
  endLabels?: boolean;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [hover, setHover] = useState<number | null>(null);
  const format = (v: number) => formatValue(v, unit);

  // Union of x positions across series, each with its label.
  const xs = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of series) for (const p of s.points) if (!m.has(p.x)) m.set(p.x, p.label);
    return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([x, label]) => ({ x, label }));
  }, [series]);
  const byX = useMemo(
    () => series.map((s) => new Map(s.points.map((p) => [p.x, p.value]))),
    [series],
  );

  if (!xs.length) return <p className="py-10 text-center text-sm text-slate-400">No data loaded yet.</p>;

  const stacked = type === "column" && series.length > 1;
  const totals = xs.map(({ x }) => byX.reduce((t, m) => t + (m.get(x) ?? 0), 0));
  const values = stacked ? totals : series.flatMap((s) => s.points.map((p) => p.value));
  const yMinRaw = Math.min(0, ...values);
  const yMaxRaw = Math.max(...values);
  const yTicks = niceTicks(yMinRaw, yMaxRaw);
  const [y0, y1] = [yTicks[0], yTicks.at(-1)!];

  const plotW = width - M.left - M.right;
  const plotH = height - M.top - M.bottom;
  const x0 = xs[0].x;
  const x1 = xs.at(-1)!.x;
  const band = plotW / xs.length;
  const xPos =
    type === "column"
      ? (i: number) => M.left + band * (i + 0.5)
      : (i: number) => M.left + (x1 === x0 ? plotW / 2 : ((xs[i].x - x0) / (x1 - x0)) * plotW);
  const yPos = (v: number) => M.top + ((y1 - v) / (y1 - y0)) * plotH;
  const xIndex = new Map(xs.map((p, i) => [p.x, i]));

  // ~6 x-axis labels on whole years.
  const years = [...new Set(xs.map((p) => Math.floor(p.x)))];
  const step = Math.max(1, Math.ceil(years.length / Math.max(2, Math.floor(plotW / 90))));
  const xTicks = years
    .filter((_, i) => i % step === 0)
    .map((y) => {
      const i = xs.findIndex((p) => Math.floor(p.x) === y);
      return { i, label: String(y) };
    });

  const nearest = (clientX: number, rect: DOMRect) => {
    const px = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < xs.length; i++) if (Math.abs(xPos(i) - px) < Math.abs(xPos(best) - px)) best = i;
    return best;
  };
  const onMove = (e: PointerEvent<SVGSVGElement>) => setHover(nearest(e.clientX, e.currentTarget.getBoundingClientRect()));
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key === "ArrowRight") setHover((h) => Math.min(xs.length - 1, (h ?? xs.length - 1) + 1));
    else if (e.key === "ArrowLeft") setHover((h) => Math.max(0, (h ?? xs.length - 1) - 1));
    else return;
    e.preventDefault();
  };

  const barW = Math.max(1, Math.min(24, band - 2));
  const color = (s: Series) => `var(--viz-series-${s.slot})`;

  return (
    <div ref={ref} className="relative">
      {series.length > 1 && (
        <ul className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
          {series.map((s) => (
            <li key={s.id} className="flex items-center gap-1.5">
              {type === "line" ? (
                <span className="h-0.5 w-3 rounded" style={{ background: color(s) }} />
              ) : (
                <span className="size-2.5 rounded-sm" style={{ background: color(s) }} />
              )}
              {s.label}
            </li>
          ))}
        </ul>
      )}
      <svg
        width={width}
        height={height}
        className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        role="img"
        aria-label={`${series.map((s) => s.label).join(", ")} from ${xs[0].label} to ${xs.at(-1)!.label}`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
        onFocus={() => setHover(xs.length - 1)}
        onBlur={() => setHover(null)}
        onKeyDown={onKey}
      >
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={yPos(t)} y2={yPos(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={M.left - 8} y={yPos(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
              {axisFormat(t)}
            </text>
          </g>
        ))}
        {xTicks.map(({ i, label }) => (
          <text key={label} x={xPos(i)} y={height - 8} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
            {label}
          </text>
        ))}
        {markers.map((mk) => {
          const i = xs.findIndex((p) => p.x >= mk.x);
          if (i < 0) return null;
          return (
            <g key={mk.label}>
              <line x1={xPos(i)} x2={xPos(i)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-axis)" />
              <text x={xPos(i) + 4} y={M.top + 10} className="fill-[var(--viz-muted)] text-[11px]">
                {mk.label}
              </text>
            </g>
          );
        })}

        {type === "column"
          ? xs.map(({ x }, i) => {
              let base = 0;
              return series.map((s, si) => {
                const v = byX[si].get(x) ?? 0;
                if (v <= 0) return null;
                const top = yPos(base + v);
                const bottom = yPos(base);
                base += v;
                const isTop = si === series.length - 1 || byX.slice(si + 1).every((m) => !(m.get(x) ?? 0));
                // 2px surface gap between stacked segments; 4px rounded data-end on the top segment only.
                const h = Math.max(0, bottom - top - (si > 0 ? 2 : 0));
                const r = isTop ? Math.min(4, barW / 2, h) : 0;
                const left = xPos(i) - barW / 2;
                const d = `M${left},${top + h} V${top + r} Q${left},${top} ${left + r},${top} H${left + barW - r} Q${left + barW},${top} ${left + barW},${top + r} V${top + h} Z`;
                return <path key={s.id} d={d} fill={color(s)} opacity={hover === null || hover === i ? 1 : 0.55} />;
              });
            })
          : series.map((s) => {
              const pts = s.points.map((p) => [xPos(xIndex.get(p.x)!), yPos(p.value)] as const);
              const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px},${py}`).join(" ");
              const last = s.points.at(-1)!;
              return (
                <g key={s.id}>
                  {series.length === 1 && (
                    <path d={`${d} L${pts.at(-1)![0]},${yPos(Math.max(0, y0))} L${pts[0][0]},${yPos(Math.max(0, y0))} Z`} fill={color(s)} opacity={0.1} />
                  )}
                  <path d={d} fill="none" stroke={color(s)} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
                  {endLabels && (
                    <circle cx={pts.at(-1)![0]} cy={pts.at(-1)![1]} r={4} fill={color(s)} stroke="var(--viz-surface)" strokeWidth={2} />
                  )}
                  {endLabels && hover === null && (
                    <text
                      x={pts.at(-1)![0] - 6}
                      y={pts.at(-1)![1] - 10}
                      textAnchor="end"
                      className="fill-slate-700 text-[11px] font-semibold tabular-nums dark:fill-slate-200"
                    >
                      {format(last.value)}
                    </text>
                  )}
                </g>
              );
            })}

        {hover !== null && (
          <g pointerEvents="none">
            <line x1={xPos(hover)} x2={xPos(hover)} y1={M.top} y2={M.top + plotH} stroke="var(--viz-muted)" strokeOpacity={0.5} />
            {type === "line" &&
              series.map((s, si) => {
                const v = byX[si].get(xs[hover].x);
                return v === undefined ? null : (
                  <circle key={s.id} cx={xPos(hover)} cy={yPos(v)} r={4} fill={color(s)} stroke="var(--viz-surface)" strokeWidth={2} />
                );
              })}
          </g>
        )}
      </svg>
      {hover !== null && (
        <div
          className="pointer-events-none absolute top-8 z-10 min-w-36 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={xPos(hover) > width / 2 ? { right: width - xPos(hover) + 12 } : { left: xPos(hover) + 12 }}
        >
          <p className="font-medium text-slate-500 dark:text-slate-400">{xs[hover].label}</p>
          {series.map((s, si) => {
            const v = byX[si].get(xs[hover].x);
            return (
              <p key={s.id} className="mt-1 flex items-center gap-2">
                <span className="h-0.5 w-3 shrink-0 rounded" style={{ background: color(s) }} />
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">{v === undefined ? "—" : format(v)}</span>
                {series.length > 1 && <span className="text-slate-500 dark:text-slate-400">{s.label}</span>}
              </p>
            );
          })}
          {stacked && (
            <p className="mt-1 border-t border-slate-100 pt-1 text-slate-500 dark:border-slate-800">
              Total <span className="font-semibold text-slate-900 tabular-nums dark:text-white">{format(totals[hover])}</span>
            </p>
          )}
        </div>
      )}
    </div>
  );
}
