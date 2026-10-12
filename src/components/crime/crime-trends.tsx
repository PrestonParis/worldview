"use client";

import { useState } from "react";
import { TimeSeriesChart, type Marker, type Series } from "@/components/charts/time-series-chart";
import { formatSigned, formatValue } from "@/lib/format";
import type { OffenseKey, OffenseTrend } from "@/lib/crime/offenses";
import { Chip, Segmented } from "./segmented";

type Mode = "rate" | "index";
const MAX_PICKED = 3; // one per series color

// National annual rates: small multiples on their own scales, or up to
// three offenses indexed to the first year on one shared scale. A table
// view lists every value for either mode.
export function CrimeTrends({
  offenses,
  flaggedYears,
  baseYear,
}: {
  offenses: OffenseTrend[];
  flaggedYears: { year: string; coverage: number | null }[];
  baseYear: string;
}) {
  const [mode, setMode] = useState<Mode>("rate");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [picked, setPicked] = useState<OffenseKey[]>(["violent_crime", "homicide", "property_crime"]);

  const markers: Marker[] = flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }));
  const flagged = new Set(flaggedYears.map((f) => f.year));
  const indexed = (o: OffenseTrend) => {
    const base = o.rates.find((p) => p.year === baseYear)?.value;
    return o.rates.map((p) => ({ year: p.year, value: base ? (p.value / base) * 100 : NaN }));
  };
  const points = (o: OffenseTrend) =>
    (mode === "index" ? indexed(o) : o.rates).map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
  const unit = mode === "index" ? "index" : "per_100k";
  const toggle = (k: OffenseKey) =>
    setPicked((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : [...cur, k].slice(-MAX_PICKED)));

  const years = offenses[0]?.rates.map((p) => p.year) ?? [];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Measure"
          value={mode}
          onChange={setMode}
          options={[
            { value: "rate", label: "Rate per 100,000" },
            { value: "index", label: `Indexed, ${baseYear} = 100` },
          ]}
        />
        <Segmented
          label="View"
          value={view}
          onChange={setView}
          options={[
            { value: "chart", label: "Chart" },
            { value: "table", label: "Table" },
          ]}
        />
      </div>

      {view === "table" ? (
        <div className="max-h-[28rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[48rem] text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                <th className="px-3 py-2 text-left font-medium">Year</th>
                {offenses.map((o) => (
                  <th key={o.key} className="px-3 py-2 text-right font-medium">
                    {o.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...years].reverse().map((y) => (
                <tr key={y}>
                  <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                    {y}
                    {flagged.has(y) && <span title="Partial reporting">†</span>}
                  </td>
                  {offenses.map((o) => {
                    const v = (mode === "index" ? indexed(o) : o.rates).find((p) => p.year === y)?.value;
                    return (
                      <td key={o.key} className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">
                        {formatValue(v, unit)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : mode === "index" ? (
        <div className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
          <div className="flex flex-wrap gap-2">
            {offenses.map((o) => (
              <Chip key={o.key} active={picked.includes(o.key)} onClick={() => toggle(o.key)}>
                {o.label}
              </Chip>
            ))}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Each line is that offense&apos;s rate as a share of its {baseYear} rate. Pick up to {MAX_PICKED}.
          </p>
          <TimeSeriesChart
            series={picked.map(
              (k, i): Series => {
                const o = offenses.find((x) => x.key === k)!;
                return { id: k, label: o.label, slot: (i + 1) as 1 | 2 | 3, points: points(o) };
              },
            )}
            unit="index"
            height={320}
            fromZero={false}
            endLabels={false}
            reference={{ value: 100, label: `${baseYear} level` }}
            markers={markers}
          />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {offenses.map((o) => (
            <figure key={o.key} className="min-w-0 rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <figcaption className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-950 dark:text-white">{o.label}</h3>
                {o.vsBase !== null && (
                  <p className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                    {formatSigned(o.vsBase, "percent")} since {baseYear}
                  </p>
                )}
              </figcaption>
              <div className="mt-3">
                <TimeSeriesChart series={[{ id: o.key, label: o.label, slot: 1, points: points(o) }]} unit={unit} height={150} markers={markers} />
              </div>
            </figure>
          ))}
        </div>
      )}
    </div>
  );
}
