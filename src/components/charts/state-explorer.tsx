"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { US_STATE_GRID, US_STATE_GRID_COLS, US_STATE_GRID_ROWS } from "@/lib/money/us-states";
import { formatValue } from "@/lib/format";
import { useWidth } from "./use-width";

export interface StateMetric {
  key: string;
  label: string;
  unit: string;
  period: string; // shown under the map
  source: string;
}

export interface StateRow {
  abbr: string;
  name: string;
  values: Record<string, number | null>;
}

const STEPS = 7;

// Quantile breaks: immigration figures are heavily skewed (CA/TX/FL/NY), so
// equal-interval bins would paint 45 states the same color.
function quantileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: STEPS - 1 }, (_, i) => sorted[Math.floor(((i + 1) / STEPS) * (sorted.length - 1))]);
}

// Tile map of one metric (switchable) above a sortable table of all of them.
export function StateExplorer({ metrics, rows }: { metrics: StateMetric[]; rows: StateRow[] }) {
  const [active, setActive] = useState(metrics[0].key);
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 }>({ key: metrics[0].key, dir: -1 });
  const [hover, setHover] = useState<string | null>(null);
  const [ref, width] = useWidth<HTMLDivElement>();
  const metric = metrics.find((m) => m.key === active)!;

  const byAbbr = useMemo(() => new Map(rows.map((r) => [r.abbr, r])), [rows]);
  const present = rows.map((r) => r.values[active]).filter((v): v is number => v !== null && v !== undefined);
  const breaks = present.length ? quantileBreaks(present) : [];
  const step = (v: number) => breaks.filter((b) => v > b).length + 1;

  const gap = 3;
  const cell = Math.min(52, Math.floor((width - gap * (US_STATE_GRID_COLS - 1)) / US_STATE_GRID_COLS));
  const mapW = cell * US_STATE_GRID_COLS + gap * (US_STATE_GRID_COLS - 1);
  const mapH = cell * US_STATE_GRID_ROWS + gap * (US_STATE_GRID_ROWS - 1);
  const hovered = hover ? byAbbr.get(hover) : null;

  const sorted = [...rows].sort((a, b) => {
    if (sort.key === "name") return a.name.localeCompare(b.name) * sort.dir;
    const av = a.values[sort.key] ?? -Infinity;
    const bv = b.values[sort.key] ?? -Infinity;
    return (av - bv) * sort.dir;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Map metric">
        {metrics.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={m.key === active}
            onClick={() => setActive(m.key)}
            className={`rounded-full border px-3 py-1.5 text-sm ${
              m.key === active
                ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-900"
                : "border-slate-200 text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
            }`}
          >
            {m.label}
          </button>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div ref={ref} className="relative min-w-0">
          <svg width={mapW} height={mapH} role="img" aria-label={`${metric.label} by state`} className="block max-w-full">
            {US_STATE_GRID.map((c) => {
              const v = byAbbr.get(c.abbr)?.values[active];
              const s = v === null || v === undefined ? 0 : step(v);
              const x = c.col * (cell + gap);
              const y = c.row * (cell + gap);
              return (
                <g
                  key={c.abbr}
                  tabIndex={0}
                  onPointerEnter={() => setHover(c.abbr)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(c.abbr)}
                  onBlur={() => setHover(null)}
                  className="cursor-default outline-none"
                >
                  <rect
                    x={x}
                    y={y}
                    width={cell}
                    height={cell}
                    rx={4}
                    fill={s ? `var(--viz-seq-${s})` : "var(--viz-empty)"}
                    stroke={hover === c.abbr ? "var(--viz-muted)" : "none"}
                    strokeWidth={2}
                  />
                  <text
                    x={x + cell / 2}
                    y={y + cell / 2}
                    dy="0.35em"
                    textAnchor="middle"
                    className="text-[11px] font-semibold"
                    style={{ fill: s ? `var(--viz-seq-ink-${s})` : "var(--viz-muted)" }}
                  >
                    {c.abbr}
                  </text>
                </g>
              );
            })}
          </svg>
          {hovered && (
            <div className="pointer-events-none absolute top-0 right-0 rounded-lg border border-slate-200 bg-white/95 px-3 py-2 text-xs shadow-lg dark:border-slate-700 dark:bg-slate-900/95">
              <p className="font-medium text-slate-500 dark:text-slate-400">{hovered.name}</p>
              <p className="mt-0.5 text-base font-semibold text-slate-900 tabular-nums dark:text-white">
                {formatValue(hovered.values[active], metric.unit)}
              </p>
            </div>
          )}
        </div>
        <div className="space-y-3 text-sm">
          <p className="font-semibold text-slate-900 dark:text-white">{metric.label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {metric.period} · {metric.source}
          </p>
          {breaks.length > 0 && (
            <ul className="space-y-1 text-xs text-slate-600 dark:text-slate-300">
              {Array.from({ length: STEPS }, (_, i) => {
                const lo = i === 0 ? Math.min(...present) : breaks[i - 1];
                const hi = i === STEPS - 1 ? Math.max(...present) : breaks[i];
                return (
                  <li key={i} className="flex items-center gap-2">
                    <span className="size-3 rounded-sm" style={{ background: `var(--viz-seq-${i + 1})` }} />
                    <span className="tabular-nums">
                      {formatValue(lo, metric.unit, { compact: true })} – {formatValue(hi, metric.unit, { compact: true })}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
          <p className="text-xs text-slate-400">Shades split states into sevenths by rank.</p>
        </div>
      </div>

      <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[40rem] text-sm">
          <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {[{ key: "name", label: "State" }, ...metrics].map((col) => (
                <th key={col.key} className={`px-3 py-2 font-medium ${col.key === "name" ? "text-left" : "text-right"}`}>
                  <button
                    type="button"
                    onClick={() => setSort((s) => ({ key: col.key, dir: s.key === col.key ? ((-s.dir) as 1 | -1) : col.key === "name" ? 1 : -1 }))}
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    {col.label}
                    {sort.key === col.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                  {"period" in col && <span className="block font-normal text-slate-400">{col.period}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sorted.map((r) => (
              <tr key={r.abbr} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">{r.name}</td>
                {metrics.map((m) => (
                  <td key={m.key} className={`px-3 py-1.5 text-right tabular-nums ${m.key === active ? "font-medium text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>
                    {formatValue(r.values[m.key], m.unit)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
