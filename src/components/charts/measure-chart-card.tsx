"use client";

import { useState } from "react";
import { ChartCard, type ChartSource } from "./chart-card";
import { seriesTable } from "./tables";
import { TimeSeriesChart, type Marker, type Series } from "./time-series-chart";

export interface Measure {
  label: string; // toggle label, e.g. "Count"
  subtitle: string;
  series: Series[];
  unit: string;
}

// A time-series ChartCard that switches between measures of the same thing,
// e.g. deaths and deaths per 100,000.
export function MeasureChartCard({
  title,
  source,
  measures,
  height,
  gapOver,
  markers,
}: {
  title: string;
  source?: ChartSource;
  measures: Measure[];
  height?: number;
  gapOver?: number;
  markers?: Marker[];
}) {
  const [i, setI] = useState(0);
  const m = measures[i];
  return (
    <ChartCard
      title={title}
      subtitle={m.subtitle}
      source={source}
      table={seriesTable(m.series, m.unit)}
      controls={
        <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-900" role="group" aria-label="Measure">
          {measures.map((x, j) => (
            <button
              key={x.label}
              type="button"
              aria-pressed={j === i}
              onClick={() => setI(j)}
              className={`rounded-md px-2.5 py-1 ${
                j === i ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"
              }`}
            >
              {x.label}
            </button>
          ))}
        </div>
      }
    >
      <TimeSeriesChart series={m.series} unit={m.unit} height={height} gapOver={gapOver} markers={markers} />
    </ChartCard>
  );
}
