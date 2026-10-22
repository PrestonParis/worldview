"use client";

import { useMemo, useState, type KeyboardEvent, type MouseEvent } from "react";
import { axisFormat, niceTicks, useWidth } from "@/components/charts/use-width";
import { formatValue } from "@/lib/format";
import { FIPS_TO_ABBR } from "@/lib/geo/states";
import { pairs, type CompareRow, type PairStats } from "./compare-stats";

export interface AxisSeries {
  label: string;
  unit: string | null;
  period: string | null;
}

export interface ScatterRow extends CompareRow {
  name: string;
  state: string | null;
}

const M = { top: 16, right: 20, bottom: 48, left: 64 };

interface Scale {
  pos: (v: number) => number;
  ticks: { value: number; at: number }[];
  min: number;
  max: number;
}

// Linear axes snap to round ticks; log axes span whole decades, with 2× and
// 5× ticks when there are only a couple of decades to show.
function makeScale(values: number[], log: boolean, start: number, end: number): Scale {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  if (log) {
    const d0 = Math.floor(Math.log10(lo));
    const d1 = Math.max(d0 + 1, Math.ceil(Math.log10(hi)));
    const steps = d1 - d0 <= 2 ? [1, 2, 5] : [1];
    const values: number[] = [];
    for (let d = d0; d <= d1; d++) for (const m of steps) if (m * 10 ** d <= 10 ** d1) values.push(m * 10 ** d);
    const pos = (v: number) => start + ((Math.log10(v) - d0) / (d1 - d0)) * (end - start);
    return { pos, ticks: values.map((value) => ({ value, at: pos(value) })), min: 10 ** d0, max: 10 ** d1 };
  }
  const ticks = niceTicks(lo, hi, 5);
  const [t0, t1] = [ticks[0], ticks.at(-1)!];
  const pos = (v: number) => start + ((v - t0) / (t1 - t0 || 1)) * (end - start);
  return { pos, ticks: ticks.map((value) => ({ value, at: pos(value) })), min: t0, max: t1 };
}

const axisTitle = (s: AxisSeries) => [s.label, s.period].filter(Boolean).join(", ");

interface Placed {
  geoid: string;
  text: string;
  x: number;
  y: number;
  anchor: "start" | "end" | "middle";
}

// Greedy label placement: highest-priority labels first, each tries right,
// left, above, then below its dot and is dropped if all four overlap a label
// already placed or leave the plot. 10px text is ~5.8px per character.
function placeLabels(
  candidates: { geoid: string; text: string; px: number; py: number }[],
  dotR: number,
  bounds: { left: number; right: number; top: number; bottom: number },
): Placed[] {
  const boxes: { x0: number; x1: number; y0: number; y1: number }[] = [];
  const out: Placed[] = [];
  for (const c of candidates) {
    const w = c.text.length * 5.8;
    const h = 11;
    const gap = dotR + 2;
    const options: Placed[] = [
      { geoid: c.geoid, text: c.text, x: c.px + gap, y: c.py, anchor: "start" },
      { geoid: c.geoid, text: c.text, x: c.px - gap, y: c.py, anchor: "end" },
      { geoid: c.geoid, text: c.text, x: c.px, y: c.py - gap - h / 2, anchor: "middle" },
      { geoid: c.geoid, text: c.text, x: c.px, y: c.py + gap + h / 2, anchor: "middle" },
    ];
    for (const o of options) {
      const x0 = o.anchor === "start" ? o.x : o.anchor === "end" ? o.x - w : o.x - w / 2;
      const box = { x0, x1: x0 + w, y0: o.y - h / 2, y1: o.y + h / 2 };
      if (box.x0 < bounds.left || box.x1 > bounds.right || box.y0 < bounds.top || box.y1 > bounds.bottom) continue;
      if (boxes.some((b) => b.x0 < box.x1 && box.x0 < b.x1 && b.y0 < box.y1 && box.y0 < b.y1)) continue;
      boxes.push(box);
      out.push(o);
      break;
    }
  }
  return out;
}

// Rank 1 = highest value among the plotted places.
function rankMap(points: { geoid: string; v: number }[]) {
  const sorted = [...points].sort((a, b) => b.v - a.v);
  return new Map(sorted.map((p, k) => [p.geoid, k + 1]));
}

export function CompareScatter({
  rows,
  xi,
  yi,
  x,
  y,
  stats,
  level,
  activeGeoid,
  onHover,
  onPick,
}: {
  rows: ScatterRow[];
  xi: number;
  yi: number;
  x: AxisSeries;
  y: AxisSeries;
  stats: PairStats;
  level: string;
  activeGeoid: string | null;
  onHover: (geoid: string | null) => void;
  onPick: (geoid: string) => void;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [logX, setLogX] = useState(false);
  const [logY, setLogY] = useState(false);
  const [focusIndex, setFocusIndex] = useState<number | null>(null);

  const byGeoid = useMemo(() => new Map(rows.map((r) => [r.geoid, r])), [rows]);
  const points = useMemo(() => pairs(rows, xi, yi).sort((a, b) => a.x - b.x), [rows, xi, yi]);
  const canLogX = points.length > 0 && points.every((p) => p.x > 0);
  const canLogY = points.length > 0 && points.every((p) => p.y > 0);
  const useLogX = logX && canLogX;
  const useLogY = logY && canLogY;
  const xRanks = useMemo(() => rankMap(points.map((p) => ({ geoid: p.geoid, v: p.x }))), [points]);
  const yRanks = useMemo(() => rankMap(points.map((p) => ({ geoid: p.geoid, v: p.y }))), [points]);

  const height = Math.round(Math.min(460, Math.max(300, width * 0.62)));
  const plotR = width - M.right;
  const plotB = height - M.bottom;

  const sx = useMemo(
    () => (points.length ? makeScale(points.map((p) => p.x), useLogX, M.left, plotR) : null),
    [points, useLogX, plotR],
  );
  const sy = useMemo(
    () => (points.length ? makeScale(points.map((p) => p.y), useLogY, plotB, M.top) : null),
    [points, useLogY, plotB],
  );

  const placed = useMemo(
    () => (sx && sy ? points.map((p) => ({ ...p, px: sx.pos(p.x), py: sy.pos(p.y) })) : []),
    [points, sx, sy],
  );

  const county = level !== "state";
  const dotR = county ? (placed.length > 1500 ? 2.25 : 3) : 4.5;
  const shortName = (geoid: string) => {
    if (!county) return FIPS_TO_ABBR[geoid] ?? byGeoid.get(geoid)?.name ?? geoid;
    const row = byGeoid.get(geoid);
    return row ? `${row.name.replace(/ (County|Parish|Borough|Census Area|Municipality)$/, "")}${row.state ? `, ${row.state}` : ""}` : geoid;
  };

  // Labels: states by postal code, counties only the 8 farthest off the
  // trend. Outliers claim space first, so crowded labels near the line are
  // the ones that drop.
  const labels = useMemo(() => {
    const off = (g: string) => Math.abs(stats.residuals.get(g) ?? 0);
    const ranked = [...placed].sort((a, b) => off(b.geoid) - off(a.geoid));
    const chosen = county ? ranked.slice(0, 8) : ranked;
    return placeLabels(
      chosen.map((p) => ({ geoid: p.geoid, text: shortName(p.geoid), px: p.px, py: p.py })),
      dotR,
      { left: M.left, right: plotR, top: M.top, bottom: plotB },
    );
    // shortName only reads byGeoid and county.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placed, county, stats.residuals, dotR, byGeoid, plotR, plotB]);

  // The fitted line, sampled so it stays correct on log axes.
  const trend = useMemo(() => {
    if (!stats.fit || !sx || !sy || placed.length < 3) return null;
    const x0 = points[0].x;
    const x1 = points.at(-1)!.x;
    const segs: string[] = [];
    for (let k = 0; k <= 48; k++) {
      const xv = useLogX ? x0 * (x1 / x0) ** (k / 48) : x0 + ((x1 - x0) * k) / 48;
      const yv = stats.fit.predict(xv);
      if (yv < sy.min || yv > sy.max || (useLogY && yv <= 0)) continue;
      segs.push(`${segs.length ? "L" : "M"}${sx.pos(xv).toFixed(1)},${sy.pos(yv).toFixed(1)}`);
    }
    return segs.length > 1 ? segs.join(" ") : null;
  }, [stats.fit, sx, sy, placed.length, points, useLogX, useLogY]);

  if (!sx || !sy || points.length < 3) {
    return (
      // Same root element as the plot below, so useWidth keeps observing it.
      <div ref={ref} className="relative">
        <p className="py-16 text-center text-sm text-slate-500">
          {points.length} place{points.length === 1 ? " has" : "s have"} values for both metrics. A plot needs at least 3.
        </p>
      </div>
    );
  }

  const nearest = (e: MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    let best: string | null = null;
    let bestD = 24 * 24;
    for (const p of placed) {
      const d = (p.px - mx) ** 2 + (p.py - my) ** 2;
      if (d < bestD) {
        bestD = d;
        best = p.geoid;
      }
    }
    return best;
  };
  const onKey = (e: KeyboardEvent<SVGSVGElement>) => {
    if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
    e.preventDefault();
    const next =
      e.key === "ArrowRight"
        ? Math.min(placed.length - 1, (focusIndex ?? -1) + 1)
        : Math.max(0, (focusIndex ?? placed.length) - 1);
    setFocusIndex(next);
    onHover(placed[next].geoid);
  };

  const active = activeGeoid ? placed.find((p) => p.geoid === activeGeoid) : undefined;
  const activeRow = active ? byGeoid.get(active.geoid) : undefined;
  return (
    <div ref={ref} className="relative">
      <svg
        width={width}
        height={height}
        role="img"
        aria-label={`Scatter plot of ${axisTitle(y)} against ${axisTitle(x)} for ${points.length} places`}
        tabIndex={0}
        className="block touch-none outline-none focus-visible:ring-2 focus-visible:ring-sky-500"
        onPointerMove={(e) => onHover(nearest(e))}
        onPointerLeave={() => onHover(null)}
        onClick={(e) => {
          const g = nearest(e);
          if (g) onPick(g);
        }}
        onBlur={() => {
          setFocusIndex(null);
          onHover(null);
        }}
        onKeyDown={onKey}
      >
        {sy.ticks.map((t) => (
          <g key={`y${t.value}`}>
            <line x1={M.left} x2={plotR} y1={t.at} y2={t.at} stroke={t.value === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={M.left - 8} y={t.at} dy="0.32em" textAnchor="end" className="fill-(--viz-muted) text-[11px] tabular-nums">
              {axisFormat(t.value)}
            </text>
          </g>
        ))}
        {sx.ticks.map((t) => (
          <g key={`x${t.value}`}>
            <line x1={t.at} x2={t.at} y1={M.top} y2={plotB} stroke={t.value === 0 ? "var(--viz-axis)" : "var(--viz-grid)"} />
            <text x={t.at} y={plotB + 16} textAnchor="middle" className="fill-(--viz-muted) text-[11px] tabular-nums">
              {axisFormat(t.value)}
            </text>
          </g>
        ))}
        <line x1={M.left} x2={plotR} y1={plotB} y2={plotB} stroke="var(--viz-axis)" />
        <text x={(M.left + plotR) / 2} y={height - 6} textAnchor="middle" className="fill-slate-700 text-xs font-medium dark:fill-slate-300">
          {axisTitle(x)} →
        </text>
        <text
          transform={`translate(14 ${(M.top + plotB) / 2}) rotate(-90)`}
          textAnchor="middle"
          className="fill-slate-700 text-xs font-medium dark:fill-slate-300"
        >
          {axisTitle(y)} →
        </text>

        {trend && <path d={trend} fill="none" stroke="var(--viz-series-2)" strokeWidth={2} strokeLinecap="round" opacity={0.9} />}

        <g opacity={active ? 0.45 : 1}>
          {placed.map((p) => (
            <circle
              key={p.geoid}
              cx={p.px}
              cy={p.py}
              r={dotR}
              fill="var(--viz-series-1)"
              fillOpacity={county ? 0.45 : 0.75}
              stroke={county ? "none" : "var(--viz-surface)"}
              strokeWidth={1}
            />
          ))}
        </g>
        {labels.map((l) =>
          l.geoid !== active?.geoid ? (
            <text
              key={`l${l.geoid}`}
              x={l.x}
              y={l.y}
              dy="0.32em"
              textAnchor={l.anchor}
              className="pointer-events-none fill-slate-600 text-[10px] font-medium dark:fill-slate-300"
              opacity={active ? 0.4 : 1}
              paintOrder="stroke"
              stroke="var(--viz-surface)"
              strokeWidth={3}
            >
              {l.text}
            </text>
          ) : null,
        )}
        {active && (
          <g className="pointer-events-none">
            <circle cx={active.px} cy={active.py} r={dotR + 4} fill="none" stroke="currentColor" strokeWidth={1.5} className="text-slate-900 dark:text-white" />
            <circle cx={active.px} cy={active.py} r={dotR + 0.5} fill="var(--viz-series-1)" />
            <text
              x={active.px + dotR + 7}
              y={active.py}
              dy="0.32em"
              className="fill-slate-950 text-[11px] font-semibold dark:fill-white"
              paintOrder="stroke"
              stroke="var(--viz-surface)"
              strokeWidth={3}
            >
              {shortName(active.geoid)}
            </text>
          </g>
        )}
      </svg>

      {active && activeRow && (
        <div
          className="pointer-events-none absolute z-10 w-56 rounded-xl border border-slate-200 bg-white/95 p-3 text-xs shadow-lg backdrop-blur dark:border-slate-700 dark:bg-slate-900/95"
          style={{
            left: active.px > width - 250 ? active.px - 236 : active.px + 16,
            top: Math.min(Math.max(4, active.py - 48), height - 130),
          }}
        >
          <div className="font-semibold text-slate-950 dark:text-white">
            {activeRow.name}
            {county && activeRow.state ? `, ${activeRow.state}` : ""}
          </div>
          <dl className="mt-2 space-y-1.5">
            {[
              { s: x, v: active.x, rank: xRanks.get(active.geoid) },
              { s: y, v: active.y, rank: yRanks.get(active.geoid) },
            ].map(({ s, v, rank }) => (
              <div key={s.label}>
                <dt className="truncate text-slate-500">{s.label}</dt>
                <dd className="flex justify-between gap-2 font-medium text-slate-900 tabular-nums dark:text-slate-100">
                  <span>{formatValue(v, s.unit ?? undefined)}</span>
                  <span className="text-slate-400">
                    #{rank} of {points.length}
                  </span>
                </dd>
              </div>
            ))}
            {stats.residuals.has(active.geoid) && (
              <div className="border-t border-slate-100 pt-1.5 text-slate-500 dark:border-slate-800">
                {stats.residuals.get(active.geoid)! >= 0 ? "Above" : "Below"} the trend by{" "}
                <span className="font-medium text-slate-900 tabular-nums dark:text-slate-100">
                  {formatValue(Math.abs(stats.residuals.get(active.geoid)!), y.unit ?? undefined)}
                </span>
              </div>
            )}
          </dl>
        </div>
      )}

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
        <span>
          {points.length.toLocaleString("en-US")} places with both values
          {county ? " · labels mark the places farthest from the trend" : ""}
        </span>
        <span className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="h-0.5 w-4 rounded" style={{ background: "var(--viz-series-2)" }} />
            Trend line
          </span>
          {[
            { label: "Log X", on: useLogX, can: canLogX, set: setLogX },
            { label: "Log Y", on: useLogY, can: canLogY, set: setLogY },
          ].map((t) => (
            <label
              key={t.label}
              className={`flex items-center gap-1 ${t.can ? "cursor-pointer" : "cursor-not-allowed opacity-40"}`}
              title={t.can ? undefined : "Log scale needs every value above zero"}
            >
              <input type="checkbox" checked={t.on} disabled={!t.can} onChange={(e) => t.set(e.target.checked)} />
              {t.label}
            </label>
          ))}
        </span>
      </div>
    </div>
  );
}
