"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { AbortionSources } from "@/components/abortion/data-inventory";
import { LimitsMap } from "@/components/abortion/limits-map";
import { PregnancyTimeline, lawAt, type TimelineState } from "@/components/abortion/pregnancy-timeline";
import { StateTravelPicker } from "@/components/abortion/state-travel";
import { ChartCard, type ChartSource } from "@/components/charts/chart-card";
import { periodTags } from "@/components/charts/period-tag";
import { RankedBars } from "@/components/charts/ranked-bars";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { rankedTable, seriesTable } from "@/components/charts/tables";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import type { AbortionData } from "@/lib/abortion/data";
import { FEDERAL_POLICY_HISTORY } from "@/lib/abortion/gestation";
import { STATE_FIPS } from "@/lib/geo/states";
import type { StatePath } from "@/lib/geo/state-paths";
import { formatValue } from "@/lib/format";

const VIEWS = [
  { key: "pregnancy", label: "Pregnancy timeline", question: "When in pregnancy do abortions happen, and where does each state draw its line?" },
  { key: "numbers", label: "How many", question: "How many abortions are provided each month, in states with and without bans?" },
  { key: "who", label: "Who", question: "Who obtains abortions, by age, race, and how far along?" },
  { key: "laws", label: "Laws", question: "What gestational limit does each state set?" },
  { key: "travel", label: "Travel & telehealth", question: "How many patients cross state lines, and how much care arrives by mail?" },
  { key: "states", label: "Compare states", question: "How do the states compare on every measure?" },
  { key: "history", label: "History", question: "How do today's numbers compare with every year since Roe?" },
  { key: "sources", label: "Sources", question: "Where every figure on this page comes from." },
] as const;
type View = (typeof VIEWS)[number]["key"];
const isView = (v: string | null): v is View => VIEWS.some((x) => x.key === v);

const HISTORY_MARKERS = [
  { x: 1973, label: "Roe v. Wade (Jan 1973)" },
  { x: 1976 + 8 / 12, label: "Hyde Amendment (Sep 1976)" },
  { x: 1992 + 5 / 12, label: "Planned Parenthood v. Casey (Jun 1992)" },
  { x: 2000 + 8 / 12, label: "FDA approves mifepristone (Sep 2000)" },
  { x: 2021 + 11 / 12, label: "FDA allows pills by mail (Dec 2021)" },
  { x: 2022 + 5 / 12, label: "Dobbs decision (Jun 2022)" },
];

const RECENT_MARKERS = [
  { x: 2023 + 5 / 12, label: "New York telehealth shield law (Jun 2023)" },
  { x: 2024 + 4 / 12, label: "Florida 6-week ban (May 2024)" },
  { x: 2024 + 5 / 12, label: "Supreme Court mifepristone ruling (Jun 2024)" },
];

export type AbortionSourceKey = "monthly" | "history" | "cdc" | "limits";

// The page's URL is a static render, so ?view= &state= &week= are read on the
// client; picks are written back with replaceState so links reopen the view.
const subscribe = (callback: () => void) => {
  window.addEventListener("popstate", callback);
  return () => window.removeEventListener("popstate", callback);
};
const readSearch = () => window.location.search;
const onServer = () => "";

const pct = (v: number | null | undefined) => (v === null || v === undefined ? "—" : `${Math.round(v)}%`);
const num = (v: number | null | undefined) => formatValue(v, "abortions");

function Fact({ label, value, tone = "" }: { label: string; value: ReactNode; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</dt>
      <dd className={`mt-0.5 truncate text-base font-semibold tabular-nums text-slate-950 dark:text-white ${tone}`}>{value}</dd>
    </div>
  );
}

export function AbortionExplorer({
  data,
  map,
  sources,
}: {
  data: AbortionData;
  map: { width: number; height: number; states: StatePath[] };
  sources: Partial<Record<AbortionSourceKey, ChartSource>>;
}) {
  const search = useSyncExternalStore(subscribe, readSearch, onServer);
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const [picked, setPicked] = useState<{ view?: View; state?: string; week?: number }>({});

  const urlView = params.get("view");
  const view: View = picked.view ?? (isView(urlView) ? urlView : "pregnancy");
  const urlState = params.get("state")?.toUpperCase() ?? "";
  const abbr = picked.state ?? (STATE_FIPS[urlState] ? urlState : "");
  const urlWeek = Number(params.get("week"));
  const week = picked.week ?? (params.get("week") && Number.isFinite(urlWeek) ? Math.min(40, Math.max(0, Math.round(urlWeek))) : 8);

  // Dragging the week fires on every pointer move; Safari throws after 100
  // replaceState calls in 10 seconds, so the URL write is debounced.
  const urlTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(urlTimer.current), []);

  const update = (patch: { view?: View; state?: string; week?: number }) => {
    const next = { view, state: abbr, week, ...patch };
    if (next.view === view && next.state === abbr && next.week === week) return;
    setPicked(next);
    clearTimeout(urlTimer.current);
    urlTimer.current = setTimeout(() => {
      const p = new URLSearchParams(window.location.search);
      p.set("view", next.view);
      if (next.state) p.set("state", next.state);
      else p.delete("state");
      if (next.view === "pregnancy") p.set("week", String(next.week));
      else p.delete("week");
      window.history.replaceState(null, "", `${window.location.pathname}?${p.toString()}`);
    }, 200);
  };
  const pickState = (next: string | null) => update({ state: next && next !== abbr ? next : "" });

  const h = data.headline;
  const year = h.year ?? "";
  const lawMeta = useMemo(
    () => new Map(data.limits.flatMap((group) => group.states.map((s) => [s.abbr, { category: group.value, label: group.label, detail: s.detail }]))),
    [data.limits],
  );
  const timelineStates: TimelineState[] = useMemo(
    () => data.states.rows.map((s) => ({ abbr: s.abbr, name: s.name, category: lawMeta.get(s.abbr)?.category ?? null, limitWeeks: s.values.weeks, detail: lawMeta.get(s.abbr)?.detail ?? null })),
    [data.states.rows, lawMeta],
  );
  const row = data.states.rows.find((s) => s.abbr === abbr);
  const timelineState = timelineStates.find((s) => s.abbr === abbr);
  const law = lawMeta.get(abbr);
  const recorded = lawAt(timelineState, 0);
  const limitLabel = !timelineState ? "—" : recorded.kind === "ban" ? "Total ban" : recorded.kind === "limit" ? `${recorded.weeks} weeks` : recorded.kind === "marker" ? recorded.label.replace("Banned after ", "After ").replace("Limit counted", "Counted") : recorded.label;
  const banned = data.limits.find((c) => c.value === 1)?.states.length ?? 0;
  const cdcEarly = data.gestationBins.filter((bin) => bin.endWeek <= 13).reduce((sum, bin) => sum + bin.value, 0);
  const medicationLatest = data.medication[0]?.points.at(-1)?.value ?? null;
  const active = VIEWS.find((v) => v.key === view)!;
  const limitsByState = useMemo(() => Object.fromEntries([...lawMeta].map(([k, v]) => [k, { category: v.category, detail: v.detail }])), [lawMeta]);
  const lawTone = (c: number | undefined) => (c === 1 || c === 2 ? "text-rose-700 dark:text-rose-300" : c === 5 ? "text-emerald-700 dark:text-emerald-300" : "");
  const cite = (...keys: AbortionSourceKey[]) => keys.flatMap((k) => (sources[k] ? [sources[k]!] : []));

  const panels: Record<View, ReactNode> = {
    pregnancy: <PregnancyTimeline bins={data.gestationBins} cdcYear={data.cdcYear} week={week} onWeek={(w) => update({ week: w })} state={timelineState} lawPeriod={data.limitsPeriod} />,

    numbers: (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile label="Abortions provided" unit="abortions" value={h.total.value} period={year} note="By U.S. clinicians, including telehealth" change={h.total.change} compareLabel={h.priorYear ? `vs ${h.priorYear}` : undefined} spark={h.total.spark} />
          <StatTile label="Latest month" unit="abortions" value={h.month.value} tag={periodTags.month(h.month.period)} note="Guttmacher estimate" change={h.month.change} compareLabel={h.month.compare ? `vs ${h.month.compare}` : undefined} spark={h.month.spark} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions per month" subtitle="United States" source={cite("monthly")} table={seriesTable(data.trend, "abortions")}><TimeSeriesChart series={data.trend} unit="abortions" height={280} markers={RECENT_MARKERS} /></ChartCard>
          <ChartCard title="By state law" subtitle="Monthly abortions in states with and without a total ban" source={cite("monthly")} table={seriesTable(data.groups, "abortions")}><TimeSeriesChart series={data.groups} unit="abortions" height={280} markers={RECENT_MARKERS} /></ChartCard>
        </div>
      </div>
    ),

    who: (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <StatTile label="At 13 weeks or earlier" unit="percent" value={cdcEarly || null} period={data.cdcYear ?? ""} note="Areas reporting to CDC continuously" />
          <StatTile label="Medication abortion" unit="percent" value={medicationLatest} period={data.cdcYear ?? ""} note="Of abortions with a known method" />
        </div>
        {data.cdcYear && (
          <ChartCard title="Who obtains abortions" subtitle={`${data.cdcYear} · reporting areas differ by characteristic`} source={cite("cdc")} table={{ columns: ["Group", "Value"], rows: [...data.ages.map((item) => [`Age ${item.label}`, formatValue(item.value, "percent")]), ...data.weeks.map((item) => [item.label, formatValue(item.value, "percent")]), ...data.raceRates.map((item) => [item.label, `${formatValue(item.value, "per_1000")} per 1,000`])] }}>
            <div className="grid gap-x-10 gap-y-8 lg:grid-cols-3">
              {[
                { title: "Age", note: "Share of abortions", items: data.ages, unit: "percent", slot: 1 as const },
                { title: "Weeks of pregnancy", note: "Share of abortions", items: data.weeks, unit: "percent", slot: 3 as const },
                { title: "Race and ethnicity", note: "Abortions per 1,000 women aged 15–44", items: data.raceRates, unit: "per_1000", slot: 2 as const },
              ].map((group) => (
                <div key={group.title}>
                  <h4 className="text-sm font-semibold text-slate-950 dark:text-white">{group.title}</h4>
                  <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{group.note}</p>
                  <RankedBars items={group.items} unit={group.unit} slot={group.slot} />
                </div>
              ))}
            </div>
          </ChartCard>
        )}
      </div>
    ),

    laws: (
      <div className="space-y-6">
        <LimitsMap width={map.width} height={map.height} states={map.states} limits={limitsByState} categories={data.limits.map((c) => ({ value: c.value, label: c.label, count: c.states.length }))} selected={abbr || null} onSelect={pickState} />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {data.limits.map((category) => (
            <div key={category.value} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <p className="flex items-center gap-2.5 text-3xl font-semibold tabular-nums text-slate-950 dark:text-white"><span className="size-4 rounded ring-1 ring-slate-300 dark:ring-slate-700" style={{ background: `var(--limit-${category.value})` }} aria-hidden />{category.states.length}</p>
              <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{category.label}</h3>
              <ul className="mt-3 flex flex-wrap gap-1.5">
                {category.states.map((s) => (
                  <li key={s.abbr}>
                    <button type="button" onClick={() => pickState(s.abbr)} title={s.detail ? `${s.name}: ${s.detail}` : s.name} className={`rounded-md px-1.5 py-0.5 text-xs font-medium ${s.abbr === abbr ? "bg-slate-900 text-white dark:bg-white dark:text-slate-950" : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-200 dark:hover:bg-slate-700"}`}>{s.abbr}</button>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <p className="text-xs text-slate-500 dark:text-slate-400">As of {data.limitsPeriod ?? "—"}.{sources.limits?.href && <> Source: <a href={sources.limits.href} className="underline underline-offset-2">{sources.limits.label}</a></>}</p>
      </div>
    ),

    travel: (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2">
          {data.travel.year && <StatTile label="Traveled to another state" unit="abortions" value={h.fromOther.value} period={year} extra={h.fromOther.share !== null ? ` · ${pct(h.fromOther.share)}` : undefined} note="Patients treated outside their home state" />}
          <StatTile label="By virtual-only providers" unit="abortions" value={h.virtual.value} period={year} extra={h.virtual.share !== null ? ` · ${pct(h.virtual.share)}` : undefined} note="Pills mailed after an online consultation" spark={h.virtual.spark} />
        </div>
        {data.travel.year && abbr && <StateTravelPicker states={data.travel.states} year={data.travel.year} fips={STATE_FIPS[abbr]} />}
        {data.travel.year && <ChartCard title="Largest travel flows" subtitle={`${data.travel.year} · home state → state where provided · flows under 100 are not published`} source={cite("monthly")} table={rankedTable(data.travel.corridors, "Flow", "abortions")}><RankedBars items={data.travel.corridors} unit="abortions" /></ChartCard>}
        {!abbr && <p className="text-sm text-slate-500 dark:text-slate-400">Pick a state above to see where its residents went and where its patients came from.</p>}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Abortions by virtual-only providers" subtitle="Annual · by law where the pills were received" source={cite("monthly")} table={seriesTable(data.virtualSeries, "abortions")}><TimeSeriesChart series={data.virtualSeries} type="column" unit="abortions" height={260} /></ChartCard>
          <ChartCard title="Medication abortions" subtitle="Share of abortions with a known method · CDC" source={cite("cdc")} table={seriesTable(data.medication, "percent")}><TimeSeriesChart series={data.medication} type="column" unit="percent" height={260} /></ChartCard>
        </div>
      </div>
    ),

    states: (
      <ChartCard title="Across the states" subtitle="Choose a measure; click a state to select it everywhere" source={cite("monthly", "cdc", "history")}>
        <StateExplorer metrics={data.states.metrics} rows={data.states.rows} selected={abbr || null} onSelect={pickState} />
      </ChartCard>
    ),

    history: (
      <div className="space-y-6">
        <ChartCard title="Abortions per year since 1973" subtitle="Three sources with different coverage, shown side by side" source={cite("history", "monthly", "cdc")} table={seriesTable(data.longRun, "abortions")}><TimeSeriesChart series={data.longRun} unit="abortions" height={340} markers={HISTORY_MARKERS} /></ChartCard>
        <ChartCard title="Abortion rate" subtitle="Per 1,000 women aged 15–44" source={cite("history")} table={seriesTable(data.rates, "per_1000")}><TimeSeriesChart series={data.rates} unit="per_1000" height={280} markers={HISTORY_MARKERS} /></ChartCard>
        <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {FEDERAL_POLICY_HISTORY.map((event) => (
            <li key={event.date} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-800">
              <time className="text-xs font-semibold tabular-nums text-sky-700 dark:text-sky-300">{event.date.slice(0, 4)}</time>
              <h3 className="mt-1 text-sm font-semibold text-slate-950 dark:text-white">{event.title}</h3>
              <p className="mt-1.5 text-sm leading-6 text-slate-600 dark:text-slate-300">{event.detail}</p>
            </li>
          ))}
        </ol>
      </div>
    ),

    sources: <AbortionSources datasets={data.datasets} />,
  };

  return (
    <section id="explorer" className="scroll-mt-24 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
      <div className="space-y-4 border-b border-slate-200 bg-slate-50 p-4 sm:p-5 dark:border-slate-800 dark:bg-slate-900/60">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-200">
            Place
            <select value={abbr} onChange={(e) => pickState(e.target.value || null)} className="min-w-0 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-950 dark:border-slate-700 dark:bg-slate-900 dark:text-white">
              <option value="">United States</option>
              {data.states.rows.map((s) => <option key={s.abbr} value={s.abbr}>{s.name}</option>)}
            </select>
          </label>
          <label className="block sm:hidden">
            <span className="sr-only">View</span>
            <select value={view} onChange={(e) => update({ view: e.target.value as View })} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium dark:border-slate-700 dark:bg-slate-900">
              {VIEWS.map((v) => <option key={v.key} value={v.key}>{v.label}</option>)}
            </select>
          </label>
        </div>

        <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-4">
          {row ? (
            <>
              <Fact label="Gestational limit" value={limitLabel} tone={lawTone(law?.category)} />
              <Fact label={`Provided, ${year}`} value={<>{num(row.values.abortions)}{row.values.change !== null && <span className="ml-1.5 text-xs font-medium text-slate-500">{row.values.change > 0 ? "+" : ""}{Math.round(row.values.change)}%</span>}</>} />
              <Fact label="From other states" value={pct(row.values.share)} />
              <Fact label="Residents who left" value={num(row.values.left)} />
            </>
          ) : (
            <>
              <Fact label={`Provided, ${year}`} value={<>{num(h.total.value)}{h.total.change !== null && <span className="ml-1.5 text-xs font-medium text-slate-500">{h.total.change > 0 ? "+" : ""}{Math.round(h.total.change)}%</span>}</>} />
              <Fact label="States with total bans" value={banned} />
              <Fact label="Traveled out of state" value={pct(h.fromOther.share)} />
              <Fact label="Via telehealth" value={pct(h.virtual.share)} />
            </>
          )}
        </dl>
      </div>

      <nav className="hidden flex-wrap gap-1 border-b border-slate-200 px-3 py-2 sm:flex dark:border-slate-800" role="tablist" aria-label="Abortion explorer">
        {VIEWS.map((v) => (
          <button
            key={v.key}
            type="button"
            role="tab"
            aria-selected={v.key === view}
            onClick={() => update({ view: v.key })}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${v.key === view ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-950" : "text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"}`}
          >
            {v.label}
          </button>
        ))}
      </nav>

      <div key={view} role="tabpanel" aria-label={active.label} className="min-w-0 space-y-5 p-4 motion-safe:animate-[chapter-in_240ms_ease-out] sm:p-6">
        <p className="text-lg leading-7 text-slate-700 dark:text-slate-200">{active.question}</p>
        {panels[view]}
      </div>
    </section>
  );
}
