"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight } from "lucide-react";
import type { StatePath } from "@/lib/geo/state-paths";
import { formatValue } from "@/lib/format";
import styles from "./state-map.module.css";

export interface StateMeasure {
  key: string;
  label: string; // short pill label
  description?: string; // one line on what is measured, shown above the map
  unit: string;
  period: string;
  source: string;
  href: string; // the full map of this measure
  stateLinks?: boolean; // href also takes &state= to open on one state
  values: Record<string, number | null>; // by state abbreviation
}

// Five quantile classes on the shared sequential scale (--viz-seq-1…7).
// Exported so the home intro's ghost map draws the same picture.
const STEPS = [1, 3, 4, 5, 7];
export const fill = (step: number | null) => (step === null ? "var(--viz-empty)" : `var(--viz-seq-${STEPS[step]})`);
export const ink = (step: number | null) => (step === null ? "var(--viz-muted)" : `var(--viz-seq-ink-${STEPS[step]})`);

export function quantileBreaks(values: number[]) {
  const sorted = [...values].sort((a, b) => a - b);
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
}

export function stepFor(value: number | null | undefined, breaks: number[]) {
  if (value === null || value === undefined) return null;
  const i = breaks.findIndex((b) => value <= b);
  return i === -1 ? breaks.length : i;
}

// Homepage choropleth: one measure at a time across the 50 states and DC.
// Hover, focus, or tap a state for its value (a click pins it); the side list
// ranks the top five. Measures with stateLinks link each state to the full map.
export function StateMap({ width, height, states, measures }: {
  width: number;
  height: number;
  states: StatePath[];
  measures: StateMeasure[];
}) {
  const [measureKey, setMeasureKey] = useState(measures[0]?.key);
  const [hovered, setHovered] = useState<string | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const active = hovered ?? pinned;
  const measure = measures.find((m) => m.key === measureKey) ?? measures[0];

  const { breaks, top } = useMemo(() => {
    const entries = Object.entries(measure?.values ?? {}).filter((e): e is [string, number] => e[1] !== null && Number.isFinite(e[1]));
    return {
      breaks: quantileBreaks(entries.map(([, v]) => v)),
      top: entries.sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [measure]);

  if (!measure) return null;
  const stepOf = (abbr: string) => stepFor(measure.values[abbr], breaks);
  const nameOf = (abbr: string) => states.find((s) => s.abbr === abbr)?.name ?? abbr;
  const cur = active ? states.find((s) => s.abbr === active) : null;
  const stateHref = (abbr: string) => `${measure.href}${measure.href.includes("?") ? "&" : "?"}state=${abbr}`;

  return (
    <figure className="min-w-0">
      {/* Phones scroll the pills sideways; wider screens center and wrap them. */}
      <div className="-mx-4 overflow-x-auto px-4 pb-1 sm:mx-0 sm:overflow-visible sm:px-0 sm:pb-0">
      <div role="tablist" aria-label="Map measure" className="mx-auto flex w-max items-center gap-2 sm:w-auto sm:flex-wrap sm:justify-center">
        {measures.map((m) => (
          <button
            key={m.key}
            type="button"
            role="tab"
            aria-selected={m.key === measure.key}
            onClick={() => setMeasureKey(m.key)}
            className={
              m.key === measure.key
                ? "shrink-0 whitespace-nowrap rounded-full border border-slate-950 bg-slate-950 px-3 py-1.5 text-sm font-medium text-white dark:border-white dark:bg-white dark:text-slate-950"
                : "shrink-0 whitespace-nowrap rounded-full border border-slate-300 px-3 py-1.5 text-sm text-slate-600 hover:border-slate-400 hover:text-slate-950 dark:border-slate-700 dark:text-slate-300 dark:hover:text-white"
            }
          >
            {m.label}
          </button>
        ))}
      </div>
      </div>

      <div className="mt-4 grid gap-5 md:grid-cols-[minmax(0,1fr)_12rem] md:items-start lg:grid-cols-[minmax(0,1fr)_13rem] lg:gap-6">
      <div className="min-w-0">
      <figcaption className="text-sm text-slate-500 dark:text-slate-400">
        <span className="font-semibold text-slate-950 dark:text-white">{measure.label}</span>
        {measure.description ? <> · {measure.description}</> : null}
      </figcaption>
      <div data-home-map-target className={`mt-3 min-w-0 ${styles.mapFrame}`}>
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={`Map of ${measure.label.toLowerCase()} by state`} className={`block h-auto w-full ${styles.mapPlane}`}>
        <g className={styles.depth} aria-hidden="true">
          {states.map((s) => <path key={s.abbr} d={s.d} style={{ fill: fill(stepOf(s.abbr)) }} />)}
        </g>
        {states.map((s) => (
          <path
            key={s.abbr}
            d={s.d}
            tabIndex={0}
            aria-label={`${s.name}: ${formatValue(measure.values[s.abbr], measure.unit)}`}
            onPointerEnter={() => setHovered(s.abbr)}
            onPointerLeave={() => setHovered(null)}
            onFocus={() => setHovered(s.abbr)}
            onBlur={() => setHovered(null)}
            onClick={() => setPinned((p) => (p === s.abbr ? null : s.abbr))}
            onKeyDown={(e) => {
              if (e.key === "Enter" && measure.stateLinks) window.location.assign(stateHref(s.abbr));
            }}
            className={`${styles.state} ${active === s.abbr ? styles.activeState : ""}`}
            style={{
              fill: fill(stepOf(s.abbr)),
              stroke: active === s.abbr ? "var(--viz-muted)" : "var(--viz-surface)",
              strokeWidth: active === s.abbr ? 2 : 1,
              outline: "none",
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

        <div className="mt-3 min-w-0">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400" aria-hidden>
            <span>{formatValue(Math.min(...Object.values(measure.values).filter((v): v is number => v !== null)), measure.unit, { compact: true })}</span>
            <span className="flex h-2.5 w-36 overflow-hidden rounded-sm">
              {STEPS.map((_, i) => <span key={i} className="flex-1" style={{ background: fill(i) }} />)}
            </span>
            <span>{formatValue(Math.max(...Object.values(measure.values).filter((v): v is number => v !== null)), measure.unit, { compact: true })}</span>
          </div>
          <p className="mt-3 line-clamp-2 min-h-10 text-sm text-slate-600 dark:text-slate-300" aria-live="polite">
            {cur ? (
              <>
                <span className="font-semibold text-slate-950 dark:text-white">{cur.name}</span> · {formatValue(measure.values[cur.abbr], measure.unit)}
                {measure.stateLinks && (
                  <Link href={stateHref(cur.abbr)} className="ml-2 inline-flex items-center gap-0.5 font-medium text-blue-700 hover:underline dark:text-blue-300">
                    Full map <ArrowRight size={13} aria-hidden />
                  </Link>
                )}
              </>
            ) : (
              <span className="text-slate-400">{measure.source} · {measure.period}</span>
            )}
          </p>
        </div>
      </div>
      </div>
        <div className="min-w-0 border-t border-slate-200 pt-4 md:border-l md:border-t-0 md:pl-5 md:pt-0 lg:pl-6 dark:border-slate-800">
          <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">Highest</p>
          <ol className="mt-1.5 space-y-1 text-sm">
            {top.map(([abbr, value], i) => (
              <li key={abbr} className="grid grid-cols-[1rem_minmax(0,1fr)_auto] gap-2">
                <span className="text-slate-400 tabular-nums">{i + 1}</span>
                <span className="text-slate-700 dark:text-slate-200">{nameOf(abbr)}</span>
                {measure.stateLinks ? (
                  <Link href={stateHref(abbr)} aria-label={`${nameOf(abbr)} on the full map`} className="inline-flex items-center gap-0.5 font-medium text-blue-700 tabular-nums hover:underline dark:text-blue-300">
                    {formatValue(value, measure.unit, { compact: true })} <ArrowRight size={12} aria-hidden />
                  </Link>
                ) : (
                  <span className="font-medium text-slate-950 tabular-nums dark:text-white">{formatValue(value, measure.unit, { compact: true })}</span>
                )}
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
