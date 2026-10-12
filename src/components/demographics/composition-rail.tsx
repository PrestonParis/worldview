"use client";

import { MapPin } from "lucide-react";
import type { DemographicPoint, DemographicSeries } from "@/lib/demographics/forecast";
import type { YearProvenance } from "@/lib/demographics/provenance";
import { changeTone, formatPeople, formatPoints, formatRange, formatShare } from "./format";
import { InfoTip, StatusBadge } from "./status-badge";
import { isProjected } from "./trend-chart";

export function CompositionRail({
  series,
  point,
  baseline,
  focus,
  onFocus,
  provenance,
  compare,
  population,
}: {
  series: DemographicSeries;
  point: DemographicPoint;
  // The point changes are measured from; null hides the change line.
  baseline: DemographicPoint | null;
  focus: string;
  onFocus: (category: string) => void;
  provenance: YearProvenance;
  // The parent geography (U.S. for a state, the state for a city), same year.
  compare: { label: string; point: DemographicPoint | null } | null;
  // Residents or adults in this place and year, when known.
  population: number | null;
}) {
  const projected = isProjected(series, point);
  const showChange = baseline !== null && baseline.year < point.year;

  return (
    <aside className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950">
      <div className="border-b border-slate-200 pb-4 dark:border-slate-800">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-semibold tracking-[0.16em] text-slate-400 uppercase">Composition</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              {series.universe === "adults" ? "Adults 18+" : "All residents"}
              {population !== null ? ` · ${formatPeople(population)}` : ""}
            </p>
          </div>
          <p className="font-mono text-3xl font-semibold tracking-tight tabular-nums text-slate-950 dark:text-white">
            {point.year}
          </p>
        </div>
        <div className="mt-2">
          <StatusBadge provenance={provenance} align="right" />
        </div>
      </div>

      <div className="mt-2 divide-y divide-slate-100 dark:divide-slate-900">
        {series.categories.map((category) => {
          const value = point.values[category.id] ?? 0;
          const low = point.low?.[category.id] ?? value;
          const high = point.high?.[category.id] ?? value;
          const change = showChange ? value - (baseline.values[category.id] ?? 0) : 0;
          const parent = compare?.point?.values[category.id];
          const people = population !== null && !projected ? (value / 100) * population : null;
          const note = series.categoryNotes?.[category.id];
          const active = category.id === focus;
          return (
            // The whole row maps the group on click; the label button is the
            // keyboard path, and the info tip keeps its clicks to itself.
            <div
              key={category.id}
              onClick={(event) => {
                if (!(event.target as HTMLElement).closest("[aria-expanded]")) onFocus(category.id);
              }}
              className={`-mx-2 cursor-pointer rounded-lg px-2 py-3 transition-colors ${
                active ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
              }`}
            >
              <div className="flex items-start gap-2.5">
                <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="inline-flex min-w-0 items-center gap-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                      <button
                        type="button"
                        aria-pressed={active}
                        className="text-left hover:text-slate-950 hover:underline dark:hover:text-white"
                      >
                        {category.label}
                      </button>
                      {note ? (
                        <InfoTip label={`What “${category.label}” includes`} align="right">
                          {note}
                        </InfoTip>
                      ) : null}
                      {active ? <MapPin size={11} className="shrink-0 text-slate-400" aria-label="Shown on map" /> : null}
                    </span>
                    <span className="shrink-0 font-mono text-sm font-semibold tabular-nums text-slate-950 dark:text-white">
                      {projected ? formatRange(low, high) : formatShare(value)}
                    </span>
                  </div>
                  <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900">
                    {projected ? (
                      <>
                        <div
                          className="absolute inset-y-0 left-0 rounded-full opacity-30"
                          style={{ width: `${low}%`, backgroundColor: category.color }}
                        />
                        <div
                          className="absolute inset-y-0 rounded-full"
                          style={{ left: `${low}%`, width: `max(4px, ${high - low}%)`, backgroundColor: category.color }}
                        />
                      </>
                    ) : (
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${Math.max(1, value)}%`, backgroundColor: category.color }}
                      />
                    )}
                  </div>
                  <div className="mt-1.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 font-mono text-[10px] tabular-nums">
                    {showChange ? (
                      <span className={changeTone(change)}>
                        {formatPoints(change)} since {baseline.year}
                        {projected ? " (middle path)" : ""}
                      </span>
                    ) : (
                      <span />
                    )}
                    <span className="text-slate-400">
                      {people !== null ? `≈${formatPeople(people)}` : ""}
                      {people !== null && parent !== undefined ? " · " : ""}
                      {parent !== undefined && compare ? `${compare.label} ${formatShare(parent)}` : ""}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[10px] leading-4 text-slate-400">
        pp = percentage points. A share going from 10% to 12% is +2 pp (a 20% increase).
        {projected ? " Projected years show the scenario range." : ""} Select a group to map it.
      </p>
    </aside>
  );
}
