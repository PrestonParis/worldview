"use client";

import { useMemo, useState, type KeyboardEvent, type PointerEvent } from "react";
import { formatValue } from "@/lib/format";
import { niceTicks, useWidth } from "./use-width";

export interface SeriesPoint {
  x: number; // year, or year + month/12
  label: string; // "Aug 2026", "FY 2024"
  value: number;
}

// Categorical color slots, --viz-series-1 … --viz-series-9 in globals.css.
export type SeriesSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export interface Series {
  id: string;
  label: string;
  slot: SeriesSlot;
  color?: string; // overrides the slot, e.g. var(--viz-dem) for a party
  points: SeriesPoint[];
}

export interface Marker {
  x: number;
  label: string;
  to?: number; // shade the span from x to here (e.g. a policy period)
}

export interface Reference {
  value: number;
  label: string;
}

const M = { top: 28, right: 16, bottom: 28, left: 56 };

function axisLabel(unit?: string) {
  switch (unit) {
    case "percent": return "Percent";
    case "usd":
    case "usd_cents": return "U.S. dollars";
    case "cents": return "Cents";
    case "per_100k": return "Per 100,000";
    case "per_1000": return "Per 1,000";
    case "per_woman": return "Per woman";
    case "per_household": return "Per household";
    case "deg_f": return "Degrees Fahrenheit";
    case "tonnes_per_person": return "Tonnes per person";
    case "times": return "Ratio";
    case "index": return "Index";
    case "points": return "Points";
    case "years": return "Years";
    case "days": return "Days";
    default: return unit ? unit.replaceAll("_", " ") : "Value";
  }
}

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
  reference,
  fromZero = true,
  endLabels = true,
  xTickValues,
  gapOver,
}: {
  series: Series[];
  type?: "line" | "column";
  height?: number;
  unit?: string;
  markers?: Marker[];
  reference?: Reference; // dashed horizontal line, e.g. an index base of 100
  fromZero?: boolean; // false fits the y-axis to the data (lines only)
  endLabels?: boolean;
  xTickValues?: number[]; // fixed x-axis years (lines only), for unevenly spaced data
  gapOver?: number; // lines break where consecutive points are more than this many years apart
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
  const refValues = reference ? [reference.value] : [];
  const yMinRaw = fromZero || type === "column" ? Math.min(0, ...values) : Math.min(...values, ...refValues);
  const yMaxRaw = Math.max(...values, ...refValues);
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
  const shownYears = years.filter((_, i) => i % step === 0);
  if (years.length && shownYears.at(-1) !== years.at(-1)) {
    const lastYear = years.at(-1)!;
    if (shownYears.length && lastYear - shownYears.at(-1)! < step * 0.6) shownYears[shownYears.length - 1] = lastYear;
    else shownYears.push(lastYear);
  }
  const xTicks = xTickValues && type === "line"
    ? xTickValues
        .filter((year) => year >= x0 && year <= x1)
        .map((year) => ({ x: M.left + ((year - x0) / (x1 - x0 || 1)) * plotW, label: String(year) }))
    : shownYears.map((year) => ({
        x: xPos(xs.findIndex((point) => Math.floor(point.x) === year)),
        label: String(year),
      }));

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
  const color = (s: Series) => s.color ?? `var(--viz-series-${s.slot})`;

  return (
    <div ref={ref} className="relative">
      {series.length > 1 && (
        <div className="mb-3 flex flex-wrap items-start justify-between gap-x-4 gap-y-1">
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
            {series.map((s) => (
              <li key={s.id} className="flex items-center gap-1.5">
                {type === "line" ? (
                  <span className="h-0.5 w-3 rounded" style={{ background: color(s) }} />
                ) : (
                  <span className="size-2.5 rounded-sm" style={{ background: color(s) }} />
                )}
                <span>{s.label}</span>
                <span className="font-semibold tabular-nums text-slate-900 dark:text-white">
                  {format(s.points.at(-1)?.value ?? 0)}
                </span>
              </li>
            ))}
          </ul>
          <span className="text-[10px] text-slate-400">Latest · {xs.at(-1)!.label}</span>
        </div>
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
        <text x={M.left} y={12} className="fill-[var(--viz-muted)] text-[10px] font-medium">
          {axisLabel(unit)}
        </text>
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={M.left} x2={width - M.right} y1={yPos(t)} y2={yPos(t)} stroke={t === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={M.left - 8} y={yPos(t)} dy="0.32em" textAnchor="end" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
              {formatValue(t, unit, { compact: true })}
            </text>
          </g>
        ))}
        {xTicks.map(({ x, label }) => (
          <text key={label} x={x} y={height - 8} textAnchor="middle" className="fill-[var(--viz-muted)] text-[11px] tabular-nums">
            {label}
          </text>
        ))}
        {reference && (
          <g>
            <line
              x1={M.left}
              x2={width - M.right}
              y1={yPos(reference.value)}
              y2={yPos(reference.value)}
              stroke="var(--viz-muted)"
              strokeDasharray="4 3"
            />
            <text x={M.left + 4} y={yPos(reference.value) - 5} className="fill-[var(--viz-muted)] text-[11px]">
              {reference.label}
            </text>
          </g>
        )}
        {markers.map((mk, k) => {
          if (mk.x < x0 || mk.x > x1) return null;
          const markerX = M.left + ((mk.x - x0) / (x1 - x0 || 1)) * plotW;
          const markerEndX = mk.to === undefined
            ? markerX
            : M.left + ((Math.min(x1, mk.to) - x0) / (x1 - x0 || 1)) * plotW;
          // Labels step down in up to three rows (one per marker on narrow
          // charts) so neighbors don't collide, and flip to the left of the
          // line near the right edge.
          const flip = markerX > width - M.right - 110;
          return (
            <g key={`${mk.x}-${mk.label}`}>
              {markerEndX > markerX && (
                <rect
                  x={markerX}
                  y={M.top}
                  width={markerEndX - markerX}
                  height={plotH}
                  fill="var(--viz-muted)"
                  opacity={0.08}
                />
              )}
              <line x1={markerX} x2={markerX} y1={M.top} y2={M.top + plotH} stroke="var(--viz-axis)" />
              <text
                x={markerX + (flip ? -4 : 4)}
                y={M.top + 10 + (markers.length > 2 ? (k % (width < 640 ? markers.length : 3)) * 13 : 0)}
                textAnchor={flip ? "end" : "start"}
                className="fill-[var(--viz-muted)] text-[11px]"
              >
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
                if (v < 0 && !stacked) {
                  // Single-series negatives hang below zero, rounded at the data end.
                  const top = yPos(0);
                  const h = Math.max(0, yPos(v) - top);
                  const r = Math.min(4, barW / 2, h);
                  const left = xPos(i) - barW / 2;
                  const d = `M${left},${top} V${top + h - r} Q${left},${top + h} ${left + r},${top + h} H${left + barW - r} Q${left + barW},${top + h} ${left + barW},${top + h - r} V${top} Z`;
                  return <path key={s.id} d={d} fill={color(s)} opacity={hover === null || hover === i ? 1 : 0.55} />;
                }
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
              const d = pts.map(([px, py], i) => `${i && !(gapOver && s.points[i].x - s.points[i - 1].x > gapOver) ? "L" : "M"}${px},${py}`).join(" ");
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
