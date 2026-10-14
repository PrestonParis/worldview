"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { StatePath } from "@/lib/geo/state-paths";
import { formatValue } from "@/lib/format";

export interface StateMeasure {
  key: string;
  label: string;
  unit: string;
  period: string;
  source: string;
  href: string;
  values: Record<string, number | null>; // by state abbreviation
}

// Five quantile classes on the shared sequential scale (--viz-seq-1…7).
const STEPS = [1, 3, 4, 5, 7];
const fill = (step: number | null) => (step === null ? "var(--viz-empty)" : `var(--viz-seq-${STEPS[step]})`);
const ink = (step: number | null) => (step === null ? "var(--viz-muted)" : `var(--viz-seq-ink-${STEPS[step]})`);

function quantileBreaks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
}

// Homepage choropleth: one measure at a time across the 50 states and DC.
// Hover, focus, or tap a state for its value; the side list ranks the top five.
export function StateMap({ width, height, states, measures }: {
  width: number;
  height: number;
  states: StatePath[];
  measures: StateMeasure[];
}) {
  const [measureKey, setMeasureKey] = useState(measures[0]?.key);
  const [active, setActive] = useState<string | null>(null);
  const measure = measures.find((m) => m.key === measureKey) ?? measures[0];

  const { breaks, top } = useMemo(() => {
    const entries = Object.entries(measure?.values ?? {}).filter((e): e is [string, number] => e[1] !== null && Number.isFinite(e[1]));
    return {
      breaks: quantileBreaks(entries.map(([, v]) => v)),
      top: entries.sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [measure]);

  if (!measure) return null;
  const stepOf = (abbr: string) => {
    const v = measure.values[abbr];
    if (v === null || v === undefined) return null;
    const i = breaks.findIndex((b) => v <= b);
    return i === -1 ? breaks.length : i;
  };
  const nameOf = (abbr: string) => states.find((s) => s.abbr === abbr)?.name ?? abbr;
  const cur = active ? states.find((s) => s.abbr === active) : null;

  return (
    <figure className="min-w-0">
      <div role="tablist" aria-label="Map measure" className="flex flex-wrap gap-1.5">
        {measures.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={m.key === measure.key}
            onClick={() => setMeasureKey(m.key)}
            className={
              m.key === measure.key
                ? "rounded-full bg-slate-950 px-3 py-1.5 text-sm font-medium text-white dark:bg-white dark:text-slate-950"
                : "rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Map of ${measure.label.toLowerCase()} by state`} className="mt-5 block h-auto w-full">
        {states.map((s) => (
          <path
            key={s.abbr}
            d={s.d}
            tabIndex={0}
            aria-label={`${s.name}: ${formatValue(measure.values[s.abbr], measure.unit)}`}
            onPointerEnter={() => setActive(s.abbr)}
            onPointerLeave={() => setActive(null)}
            onFocus={() => setActive(s.abbr)}
            onBlur={() => setActive(null)}
            onClick={() => setActive(s.abbr)}
            style={{
              fill: fill(stepOf(s.abbr)),
              stroke: active === s.abbr ? "var(--viz-muted)" : "var(--viz-surface)",
              strokeWidth: active === s.abbr ? 2 : 1,
              outline: "none",
              transition: "fill 200ms",
            }}
          />
        ))}
        {states.map((s) =>
          s.label ? (
            <text
              key={s.abbr}
              x={s.label[0]}
              y={s.label[1]}
              textAnchor="middle"
              dominantBaseline="central"
              pointerEvents="none"
              className="text-[13px] font-medium"
              style={{ fill: ink(stepOf(s.abbr)) }}
            >
              {s.abbr}
            </text>
          ) : null,
        )}
      </svg>

      <div className="mt-4 grid gap-5 sm:grid-cols-[1fr_auto] sm:items-start">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-hidden>
            <span>{formatValue(Math.min(...Object.values(measure.values).filter((v): v is number => v !== null)), measure.unit, { compact: true })}</span>
            <span className="flex h-2.5 w-36 overflow-hidden rounded-sm">
              {STEPS.map((_, i) => <span key={i} className="flex-1" style={{ background: fill(i) }} />)}
            </span>
            <span>{formatValue(Math.max(...Object.values(measure.values).filter((v): v is number => v !== null)), measure.unit, { compact: true })}</span>
          </div>
          <p className="mt-3 min-h-6 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
            {cur ? (
              <><span className="font-semibold text-slate-950 dark:text-white">{cur.name}</span> · {formatValue(measure.values[cur.abbr], measure.unit)}</>
            ) : (
              <span className="text-slate-400">{measure.source} · {measure.period}</span>
            )}
          </p>
        </div>
        <div className="min-w-48">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Highest</p>
          <ol className="mt-1.5 space-y-1 text-sm">
            {top.map(([abbr, value], i) => (
              <li key={abbr} className="grid grid-cols-[1rem_1fr_auto] gap-2">
                <span className="text-slate-400 tabular-nums">{i + 1}</span>
                <span className="truncate text-slate-700 dark:text-slate-200">{nameOf(abbr)}</span>
                <span className="font-medium text-slate-950 tabular-nums dark:text-white">{formatValue(value, measure.unit, { compact: true })}</span>
              </li>
            ))}
          </ol>
          <Link href={measure.href} className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
            All states <ArrowRight size={14} aria-hidden />
          </Link>
        </div>
      </div>
    </figure>
  );
}
