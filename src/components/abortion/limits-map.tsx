"use client";

import { useState } from "react";
import type { StatePath } from "@/lib/geo/state-paths";

export interface LimitCategory {
  value: number;
  label: string;
  count: number;
}

export interface StateLimit {
  category: number;
  detail: string | null;
}

// Five ordered classes on one hue (--limit-1…5 in globals.css): a total ban
// is the most salient step, no gestational limit the least.
const fill = (c: number | undefined) => (c ? `var(--limit-${c})` : "var(--viz-empty)");
const ink = (c: number | undefined) => (c ? `var(--limit-ink-${c})` : "var(--viz-muted)");

// U.S. map of each state's gestational limit. Hover, focus, or tap a state for
// its law's wording; the legend counts states per category. With `onSelect`,
// clicking a state picks it and the picked state stays outlined.
export function LimitsMap({
  width,
  height,
  states,
  limits,
  categories,
  selected = null,
  onSelect,
  label: mapLabel = "Map of abortion gestational limits by state",
  hint = "Hover or tap a state for its law.",
}: {
  width: number;
  height: number;
  states: StatePath[];
  limits: Record<string, StateLimit>;
  categories: LimitCategory[];
  selected?: string | null;
  onSelect?: (abbr: string) => void;
  label?: string;
  hint?: string;
}) {
  const [hovered, setActive] = useState<string | null>(null);
  const [highlight, setHighlight] = useState<number | null>(null);
  const active = hovered ?? selected;
  const cur = active ? states.find((s) => s.abbr === active) : null;
  const curLimit = cur ? limits[cur.abbr] : null;
  const label = (c: number | undefined) => categories.find((x) => x.value === c)?.label ?? "No data";

  return (
    <figure className="min-w-0 space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <ul className="flex flex-wrap gap-x-4 gap-y-2 text-sm" aria-label="Legend">
        {categories.map((c) => (
          <li key={c.value}>
            <button
              type="button"
              onPointerEnter={() => setHighlight(c.value)}
              onPointerLeave={() => setHighlight(null)}
              onFocus={() => setHighlight(c.value)}
              onBlur={() => setHighlight(null)}
              className="flex items-center gap-2 text-slate-700 dark:text-slate-200"
            >
              <span className="size-3.5 rounded-sm ring-1 ring-slate-300 dark:ring-slate-700" style={{ background: fill(c.value) }} aria-hidden />
              {c.label}
              <span className="text-slate-400 tabular-nums">{c.count}</span>
            </button>
          </li>
        ))}
      </ul>

      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={mapLabel} className="block h-auto w-full text-slate-950 dark:text-white">
        {states.map((s) => {
          const c = limits[s.abbr]?.category;
          const dim = highlight !== null && c !== highlight;
          return (
            <path
              key={s.abbr}
              d={s.d}
              tabIndex={0}
              aria-label={`${s.name}: ${label(c)}`}
              onPointerEnter={() => setActive(s.abbr)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(s.abbr)}
              onBlur={() => setActive(null)}
              onClick={() => (onSelect ? onSelect(s.abbr) : setActive(s.abbr))}
              onKeyDown={(e) => {
                if (onSelect && (e.key === "Enter" || e.key === " ")) {
                  e.preventDefault();
                  onSelect(s.abbr);
                }
              }}
              style={{
                fill: fill(c),
                stroke: s.abbr === selected ? "currentColor" : active === s.abbr ? "var(--viz-muted)" : "var(--viz-surface)",
                strokeWidth: s.abbr === selected ? 2.5 : active === s.abbr ? 2 : 1,
                cursor: onSelect ? "pointer" : undefined,
                opacity: dim ? 0.25 : 1,
                outline: "none",
                transition: "opacity 120ms",
              }}
            />
          );
        })}
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
              style={{ fill: ink(limits[s.abbr]?.category), opacity: highlight !== null && limits[s.abbr]?.category !== highlight ? 0.3 : 1 }}
            >
              {s.abbr}
            </text>
          ) : null,
        )}
      </svg>

      <p className="min-h-12 text-sm leading-6 text-slate-600 dark:text-slate-300" aria-live="polite">
        {cur ? (
          <>
            <span className="font-semibold text-slate-950 dark:text-white">{cur.name}</span> · {label(curLimit?.category)}
            {curLimit?.detail && <span className="block text-slate-500 dark:text-slate-400">{curLimit.detail}.</span>}
          </>
        ) : (
          <span className="text-slate-400">{hint}</span>
        )}
      </p>
    </figure>
  );
}
