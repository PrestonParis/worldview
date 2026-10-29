"use client";

import { RankedBars } from "@/components/charts/ranked-bars";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import type { CrimeData } from "@/lib/crime/data";
import { OFFENSES, offenseLabel, type OffenseTrend, type YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";
import { Chip } from "./segmented";
import { useCrimeSelection } from "./selection";

const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
const card = "min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800";
const title = "text-base font-semibold text-slate-950 dark:text-white";
const sub = "mt-1 text-sm text-slate-500 dark:text-slate-400";

// Clearance for the Atlas offense (picking one here moves the Atlas too),
// then the arrest counts, which are a separate FBI table.
export function PoliceResponse({
  offenses,
  year,
  flaggedYears,
  arrests,
}: {
  offenses: OffenseTrend[];
  year: string;
  flaggedYears: { year: string }[];
  arrests: CrimeData["arrests"];
}) {
  const { offense, set } = useCrimeSelection();
  const o = offenses.find((x) => x.key === offense)!;
  const total = offenses.find((x) => x.key === (o.group === "violent" ? "violent_crime" : "property_crime"))!;
  const markers = flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }));
  const cleared = o.cleared.find((p) => p.year === year)?.value ?? null;
  const first = o.cleared[0];
  const series: Series[] = [
    { id: o.key, label: o.label, slot: 2, points: pts(o.cleared) },
    ...(total.key !== o.key ? [{ id: total.key, label: `All ${total.group} crime`, slot: 9 as const, points: pts(total.cleared) }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Offense">
        {OFFENSES.map((x) => (
          <Chip key={x.key} active={x.key === offense} onClick={() => set({ offense: x.key })}>
            {x.label}
          </Chip>
        ))}
      </div>

      <div className="space-y-3">
        <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Case clearance</h3>
        <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
          <figure className={card}>
            <figcaption>
              <p className={title}>Share of reported offenses cleared, {year}</p>
              <p className={sub}>By arrest, or by exceptional means when the offender is identified but cannot be arrested</p>
            </figcaption>
            <div className="mt-4">
              <RankedBars
                unit="percent"
                limit={9}
                items={offenses
                  .map((x) => ({
                    label: x.label,
                    value: x.cleared.find((p) => p.year === year)?.value ?? NaN,
                    color: x.key === offense ? "var(--viz-series-2)" : "var(--viz-axis)",
                  }))
                  .filter((x) => Number.isFinite(x.value))
                  .sort((a, b) => b.value - a.value)}
              />
            </div>
          </figure>
          <figure className={card}>
            <figcaption className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className={title}>{offenseLabel(offense)} cleared over time</p>
                <p className={sub}>Percent of offenses reported that year</p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 text-right text-xs">
                <dt className="text-slate-500 dark:text-slate-400">Reported, {year}</dt>
                <dt className="text-slate-500 dark:text-slate-400">Cleared</dt>
                <dd className="font-semibold text-slate-900 tabular-nums dark:text-white">{formatValue(o.latest, "per_100k")} per 100k</dd>
                <dd className="font-semibold text-slate-900 tabular-nums dark:text-white">
                  {formatValue(cleared, "percent")}
                  {first && cleared !== null && first.year !== year && (
                    <span className="ml-1 font-normal text-slate-500">({formatSigned(cleared - first.value, "points")} pts since {first.year})</span>
                  )}
                </dd>
              </dl>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart unit="percent" height={260} markers={markers} series={series} />
            </div>
          </figure>
        </div>
        <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
          A clearance counts an offense, not a person: one arrest can clear several offenses, and several arrests can clear one. Clearances are
          recorded in the year they happen, which can differ from the year the offense was reported.
        </p>
      </div>

      {arrests && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-950 dark:text-white">Arrest patterns</h3>
          <figure className={card}>
            <figcaption>
              <p className={title}>What arrests are for, and who is arrested</p>
              <p className={sub}>
                Percent of all arrests · {formatValue(arrests.total.at(-1)!.value, "arrests", { compact: true })} arrests reported in {arrests.year}
              </p>
            </figcaption>
            <div className="mt-4">
              <TimeSeriesChart
                unit="percent"
                height={260}
                markers={markers}
                series={[
                  { id: "violent", label: "Violent offenses", slot: 1, points: pts(arrests.violentShare) },
                  { id: "drug", label: `Drug offenses (${arrests.drugFrom}–)`, slot: 2, points: pts(arrests.drugShare) },
                  { id: "juvenile", label: "People under 18", slot: 3, points: pts(arrests.juvenileShare) },
                ]}
              />
            </div>
          </figure>
          <p className="max-w-3xl text-xs leading-5 text-slate-500 dark:text-slate-400">
            Arrests are counted per arrest event from the agencies that reported, so totals move with participation; shares compare across years.
            Drug shares start in {arrests.drugFrom}, when the FBI table stops listing the same arrests under more than one drug heading.
          </p>
        </div>
      )}
    </div>
  );
}
