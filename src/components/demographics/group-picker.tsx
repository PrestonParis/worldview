"use client";

import type { DemographicPoint, DemographicSeries } from "@/lib/demographics/forecast";
import { changeTone, formatPeople, formatPoints, formatRange, formatShare } from "./format";
import { InfoTip } from "./status-badge";

// The groups in one dimension as chips (the chosen one is mapped), the
// whole composition as one stacked bar, and a line on the chosen group.
export function GroupPicker({
  series,
  point,
  baseline,
  focus,
  onFocus,
  compare,
  population,
  projected,
}: {
  series: DemographicSeries;
  point: DemographicPoint;
  // The point changes are measured from; null hides the change.
  baseline: DemographicPoint | null;
  focus: string;
  onFocus: (category: string) => void;
  // The parent geography (U.S. for a state, the state for a city), same year.
  compare: { label: string; point: DemographicPoint | null } | null;
  // Residents or adults in this place and year, when known.
  population: number | null;
  projected: boolean;
}) {
  const active = series.categories.find((category) => category.id === focus) ?? series.categories[0];
  const value = point.values[active.id] ?? 0;
  const low = point.low?.[active.id] ?? value;
  const high = point.high?.[active.id] ?? value;
  const change = baseline && baseline.year < point.year ? value - (baseline.values[active.id] ?? 0) : null;
  const parent = compare?.point?.values[active.id];
  const people = population !== null && !projected ? (value / 100) * population : null;
  const note = series.categoryNotes?.[active.id];
  const residents = series.universe === "adults" ? "adults" : "residents";

  return (
    <div className="order-1 space-y-3 border-b border-slate-200 px-5 py-3 lg:order-2 lg:border-b-0 lg:border-l lg:px-4 lg:py-4 dark:border-slate-800">
      <div role="group" aria-label="Group to map" className="flex flex-wrap gap-1.5 lg:flex-col">
        {series.categories.map((category) => {
          const selected = category.id === active.id;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => onFocus(category.id)}
              aria-pressed={selected}
              title={category.label}
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors lg:w-full lg:justify-between lg:rounded-lg lg:px-3 lg:py-2 ${
                selected
                  ? "border-slate-900 bg-slate-900 text-white dark:border-white dark:bg-white dark:text-slate-950"
                  : "border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-950 dark:border-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white"
              }`}
            >
              <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
              <span className="min-w-0 flex-1 truncate text-left">{category.short ?? category.label}</span>
              <span className="font-mono font-semibold tabular-nums">{formatShare(point.values[category.id] ?? 0)}</span>
            </button>
          );
        })}
      </div>

      <div className="flex h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-900" aria-hidden="true">
        {series.categories.map((category) => (
          <div
            key={category.id}
            onClick={() => onFocus(category.id)}
            title={`${category.label} ${formatShare(point.values[category.id] ?? 0)}`}
            className="h-full cursor-pointer transition-opacity"
            style={{
              width: `${point.values[category.id] ?? 0}%`,
              backgroundColor: category.color,
              opacity: category.id === active.id ? 1 : 0.3,
            }}
          />
        ))}
      </div>

      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-500 lg:block lg:space-y-1 dark:text-slate-400">
        <span className="inline-flex items-center gap-1 font-semibold text-slate-900 lg:flex dark:text-white">
          {active.label}
          {note ? (
            <InfoTip label={`What “${active.label}” includes`}>{note}</InfoTip>
          ) : null}
        </span>
        <span className="font-mono font-semibold tabular-nums text-slate-900 lg:block lg:text-lg dark:text-white">
          {projected ? formatRange(low, high) : formatShare(value)}
        </span>
        {change !== null && baseline ? (
          <span className={`font-mono tabular-nums lg:block ${changeTone(change)}`}>
            {formatPoints(change)} since {baseline.year}
            {projected ? " (middle path)" : ""}
          </span>
        ) : null}
        {parent !== undefined && compare ? (
          <span className="font-mono tabular-nums lg:block">{compare.label} {formatShare(parent)}</span>
        ) : null}
        {people !== null && population !== null ? (
          <span className="font-mono tabular-nums lg:block">
            ≈{formatPeople(people)} of {formatPeople(population)} {residents}
          </span>
        ) : null}
      </p>
    </div>
  );
}
