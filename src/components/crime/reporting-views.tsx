"use client";

import { useState } from "react";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import type { CrimeData } from "@/lib/crime/data";
import type { YearValue } from "@/lib/crime/offenses";
import { formatValue } from "@/lib/format";
import { Segmented } from "./segmented";

type View = "reported" | "rates" | "relationship";

const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));

export interface PoliceTrack {
  year: string;
  violentRate: number | null;
  violentCleared: number | null;
  coverage: number | null;
}

// Two parallel tracks: what the BJS survey hears from victims, and what police
// agencies record for the FBI. They measure different things in different
// units, so they sit side by side, never as stages of one count.
export function ReportingViews({ v, police }: { v: NonNullable<CrimeData["victimization"]>; police: PoliceTrack }) {
  const [view, setView] = useState<View>("reported");
  const byType = [...v.reportedByType].sort((a, b) => b.value - a.value);
  return (
    <div className="space-y-8">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_auto_minmax(0,2fr)]">
        <section aria-label="Victimization survey" className="min-w-0">
          <Track source="BJS National Crime Victimization Survey" year={v.year} title="What victims say" />
          <p className="mt-3 flex flex-wrap items-baseline gap-x-2">
            <span className="text-5xl font-semibold tracking-[-0.03em] text-slate-950 tabular-nums dark:text-white">{formatValue(v.latest.violentReported, "percent")}</span>
            <span className="text-sm text-slate-600 dark:text-slate-300">of violent victimizations were reported to police</span>
          </p>
          <ul className="mt-5 space-y-2">
            {byType.map((t) => (
              <li key={t.label} className="grid grid-cols-[8.5rem_minmax(0,1fr)_3rem] items-center gap-3 text-sm">
                <span className="truncate text-slate-600 dark:text-slate-300">{t.label}</span>
                <span className="flex h-3 overflow-hidden rounded-full bg-[repeating-linear-gradient(135deg,var(--viz-grid)_0_4px,transparent_4px_8px)] ring-1 ring-slate-200 ring-inset dark:ring-slate-800">
                  <span className="h-full rounded-full" style={{ width: `${t.value}%`, background: "var(--viz-series-1)" }} />
                </span>
                <span className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(t.value, "percent")}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 flex gap-4 text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm" style={{ background: "var(--viz-series-1)" }} aria-hidden /> Police learned of it
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="inline-block h-2.5 w-4 rounded-sm bg-[repeating-linear-gradient(135deg,var(--viz-axis)_0_3px,transparent_3px_6px)]" aria-hidden /> Never reported
            </span>
          </p>
          <dl className="mt-5 grid grid-cols-2 gap-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
            <Fig label="Violent victimizations" value={formatValue(v.latest.violent, "per_1000")} unit="per 1,000 people 12+" />
            <Fig label="Property crime reported" value={formatValue(v.latest.propertyReported, "percent")} unit="of household victimizations" />
          </dl>
        </section>

        <div className="flex items-center gap-3 lg:flex-col" aria-hidden>
          <span className="h-px flex-1 bg-slate-200 lg:h-auto lg:w-px dark:bg-slate-800" />
          <span className="text-[11px] tracking-wide text-slate-400 uppercase lg:[writing-mode:vertical-rl]">Separate counts</span>
          <span className="h-px flex-1 bg-slate-200 lg:h-auto lg:w-px dark:bg-slate-800" />
        </div>

        <section aria-label="Police records" className="min-w-0">
          <Track source="FBI Uniform Crime Reporting" year={police.year} title="What police record" />
          <dl className="mt-3 space-y-5">
            <Fig large label="Violent offenses known to police" value={formatValue(police.violentRate, "per_100k")} unit="per 100,000 residents" />
            <Fig large label="Cleared by arrest or exceptional means" value={formatValue(police.violentCleared, "percent")} unit="of violent offenses" />
            <Fig label="Residents covered by reporting agencies" value={formatValue(police.coverage, "percent")} unit="averaged over the year" />
          </dl>
        </section>
      </div>
      <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
        The survey counts victimizations of people 12 and older in households, including crimes never reported; it has no homicide figure and
        excludes crimes against businesses. The FBI counts offenses known to participating agencies, per resident of every age. Different years,
        populations, and units: one cannot be converted into the other.
      </p>

      <div className="space-y-4 border-t border-slate-200 pt-6 dark:border-slate-800">
        <Segmented
          label="Survey view"
          value={view}
          onChange={setView}
          options={[
            { value: "reported", label: "Reporting over time" },
            { value: "rates", label: "Victimization rates" },
            { value: "relationship", label: "Victim–offender relationship" },
          ]}
        />
        {view === "reported" && (
          <Chart title="Share of victimizations reported to police" sub={`Percent, ${v.firstYear}–${v.year}`}>
            <TimeSeriesChart
              unit="percent"
              height={240}
              series={[
                { id: "violent", label: "Violent", slot: 1, points: pts(v.violentReported) },
                { id: "property", label: "Property", slot: 2, points: pts(v.propertyReported) },
              ]}
            />
          </Chart>
        )}
        {view === "rates" && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Chart title="Violent victimization" sub="Per 1,000 people age 12 and older">
              <TimeSeriesChart unit="per_1000" height={220} series={[{ id: "violent", label: "Violent", slot: 1, points: pts(v.violent) }]} />
            </Chart>
            <Chart title="Property victimization" sub="Per 1,000 households">
              <TimeSeriesChart unit="per_1000" height={220} series={[{ id: "property", label: "Property", slot: 2, points: pts(v.property) }]} />
            </Chart>
          </div>
        )}
        {view === "relationship" && (
          <Chart title="Violence by relationship to the offender" sub="Per 1,000 people 12 and older. Domestic: by an intimate partner or other relative.">
            <TimeSeriesChart
              unit="per_1000"
              height={240}
              series={[
                { id: "stranger", label: "Stranger", slot: 1, points: pts(v.stranger) },
                { id: "domestic", label: "Domestic", slot: 2, points: pts(v.domestic) },
                { id: "intimate", label: "Intimate partner", slot: 3, points: pts(v.intimate) },
              ]}
            />
          </Chart>
        )}
      </div>
    </div>
  );
}

function Track({ source, year, title }: { source: string; year: string; title: string }) {
  return (
    <header>
      <p className="text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        {source} · {year}
      </p>
      <h3 className="mt-0.5 text-lg font-semibold text-slate-950 dark:text-white">{title}</h3>
    </header>
  );
}

function Fig({ label, value, unit, large = false }: { label: string; value: string; unit: string; large?: boolean }) {
  return (
    <div>
      <dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white ${large ? "text-3xl" : "text-xl"}`}>
        {value} <span className="text-xs font-normal tracking-normal text-slate-500 dark:text-slate-400">{unit}</span>
      </dd>
    </div>
  );
}

function Chart({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <figure className="min-w-0">
      <figcaption>
        <p className="text-sm font-semibold text-slate-950 dark:text-white">{title}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">{sub}</p>
      </figcaption>
      <div className="mt-3">{children}</div>
    </figure>
  );
}
