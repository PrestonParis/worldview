"use client";

import { useState } from "react";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import type { CrimeData } from "@/lib/crime/data";
import type { YearValue } from "@/lib/crime/offenses";
import { formatSigned, formatValue } from "@/lib/format";
import { Segmented } from "./segmented";

const pts = (s: YearValue[]) => s.map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));

type Key = "cdc" | "cdc-fa" | "fbi";

// FBI murders against CDC homicide deaths. The legend is the control: each
// source card toggles its line and opens its definition; the gap view plots
// how far apart the two counts are each year.
export function HomicideCompare({
  deaths,
  murder,
  flaggedYears,
  fbiYear,
  fbiCoverage,
}: {
  deaths: NonNullable<CrimeData["deaths"]>;
  murder: YearValue[];
  flaggedYears: { year: string }[];
  fbiYear: string;
  fbiCoverage: number | null;
}) {
  const [shown, setShown] = useState<Set<Key>>(new Set(["cdc", "cdc-fa", "fbi"]));
  const [def, setDef] = useState<"fbi" | "cdc" | null>(null);
  const [view, setView] = useState<"rates" | "gap">("rates");
  const markers = flaggedYears.map((f) => ({ x: Number(f.year), label: "FBI partial reporting" }));
  const flagged = new Set(flaggedYears.map((f) => f.year));

  const gap = deaths.homicide.flatMap((p) => {
    const f = murder.find((m) => m.year === p.year);
    return f ? [{ year: p.year, value: Math.round((p.value - f.value) * 100) / 100 }] : [];
  });
  const solidGap = gap.filter((g) => !flagged.has(g.year));
  const lastGap = gap.at(-1);
  const widest = solidGap.length ? solidGap.reduce((a, b) => (b.value > a.value ? b : a)) : null;
  const narrowest = solidGap.length ? solidGap.reduce((a, b) => (b.value < a.value ? b : a)) : null;
  const prev = deaths.homicide.at(-2);

  const all: (Series & { key: Key })[] = [
    { key: "cdc", id: "cdc", label: "Homicide deaths (CDC)", slot: 1, points: pts(deaths.homicide) },
    { key: "cdc-fa", id: "cdc-fa", label: "Firearm homicide deaths (CDC)", slot: 3, points: pts(deaths.firearmHomicide) },
    { key: "fbi", id: "fbi", label: "Murders reported to police (FBI)", slot: 2, points: pts(murder) },
  ];
  // A source's lines switch together; the last source shown stays on.
  const toggle = (keys: Key[]) =>
    setShown((cur) => {
      const on = keys.some((k) => cur.has(k));
      const next = new Set([...cur].filter((k) => !keys.includes(k)));
      if (!on) keys.forEach((k) => next.add(k));
      return next.size ? next : cur;
    });

  const sources = [
    {
      id: "fbi" as const,
      name: "FBI · police records",
      color: "var(--viz-series-2)",
      keys: ["fbi"] as Key[],
      value: formatValue(murder.at(-1)?.value, "per_100k"),
      sub: `murders per 100,000, ${fbiYear}`,
      rows: [
        ["Counts", "Murder and nonnegligent manslaughter: the willful killing of one person by another. Justifiable homicides, accidents, and negligent manslaughter are excluded."],
        ["Recorded by", "Police agencies, as offenses known to them"],
        ["Coverage", `Agencies that reported, ${formatValue(fbiCoverage, "percent")} of residents in ${fbiYear}`],
      ],
    },
    {
      id: "cdc" as const,
      name: "CDC · death certificates",
      color: "var(--viz-series-1)",
      keys: ["cdc", "cdc-fa"] as Key[],
      value: formatValue(deaths.homicide.at(-1)?.value, "per_100k"),
      sub: `homicide deaths per 100,000, ${deaths.year}`,
      rows: [
        ["Counts", "Any death certified as caused by another person's intent to injure or kill, including killings in self-defense. Deaths from police use of force are a separate category."],
        ["Recorded by", "Medical examiners and coroners"],
        ["Coverage", "Every death in the United States"],
      ],
    },
  ];
  const open = sources.find((s) => s.id === def);

  return (
    <div className="space-y-6">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
        <div className="min-w-0 space-y-3">
          <Segmented
            label="Homicide view"
            value={view}
            onChange={setView}
            options={[
              { value: "rates", label: "Both counts" },
              { value: "gap", label: "Gap, CDC − FBI" },
            ]}
          />
          {view === "rates" ? (
            <TimeSeriesChart unit="per_100k" height={320} markers={markers} series={all.filter((s) => shown.has(s.key))} />
          ) : (
            <TimeSeriesChart type="column" unit="per_100k" height={320} markers={markers} series={[{ id: "gap", label: "CDC rate minus FBI rate", slot: 4, points: pts(gap) }]} />
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">Per 100,000 residents. The FBI line dips in partial-reporting years because agencies are missing.</p>
        </div>

        <div className="space-y-3">
          {sources.map((s) => {
            const on = s.keys.some((k) => shown.has(k));
            return (
              <div key={s.id} className={`rounded-2xl p-4 ring-1 transition-opacity ${on ? "ring-slate-300 dark:ring-slate-700" : "opacity-50 ring-slate-200 dark:ring-slate-800"}`}>
                <button type="button" onClick={() => toggle(s.keys)} aria-pressed={on} className="flex w-full items-start justify-between gap-3 text-left">
                  <span>
                    <span className="flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-200">
                      <span className="inline-block h-1 w-4 rounded" style={{ background: s.color }} aria-hidden />
                      {s.name}
                    </span>
                    <span className="mt-1 block text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{s.value}</span>
                    <span className="block text-xs text-slate-500 dark:text-slate-400">{s.sub}</span>
                  </span>
                  <span className="text-[11px] text-slate-400">{on ? "Shown" : "Hidden"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDef(def === s.id ? null : s.id)}
                  aria-expanded={def === s.id}
                  className="mt-2 text-xs font-medium text-slate-600 underline decoration-slate-300 underline-offset-2 hover:text-slate-950 dark:text-slate-300 dark:hover:text-white"
                >
                  {def === s.id ? "Hide definition" : "Definition"}
                </button>
              </div>
            );
          })}
          {lastGap && (
            <div className="rounded-2xl bg-slate-100 p-4 text-sm dark:bg-slate-900">
              <p className="text-xs text-slate-500 dark:text-slate-400">Gap in {lastGap.year}</p>
              <p className="text-2xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">
                {formatValue(lastGap.value, "per_100k")} <span className="text-xs font-normal text-slate-500 dark:text-slate-400">per 100,000</span>
              </p>
              {widest && narrowest && widest.year !== narrowest.year && (
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Widest {widest.year} ({formatValue(widest.value, "per_100k")}) · narrowest {narrowest.year} ({formatValue(narrowest.value, "per_100k")}), full-reporting years
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {open && (
        <dl className="grid gap-4 rounded-2xl border border-slate-200 p-4 text-sm sm:grid-cols-3 dark:border-slate-800">
          {open.rows.map(([label, text]) => (
            <div key={label}>
              <dt className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                {open.name.split(" · ")[0]} · {label}
              </dt>
              <dd className="mt-1 leading-6 text-slate-700 dark:text-slate-200">{text}</dd>
            </div>
          ))}
        </dl>
      )}

      <dl className="flex flex-wrap gap-x-8 gap-y-3 border-t border-slate-200 pt-4 text-sm dark:border-slate-800">
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">Homicide deaths, {deaths.year}</dt>
          <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">
            {formatValue(deaths.deaths, "deaths")}
            {prev && (
              <span className="ml-1 text-xs font-normal text-slate-500">
                rate {formatSigned(((deaths.homicide.at(-1)!.value - prev.value) / prev.value) * 100, "percent")} vs {prev.year}
              </span>
            )}
          </dd>
        </div>
        <div>
          <dt className="text-xs text-slate-500 dark:text-slate-400">By firearm, {deaths.year}</dt>
          <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">{formatValue(deaths.firearmShare, "percent")} of homicide deaths</dd>
        </div>
        {deaths.ttm && (
          <div>
            <dt className="text-xs text-slate-500 dark:text-slate-400">Latest 12 months, provisional</dt>
            <dd className="font-semibold text-slate-950 tabular-nums dark:text-white">
              {formatValue(deaths.ttm.homicide, "per_100k")} per 100,000 <span className="text-xs font-normal text-slate-500">{deaths.ttm.range ?? `through ${deaths.ttm.through}`}</span>
            </dd>
          </div>
        )}
      </dl>
    </div>
  );
}
