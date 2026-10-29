"use client";

import { useState } from "react";
import { RankedBars } from "@/components/charts/ranked-bars";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import type { CrimeData } from "@/lib/crime/data";
import type { YearValue } from "@/lib/crime/offenses";
import { Segmented } from "./segmented";

type View = "rates" | "reported" | "relationship";

const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
const card = "min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800";
const title = "text-base font-semibold text-slate-950 dark:text-white";
const sub = "mt-1 text-sm text-slate-500 dark:text-slate-400";

// The BJS victimization survey from three angles. Violent and property rates
// have different bases (people 12+ vs households), so each gets its own chart.
export function ReportingViews({ v }: { v: NonNullable<CrimeData["victimization"]> }) {
  const [view, setView] = useState<View>("rates");
  return (
    <div className="space-y-4">
      <Segmented
        label="Survey view"
        value={view}
        onChange={setView}
        options={[
          { value: "rates", label: "Victimization rates" },
          { value: "reported", label: "Share reported to police" },
          { value: "relationship", label: "Victim–offender relationship" },
        ]}
      />
      {view === "rates" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <figure className={card}>
            <figcaption>
              <p className={title}>Violent victimization, {v.firstYear}–{v.year}</p>
              <p className={sub}>Per 1,000 people age 12 and older</p>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart unit="per_1000" height={240} series={[{ id: "violent", label: "Violent", slot: 1, points: pts(v.violent) }]} />
            </div>
          </figure>
          <figure className={card}>
            <figcaption>
              <p className={title}>Property victimization, {v.firstYear}–{v.year}</p>
              <p className={sub}>Per 1,000 households</p>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart unit="per_1000" height={240} series={[{ id: "property", label: "Property", slot: 2, points: pts(v.property) }]} />
            </div>
          </figure>
        </div>
      )}
      {view === "reported" && (
        <div className="grid gap-6 lg:grid-cols-2">
          <figure className={card}>
            <figcaption>
              <p className={title}>By type of crime, {v.year}</p>
              <p className={sub}>Percent of victimizations victims say police learned about</p>
            </figcaption>
            <div className="mt-4">
              <RankedBars unit="percent" limit={10} items={[...v.reportedByType].sort((a, b) => b.value - a.value)} />
            </div>
          </figure>
          <figure className={card}>
            <figcaption>
              <p className={title}>Over time</p>
              <p className={sub}>Percent of victimizations reported to police</p>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart
                unit="percent"
                height={240}
                series={[
                  { id: "violent", label: "Violent", slot: 1, points: pts(v.violentReported) },
                  { id: "property", label: "Property", slot: 2, points: pts(v.propertyReported) },
                ]}
              />
            </div>
          </figure>
        </div>
      )}
      {view === "relationship" && (
        <figure className={card}>
          <figcaption>
            <p className={title}>Violence by relationship to the offender</p>
            <p className={sub}>Per 1,000 people 12 and older. Domestic violence is by an intimate partner or other relative.</p>
          </figcaption>
          <div className="mt-4">
            <TimeSeriesChart
              unit="per_1000"
              height={260}
              series={[
                { id: "stranger", label: "Stranger", slot: 1, points: pts(v.stranger) },
                { id: "domestic", label: "Domestic", slot: 2, points: pts(v.domestic) },
                { id: "intimate", label: "Intimate partner", slot: 3, points: pts(v.intimate) },
              ]}
            />
          </div>
        </figure>
      )}
    </div>
  );
}
