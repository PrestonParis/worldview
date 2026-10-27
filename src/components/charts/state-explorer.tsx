"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { DemographicsMap, NEGATIVE_COLOR, divergingExtent, valueExtent } from "@/components/demographics/demographics-map";
import { FIPS_TO_ABBR, STATE_FIPS } from "@/lib/geo/states";
import { formatValue } from "@/lib/format";
import { stateSlug } from "@/lib/states/slug";

export interface StateMetric {
  key: string;
  label: string;
  unit: string;
  period: string; // shown under the map
  source: string;
  group?: string; // metrics with groups are picked from a grouped menu
  description?: string; // what the measure counts, shown beside the map
}

export interface StateRow {
  abbr: string;
  name: string;
  values: Record<string, number | null>;
}

const DEFAULT_COLOR = "#2563eb";

const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
};

// State map of one metric (switchable), shaded from light (low) to dark
// (high) in `color`. Measures that cross zero, such as change since a base
// year, shade both ways from zero. Clicking a state lists every measure for
// it with its rank.
export function StateExplorer({
  metrics,
  rows,
  color = DEFAULT_COLOR,
  initial,
}: {
  metrics: StateMetric[];
  rows: StateRow[];
  color?: string;
  initial?: string; // metric key to open on
}) {
  const [active, setActive] = useState(metrics.some((m) => m.key === initial) ? initial! : metrics[0].key);
  const [selected, setSelected] = useState<string | null>(null);
  const metric = metrics.find((m) => m.key === active)!;
  const groups = [...new Set(metrics.map((m) => m.group).filter((g): g is string => !!g))];

  const byAbbr = useMemo(() => new Map(rows.map((r) => [r.abbr, r])), [rows]);
  const present = rows.map((r) => r.values[active]).filter((v): v is number => v !== null && v !== undefined);
  const diverging = present.some((v) => v < 0);
  const [lo, hi] = valueExtent(present);
  const reach = divergingExtent(present);
  const focused = selected ? byAbbr.get(selected) : undefined;

  // Rank 1 = highest value.
  const rankOf = (key: string, abbr: string) => {
    const v = byAbbr.get(abbr)?.values[key];
    if (v === null || v === undefined) return null;
    const all = rows.map((r) => r.values[key]).filter((x): x is number => x !== null && x !== undefined);
    return { rank: all.filter((x) => x > v).length + 1, of: all.length };
  };

  return (
    <div className="space-y-6">
      {groups.length ? (
        <label className="flex flex-wrap items-center gap-3 text-sm text-slate-600 dark:text-slate-300">
          <span className="font-medium">Measure</span>
          <select
            value={active}
            onChange={(e) => setActive(e.target.value)}
            className="max-w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {groups.map((g) => (
              <optgroup key={g} label={g}>
                {metrics
                  .filter((m) => m.group === g)
                  .map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : (
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
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
          <DemographicsMap
            states={rows.map((r) => ({ id: STATE_FIPS[r.abbr], name: r.name, value: r.values[active] ?? null }))}
            cities={[]}
            selectedStateId={selected ? STATE_FIPS[selected] : null}
            selectedCityId={null}
            cityLevel={false}
            color={color}
            scale={diverging ? "diverging" : "sequential"}
            formatValue={(v) => formatValue(v, metric.unit)}
            onSelectState={(id) => setSelected((current) => (current === FIPS_TO_ABBR[id] ? null : FIPS_TO_ABBR[id]))}
            onSelectCity={() => {}}
            onBack={() => setSelected(null)}
            onNational={() => setSelected(null)}
          />
        </div>
        <div className="space-y-4 text-sm">
          <div className="space-y-2">
            <p className="font-semibold text-slate-900 dark:text-white">{metric.label}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {metric.period} · {metric.source}
            </p>
            {metric.description && (
              <p className="text-xs leading-5 text-slate-600 dark:text-slate-300">{metric.description}</p>
            )}
            {present.length > 0 && (
              <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span className="tabular-nums">
                  {formatValue(diverging ? -reach : lo, metric.unit, { compact: true })}
                </span>
                <span
                  className="h-2 flex-1 rounded-full"
                  style={{
                    background: diverging
                      ? `linear-gradient(to right, ${NEGATIVE_COLOR}, color-mix(in srgb, ${NEGATIVE_COLOR} 12%, transparent) 50%, color-mix(in srgb, ${color} 12%, transparent) 50%, ${color})`
                      : `linear-gradient(to right, color-mix(in srgb, ${color} 12%, transparent), ${color})`,
                  }}
                />
                <span className="tabular-nums">
                  {formatValue(diverging ? reach : hi, metric.unit, { compact: true })}
                </span>
              </div>
            )}
          </div>
          {focused ? (
            <div className="rounded-xl border border-slate-200 p-3 dark:border-slate-800">
              <div className="flex items-baseline justify-between gap-2">
                <Link
                  href={`/states/${stateSlug(focused.name)}`}
                  className="font-semibold text-slate-900 hover:underline dark:text-white"
                >
                  {focused.name}
                </Link>
                <button
                  type="button"
                  onClick={() => setSelected(null)}
                  className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  Clear
                </button>
              </div>
              <dl className="mt-2 space-y-1.5 text-xs">
                {metrics.map((m) => {
                  const r = rankOf(m.key, focused.abbr);
                  return (
                    <div key={m.key} className="flex justify-between gap-3">
                      <dt>
                        <button
                          type="button"
                          onClick={() => setActive(m.key)}
                          className={`text-left ${
                            m.key === active
                              ? "font-medium text-slate-900 dark:text-white"
                              : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
                          }`}
                        >
                          {m.label}
                        </button>
                      </dt>
                      <dd className="shrink-0 text-right">
                        <span className="font-medium text-slate-900 tabular-nums dark:text-white">
                          {formatValue(focused.values[m.key], m.unit)}
                        </span>
                        {r && (
                          <span className="block text-[11px] text-slate-400 tabular-nums">
                            {ordinal(r.rank)} of {r.of}
                          </span>
                        )}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </div>
          ) : (
            <p className="text-xs text-slate-400">Hover a state for its value; click one to see every measure and its rank.</p>
          )}
        </div>
      </div>
    </div>
  );
}
