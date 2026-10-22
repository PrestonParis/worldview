"use client";

import { useEffect, useMemo, useState } from "react";
import { ChartCard, type ChartSource } from "@/components/charts/chart-card";
import { RankedBars, type RankedItem } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart, type Marker, type Series } from "@/components/charts/time-series-chart";

type Source = ChartSource;

export type ExplorerMetric = {
  label: string;
  value: number | null | undefined;
  unit: string;
  period?: string;
  note?: string;
  change?: number | null;
  compare?: string;
};

export type ExplorerView =
  | {
      key: string;
      label: string;
      title: string;
      subtitle?: string;
      kind: "time";
      series: Series[];
      unit: string;
      type?: "line" | "column";
      fromZero?: boolean;
      markers?: Marker[];
      source: Source;
      note?: string;
    }
  | {
      key: string;
      label: string;
      title: string;
      subtitle?: string;
      kind: "ranked";
      items: RankedItem[];
      itemLabel: string;
      unit: string;
      slot?: 1 | 2 | 3;
      limit?: number;
      source: Source;
      note?: string;
    };

function Tabs({ label, views, value, onChange }: { label: string; views: ExplorerView[]; value: string; onChange: (key: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-slate-400">{label}</span>
      <div className="flex flex-wrap gap-1 rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist" aria-label={label}>
        {views.map((view) => (
          <button
            key={view.key}
            type="button"
            role="tab"
            aria-selected={view.key === value}
            onClick={() => onChange(view.key)}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium transition-all duration-300 ${
              view.key === value
                ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white"
                : "text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function LivingTimeline({ view }: { view: Extract<ExplorerView, { kind: "time" }> }) {
  const xs = useMemo(() => [...new Set(view.series.flatMap((series) => series.points.map((point) => point.x)))].sort((a, b) => a - b), [view.series]);
  const [cursor, setCursor] = useState(Math.max(0, xs.length - 1));
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (!playing || xs.length < 2) return;
    const timer = window.setInterval(() => {
      setCursor((current) => {
        if (current >= xs.length - 1) {
          setPlaying(false);
          return current;
        }
        return current + 1;
      });
    }, 220);
    return () => window.clearInterval(timer);
  }, [playing, xs.length]);

  const shown = view.series.map((series) => ({ ...series, points: series.points.filter((point) => point.x <= (xs[cursor] ?? Infinity)) }));
  const point = shown.flatMap((series) => series.points).findLast((item) => item.x === xs[cursor]);

  return (
    <>
      <div className="transition-opacity duration-300">
        <TimeSeriesChart series={shown} type={view.type} unit={view.unit} height={300} markers={view.markers} fromZero={view.fromZero} />
      </div>
      {xs.length > 2 && (
        <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 dark:bg-slate-900/60">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={() => {
                if (!playing && cursor >= xs.length - 1) setCursor(0);
                setPlaying((current) => !current);
              }}
              className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-200"
            >
              {playing ? "Pause" : cursor >= xs.length - 1 ? "Play history" : "Continue"}
            </button>
            <span className="text-sm font-semibold text-slate-900 tabular-nums dark:text-white">{point?.label ?? xs[cursor]}</span>
          </div>
          <input
            type="range"
            min={0}
            max={Math.max(0, xs.length - 1)}
            value={cursor}
            onChange={(event) => {
              setPlaying(false);
              setCursor(Number(event.target.value));
            }}
            aria-label={`Year shown for ${view.title}`}
            className="w-full accent-blue-600"
          />
          <div className="flex justify-between text-[11px] text-slate-400"><span>{xs[0]}</span><span>{xs.at(-1)}</span></div>
        </div>
      )}
    </>
  );
}

function ViewCard({ view }: { view: ExplorerView }) {
  const table = view.kind === "time" ? seriesTable(view.series, view.unit) : rankedTable(view.items, view.itemLabel, view.unit);
  return (
    <div key={view.key} className="min-w-0">
      <ChartCard title={view.title} subtitle={view.subtitle} source={view.source} table={table}>
        {view.kind === "time" ? (
          <LivingTimeline view={view} />
        ) : (
          <RankedBars items={view.items} unit={view.unit} slot={view.slot} limit={view.limit} />
        )}
        {view.note && <p className="mt-3 text-xs leading-5 text-slate-500 dark:text-slate-400">{view.note}</p>}
      </ChartCard>
    </div>
  );
}

export function ChapterExplorer({
  metrics = [],
  primary,
  secondary,
  primaryLabel = "Main view",
  secondaryLabel = "Break down by",
  callout,
}: {
  metrics?: ExplorerMetric[];
  primary: ExplorerView[];
  secondary?: ExplorerView[];
  primaryLabel?: string;
  secondaryLabel?: string;
  callout?: string;
}) {
  const [primaryKey, setPrimaryKey] = useState(primary[0]?.key ?? "");
  const [secondaryKey, setSecondaryKey] = useState(secondary?.[0]?.key ?? "");
  const primaryView = primary.find((view) => view.key === primaryKey) ?? primary[0];
  const secondaryView = secondary?.find((view) => view.key === secondaryKey) ?? secondary?.[0];

  return (
    <div className="space-y-5">
      {metrics.length > 0 && (
        <div className={`grid gap-3 ${metrics.length > 2 ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
          {metrics.map((metric) => (
            <StatTile key={metric.label} label={metric.label} value={metric.value ?? null} unit={metric.unit} period={metric.period} note={metric.note} change={metric.change} compareLabel={metric.compare} />
          ))}
        </div>
      )}
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-slate-800 dark:bg-slate-900/30">
        <Tabs label={primaryLabel} views={primary} value={primaryView.key} onChange={setPrimaryKey} />
        {secondary && secondaryView && <Tabs label={secondaryLabel} views={secondary} value={secondaryView.key} onChange={setSecondaryKey} />}
      </div>
      <div className={`grid gap-5 ${secondaryView ? "xl:grid-cols-[minmax(0,1.35fr)_minmax(22rem,.65fr)]" : ""}`}>
        <ViewCard key={primaryView.key} view={primaryView} />
        {secondaryView && <ViewCard key={secondaryView.key} view={secondaryView} />}
      </div>
      {callout && <p className="max-w-3xl rounded-r-xl border-l-4 border-slate-900 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-600 dark:border-white dark:bg-slate-900/60 dark:text-slate-300">{callout}</p>}
    </div>
  );
}

export function EnforcementExplorer({
  departures,
  detention,
}: {
  departures: { metrics: ExplorerMetric[]; primary: ExplorerView[]; secondary: ExplorerView[] };
  detention: { metrics: ExplorerMetric[]; primary: ExplorerView[]; secondary: ExplorerView[] };
}) {
  const [mode, setMode] = useState<"departures" | "detention">("departures");
  const data = mode === "departures" ? departures : detention;
  return (
    <div className="space-y-5">
      <div className="inline-flex rounded-xl bg-slate-100 p-1 dark:bg-slate-900" role="tablist" aria-label="Enforcement view">
        {(["departures", "detention"] as const).map((item) => (
          <button key={item} type="button" role="tab" aria-selected={mode === item} onClick={() => setMode(item)} className={`rounded-lg px-4 py-2 text-sm font-semibold capitalize transition-all ${mode === item ? "bg-white text-slate-950 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
            {item}
          </button>
        ))}
      </div>
      <ChapterExplorer
        key={mode}
        metrics={data.metrics}
        primary={data.primary}
        secondary={data.secondary}
        primaryLabel={mode === "departures" ? "History" : "Population"}
        secondaryLabel={mode === "departures" ? "Explain by" : "Facilities"}
        callout={mode === "departures" ? "A removal carries legal consequences for re-entry; a return does not. Title 42 expulsions were a separate public-health process. These are events, not unique people." : "ICE detention is civil custody while a case or removal is pending. Average daily population is not the number of people who passed through detention."}
      />
    </div>
  );
}
