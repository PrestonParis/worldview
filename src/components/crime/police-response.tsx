"use client";

import { ChevronDown } from "lucide-react";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import type { CrimeData } from "@/lib/crime/data";
import { offenseLabel, type OffenseTrend, type YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";
import { useCrimeSelection } from "./selection";

const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));

// Clearance for the Atlas offense in the Atlas year. The clearance bars are
// the offense picker, so choosing one moves the trend, the Atlas, and the
// map together; the arrest shares are a separate FBI table.
export function PoliceResponse({
  offenses,
  latestYear,
  flaggedYears,
  arrests,
}: {
  offenses: OffenseTrend[];
  latestYear: string;
  flaggedYears: { year: string }[];
  arrests: CrimeData["arrests"];
}) {
  const { offense, set, year: selYear, prelim } = useCrimeSelection();
  const clearedYears = offenses[0]?.cleared.map((p) => p.year) ?? [];
  // The Atlas year when clearance has it; the preliminary year has none.
  const year = !prelim && clearedYears.includes(selYear) ? selYear : latestYear;
  const o = offenses.find((x) => x.key === offense)!;
  const total = offenses.find((x) => x.key === (o.group === "violent" ? "violent_crime" : "property_crime"))!;
  const markers = flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }));
  const at = (x: OffenseTrend) => x.cleared.find((p) => p.year === year)?.value ?? null;
  const cleared = at(o);
  const first = o.cleared[0];
  const series: Series[] = [
    { id: o.key, label: o.label, slot: 2, points: pts(o.cleared) },
    ...(total.key !== o.key ? [{ id: total.key, label: `All ${total.group} crime`, slot: 9 as const, points: pts(total.cleared) }] : []),
  ];
  const bars = offenses.map((x) => ({ key: x.key, label: x.label, value: at(x) })).filter((x): x is typeof x & { value: number } => x.value !== null);
  bars.sort((a, b) => b.value - a.value);

  return (
    <div className="space-y-8">
      <div className="grid gap-8 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)]">
        <div className="min-w-0">
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Share of offenses cleared, {year}
            {year !== selYear && !prelim && <span> · clearance runs through {latestYear}</span>}
          </p>
          <ol className="mt-3 space-y-1" aria-label="Pick an offense">
            {bars.map((b) => {
              const on = b.key === offense;
              return (
                <li key={b.key}>
                  <button
                    type="button"
                    onClick={() => set({ offense: b.key })}
                    aria-pressed={on}
                    className={`group grid w-full grid-cols-[9.5rem_minmax(0,1fr)_3.25rem] items-center gap-3 rounded-lg px-2 py-1.5 text-left text-sm ${
                      on ? "bg-slate-100 dark:bg-slate-900" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    }`}
                  >
                    <span className={`truncate ${on ? "font-semibold text-slate-950 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}>{b.label}</span>
                    <span className="h-3 rounded-full bg-slate-100 dark:bg-slate-800">
                      <span className="block h-3 rounded-full transition-[width]" style={{ width: `${b.value}%`, background: on ? "var(--viz-series-2)" : "var(--viz-axis)" }} />
                    </span>
                    <span className={`text-right tabular-nums ${on ? "font-semibold text-slate-950 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
                      {formatValue(b.value, "percent")}
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <p className="text-5xl font-semibold tracking-[-0.03em] text-slate-950 tabular-nums dark:text-white">{formatValue(cleared, "percent")}</p>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              of {offenseLabel(offense).toLowerCase()} offenses cleared in {year}
              {first && cleared !== null && first.year !== year && (
                <span className="block text-xs text-slate-500 dark:text-slate-400">
                  {formatSigned(cleared - first.value, "points")} pts since {first.year} · {formatValue(o.rates.find((p) => p.year === year)?.value, "per_100k")} reported per 100,000
                </span>
              )}
            </p>
          </div>
          <div className="mt-4">
            <TimeSeriesChart unit="percent" height={240} markers={markers} series={series} />
          </div>
        </div>
      </div>

      {arrests && (
        <div className="grid gap-6 border-t border-slate-200 pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] dark:border-slate-800">
          <div>
            <h3 className="text-base font-semibold text-slate-950 dark:text-white">Who and what arrests are for</h3>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Share of all arrests · {formatValue(arrests.total.at(-1)!.value, "arrests", { compact: true })} arrests reported in {arrests.year}
            </p>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              {[
                ["Violent offenses", arrests.violentShare],
                ["Drug offenses", arrests.drugShare],
                ["Under 18", arrests.juvenileShare],
              ].map(([label, s]) => (
                <div key={label as string}>
                  <dt className="text-xs text-slate-500 dark:text-slate-400">{label as string}</dt>
                  <dd className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue((s as YearValue[]).at(-1)?.value, "percent")}</dd>
                </div>
              ))}
            </dl>
          </div>
          <TimeSeriesChart
            unit="percent"
            height={220}
            markers={markers}
            series={[
              { id: "violent", label: "Violent offenses", slot: 1, points: pts(arrests.violentShare) },
              { id: "drug", label: `Drug offenses (${arrests.drugFrom}–)`, slot: 2, points: pts(arrests.drugShare) },
              { id: "juvenile", label: "People under 18", slot: 3, points: pts(arrests.juvenileShare) },
            ]}
          />
        </div>
      )}

      <details className="group max-w-3xl text-sm">
        <summary className="inline-flex cursor-pointer list-none items-center gap-1 font-medium text-slate-700 dark:text-slate-200 [&::-webkit-details-marker]:hidden">
          How clearances and arrests are counted
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden />
        </summary>
        <div className="mt-2 space-y-2 leading-6 text-slate-600 dark:text-slate-300">
          <p>
            An offense is cleared by an arrest, or by exceptional means when police identify the offender but cannot make an arrest. A clearance is
            not a conviction, and it counts an offense, not a person: one arrest can clear several offenses, and several arrests can clear one.
            Clearances are recorded in the year they happen, which can differ from the year the offense was reported.
          </p>
          {arrests && (
            <p>
              Arrests are counted per arrest event from the agencies that reported, so totals move with participation; shares compare across years.
              Drug shares start in {arrests.drugFrom}, when the FBI table stops listing the same arrests under more than one drug heading.
            </p>
          )}
        </div>
      </details>
    </div>
  );
}
