"use client";

import Link from "next/link";
import { useState } from "react";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { TimeSeriesChart, type SeriesPoint } from "@/components/charts/time-series-chart";
import { formatValue } from "@/lib/format";

export interface StateFlow {
  fips: string;
  name: string;
  inflow: number | null;
  outflow: number | null;
  origins: RankedItem[];
  destinations: RankedItem[];
  netDomestic: SeriesPoint[];
}

// Pick a state: who moved in from where, who moved out to where (ACS), and
// its net domestic migration over time (PEP).
export function StateFlows({
  states,
  period,
  defaultFips = "06",
}: {
  states: StateFlow[];
  period: string;
  defaultFips?: string;
}) {
  const [fips, setFips] = useState(defaultFips);
  const s = states.find((x) => x.fips === fips) ?? states[0];
  const net = s.inflow !== null && s.outflow !== null ? s.inflow - s.outflow : null;

  return (
    <figure className="min-w-0 space-y-6 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <figcaption className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Moves to and from one state</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{period} · people 1 year and over who lived in a different state a year earlier</p>
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
          State
          <select
            value={fips}
            onChange={(e) => setFips(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-white"
          >
            {states.map((x) => (
              <option key={x.fips} value={x.fips}>
                {x.name}
              </option>
            ))}
          </select>
        </label>
      </figcaption>

      <dl className="grid grid-cols-3 gap-4">
        {[
          ["Moved in from other states", s.inflow],
          ["Moved out to other states", s.outflow],
          ["Net", net],
        ].map(([label, v]) => (
          <div key={label as string}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-950 tabular-nums dark:text-white">
              {label === "Net" && typeof v === "number" && v > 0 ? "+" : ""}
              {formatValue(v as number | null, "people")}
            </dd>
          </div>
        ))}
      </dl>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Where people moving in came from</p>
          <RankedBars items={s.origins} unit="people" slot={1} />
        </div>
        <div>
          <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Where people moving out went</p>
          <RankedBars items={s.destinations} unit="people" slot={2} />
        </div>
      </div>

      <div>
        <p className="mb-3 text-sm font-medium text-slate-900 dark:text-white">Net domestic migration, {s.name}</p>
        <TimeSeriesChart
          series={[{ id: "dom", label: "Net domestic migration", slot: 3, points: s.netDomestic }]}
          type="column"
          unit="people"
          height={220}
        />
        <p className="mt-2 text-xs text-slate-400">Year ending July 1 · Census Bureau Population Estimates</p>
      </div>

      <p className="text-xs text-slate-400">
        Source:{" "}
        <Link href="/datasets/census-state-migration" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:hover:text-slate-200">
          Census Bureau State-to-State Migration Flows
        </Link>
      </p>
    </figure>
  );
}
