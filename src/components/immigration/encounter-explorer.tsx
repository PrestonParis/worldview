"use client";

import { useState } from "react";
import { ChartCard } from "@/components/charts/chart-card";
import { seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart, type Marker, type Series } from "@/components/charts/time-series-chart";

export interface EncounterView {
  key: string;
  label: string;
  subtitle: string; // what this region covers
}

export interface EncounterBreakdown {
  key: string;
  label: string;
  note: string; // what the split means, shown under the chart
}

// Monthly CBP encounters with two controls in one row above the chart:
// where (nationwide or one land-border region) and how to split the bars
// (legal authority, agency, or demographic group). Series for every
// combination are computed server-side.
export function EncounterExplorer({
  regions,
  breakdowns,
  series,
  markers,
  source,
}: {
  regions: EncounterView[];
  breakdowns: EncounterBreakdown[];
  series: Record<string, Record<string, Series[]>>; // region -> breakdown -> series
  markers: Marker[];
  source: { label: string; href?: string };
}) {
  const [region, setRegion] = useState(regions[0].key);
  const [split, setSplit] = useState(breakdowns[0].key);
  const r = regions.find((x) => x.key === region)!;
  const b = breakdowns.find((x) => x.key === split)!;
  const shown = series[region]?.[split] ?? [];

  return (
    <ChartCard title={`Monthly border encounters — ${r.label}`} subtitle={r.subtitle} source={source} table={seriesTable(shown, "encounters")}>
      <div className="mb-4 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <Segmented label="Where" options={regions} value={region} onChange={setRegion} />
        <Segmented label="Split by" options={breakdowns} value={split} onChange={setSplit} />
      </div>
      <TimeSeriesChart series={shown} type="column" unit="encounters" height={300} markers={markers} />
      <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{b.note}</p>
    </ChartCard>
  );
}

function Segmented({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: string; label: string }[];
  value: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-0.5 dark:bg-slate-900" role="group" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.key}
            type="button"
            aria-pressed={o.key === value}
            onClick={() => onChange(o.key)}
            className={`rounded-md px-2.5 py-1 text-xs font-medium ${
              o.key === value ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
