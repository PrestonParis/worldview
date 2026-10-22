"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeftRight, ArrowUp, ArrowUpDown, Check, Download, Plus, Search, SlidersHorizontal, X } from "lucide-react";
import type { IssueViewCatalog, MetricOption } from "@/lib/db/issueview";
import type { CompareResult } from "@/lib/db/stats";
import { Surface } from "@/components/ui/surface";
import { buttonVariants } from "@/components/ui/button";
import { niceTicks } from "@/components/charts/use-width";
import { formatSigned, formatValue } from "@/lib/format";
import { CompareScatter } from "./compare-scatter";
import { CorrelationMatrix } from "./correlation-matrix";
import { correlationMatrix, pairStats, strength } from "./compare-stats";

interface Props {
  catalog: IssueViewCatalog;
  initialResult: CompareResult | null;
  initialLevel: "state" | "county";
  initialAxes?: { x?: number; y?: number };
}

type SortKey = number | "trend" | "name";

const ROW_CAP = 500;

const csvCell = (value: string) => `"${value.replace(/"/g, '""')}"`;

function StatTile({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="min-w-0">
      <div className="text-xs font-medium text-slate-500">{label}</div>
      <div className="font-mono text-lg font-semibold text-slate-950 tabular-nums dark:text-white">{value}</div>
      {note && <div className="truncate text-xs text-slate-500">{note}</div>}
    </div>
  );
}

export function IssueViewWorkspace({ catalog, initialResult, initialLevel, initialAxes }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedMetrics, setSelectedMetrics] = useState<MetricOption[]>(() => {
    if (initialResult?.series && initialResult.series.length > 0) {
      return initialResult.series.map((s) => {
        const found = catalog.allMetrics.find((m) => m.source === s.source && m.metric === s.metric);
        return (
          found || {
            source: s.source,
            sourceTitle: s.source,
            topic: "Selected",
            metric: s.metric,
            label: s.label,
            unit: s.unit,
            levels: [initialLevel],
          }
        );
      });
    }
    return catalog.allMetrics.filter((metric) => metric.levels.includes(initialLevel)).slice(0, 2);
  });

  const series = useMemo(() => initialResult?.series ?? [], [initialResult]);
  const rows = useMemo(() => initialResult?.rows ?? [], [initialResult]);
  const columns = series.length;

  const [geoLevel, setGeoLevel] = useState<"state" | "county">(initialLevel);
  const [axes, setAxes] = useState(() => {
    const valid = (v: number | undefined) => v !== undefined && Number.isInteger(v) && v >= 0 && v < columns;
    const x = valid(initialAxes?.x) ? initialAxes!.x! : 0;
    const y = valid(initialAxes?.y) && initialAxes!.y !== x ? initialAxes!.y! : x === 1 ? 0 : 1;
    return { x, y };
  });
  const [sort, setSort] = useState<{ key: SortKey; asc: boolean }>({ key: 0, asc: false });
  const [query, setQuery] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hover, setHover] = useState<{ geoid: string; from: "chart" | "table" } | null>(null);
  const [pinned, setPinned] = useState<string | null>(null);
  const activeGeoid = hover?.geoid ?? pinned;

  const plottable = columns >= 2;
  const stats = useMemo(
    () => (plottable ? pairStats(rows, axes.x, axes.y) : { n: 0, r: null, rho: null, fit: null, residuals: new Map<string, number>() }),
    [rows, axes, plottable],
  );
  const matrix = useMemo(() => (columns >= 3 ? correlationMatrix(rows, columns) : null), [rows, columns]);

  function chooseAxes(x: number, y: number) {
    if (x === y) return;
    setAxes({ x, y });
    // Shareable without a server round trip: Next leaves replaceState alone.
    const params = new URLSearchParams(window.location.search);
    params.set("x", String(x));
    params.set("y", String(y));
    window.history.replaceState(null, "", `${window.location.pathname}?${params}`);
  }

  const xs = series[axes.x];
  const ys = series[axes.y];

  // A round step on the X axis (one gridline) to state the slope in.
  const xStep = useMemo(() => {
    if (!plottable) return null;
    const values = rows.flatMap((r) => (r.values[axes.x] === null ? [] : [r.values[axes.x]!]));
    if (values.length < 2) return null;
    const ticks = niceTicks(Math.min(...values), Math.max(...values), 5);
    return ticks.length > 1 ? ticks[1] - ticks[0] : null;
  }, [rows, axes.x, plottable]);

  // Plotted pair first, then the trend residual, then the rest.
  const columnOrder = useMemo(() => {
    if (!plottable) return series.map((_, i) => i as SortKey);
    const rest = series.map((_, i) => i).filter((i) => i !== axes.x && i !== axes.y);
    return [axes.x, axes.y, ...(stats.fit ? (["trend"] as const) : []), ...rest] as SortKey[];
  }, [series, axes, plottable, stats.fit]);

  const sortedRows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const filtered = needle
      ? rows.filter((r) => r.name.toLowerCase().includes(needle) || r.state?.toLowerCase() === needle)
      : rows;
    const valueOf = (r: (typeof rows)[number]) =>
      sort.key === "trend" ? (stats.residuals.get(r.geoid) ?? null) : sort.key === "name" ? null : r.values[sort.key];
    return [...filtered].sort((a, b) => {
      if (sort.key === "name") return sort.asc ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      const va = valueOf(a);
      const vb = valueOf(b);
      if (va === null && vb === null) return a.name.localeCompare(b.name);
      if (va === null) return 1;
      if (vb === null) return -1;
      return sort.asc ? va - vb : vb - va;
    });
  }, [rows, query, sort, stats.residuals]);
  const visibleRows = sortedRows.slice(0, ROW_CAP);

  // Hovering a dot scrolls its row into view inside the table, never the page.
  const scrollRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (hover?.from !== "chart") return;
    const box = scrollRef.current;
    const row = box?.querySelector<HTMLElement>(`[data-geoid="${hover.geoid}"]`);
    if (!box || !row) return;
    const head = box.querySelector("thead")?.getBoundingClientRect().height ?? 0;
    if (row.offsetTop < box.scrollTop + head) box.scrollTop = row.offsetTop - head;
    else if (row.offsetTop + row.offsetHeight > box.scrollTop + box.clientHeight)
      box.scrollTop = row.offsetTop + row.offsetHeight - box.clientHeight;
  }, [hover]);

  function toggleSort(key: SortKey) {
    setSort((s) => (s.key === key ? { key, asc: !s.asc } : { key, asc: key === "name" }));
  }

  function handleExportCsv() {
    if (!initialResult || rows.length === 0) return;
    const headers = [
      "Place",
      "State",
      ...series.map((s) => csvCell(`${s.label}${s.unit ? ` (${s.unit})` : ""}${s.period ? ` ${s.period}` : ""}`)),
      ...(stats.fit && ys ? [csvCell(`${ys.label} vs. trend on ${xs.label}`)] : []),
    ];
    const csvRows = sortedRows.map((r) => [
      csvCell(r.name),
      csvCell(r.state ?? ""),
      ...r.values.map((v) => (v !== null ? String(v) : "")),
      ...(stats.fit ? [stats.residuals.has(r.geoid) ? stats.residuals.get(r.geoid)!.toPrecision(6) : ""] : []),
    ]);
    const csvContent = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `issueview-${geoLevel}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function toggleMetric(m: MetricOption) {
    if (!m.levels.includes(geoLevel)) return;
    const exists = selectedMetrics.some((x) => x.source === m.source && x.metric === m.metric);
    if (exists) {
      if (selectedMetrics.length > 1) {
        setSelectedMetrics(selectedMetrics.filter((x) => !(x.source === m.source && x.metric === m.metric)));
      }
    } else if (selectedMetrics.length < 6) {
      setSelectedMetrics([...selectedMetrics, m]);
    }
  }

  function applyComparison() {
    const params = new URLSearchParams({
      level: geoLevel,
      series: selectedMetrics.map((metric) => `${metric.source}:${metric.metric}`).join(","),
    });
    startTransition(() => router.replace(`/issueview/compare?${params}`, { scroll: false }));
  }

  function changeGeoLevel(level: "state" | "county") {
    setGeoLevel(level);
    setSelectedMetrics((current) => {
      const compatible = current.filter((metric) => metric.levels.includes(level));
      return compatible.length
        ? compatible
        : catalog.allMetrics.filter((metric) => metric.levels.includes(level)).slice(0, 2);
    });
  }

  const appliedSeries = series.map((item) => `${item.source}:${item.metric}`).join(",");
  const selectedSeries = selectedMetrics.map((item) => `${item.source}:${item.metric}`).join(",");
  const hasUnappliedChanges = geoLevel !== initialLevel || selectedSeries !== appliedSeries;
  const periodOf = (m: MetricOption) => series.find((s) => s.source === m.source && s.metric === m.metric)?.period;
  const datasetCount = new Set(catalog.allMetrics.map((m) => m.source)).size;
  const county = initialResult?.level === "county";
  const unit = (i: number) => series[i]?.unit ?? undefined;

  const header = (key: SortKey) => {
    const label =
      key === "trend" ? "vs. trend" : key === "name" ? "Place" : series[key as number]?.label;
    const sub =
      key === "trend"
        ? "above / below fit"
        : typeof key === "number"
          ? [series[key]?.unit?.replace(/_/g, " "), series[key]?.period].filter(Boolean).join(" · ")
          : null;
    const tag = plottable && key === axes.x ? "X" : plottable && key === axes.y ? "Y" : null;
    const Icon = sort.key !== key ? ArrowUpDown : sort.asc ? ArrowUp : ArrowDown;
    return (
      <button
        type="button"
        onClick={() => toggleSort(key)}
        className={`flex items-start gap-1.5 text-left hover:text-slate-950 dark:hover:text-white ${sort.key === key ? "text-slate-950 dark:text-white" : ""}`}
      >
        {tag && (
          <span className="mt-px rounded bg-slate-900 px-1 text-[10px] font-bold text-white dark:bg-white dark:text-slate-900">{tag}</span>
        )}
        <span className="min-w-0" title={label}>
          <span className="line-clamp-2">{label}</span>
          {sub && <span className="block truncate font-normal text-slate-400">{sub}</span>}
        </span>
        <Icon className={`mt-0.5 h-3 w-3 shrink-0 ${sort.key === key ? "" : "opacity-40"}`} />
      </button>
    );
  };

  return (
    <div className="space-y-6">
      {/* Metric selection */}
      <Surface className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold tracking-wider text-slate-400 uppercase">
              Metrics ({selectedMetrics.length} of 6)
            </span>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {selectedMetrics.map((sm) => {
                const period = periodOf(sm);
                return (
                  <span
                    key={`${sm.source}:${sm.metric}`}
                    title={sm.sourceTitle}
                    className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-2.5 pl-3 text-xs font-medium text-slate-800 dark:bg-slate-800 dark:text-slate-200"
                  >
                    <span>{sm.label}</span>
                    {period && <span className="text-slate-500 dark:text-slate-400">{period}</span>}
                    {selectedMetrics.length > 1 && (
                      <button
                        type="button"
                        aria-label={`Remove ${sm.label}`}
                        onClick={() => toggleMetric(sm)}
                        className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-800 dark:hover:bg-slate-700 dark:hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </span>
                );
              })}
              <button
                type="button"
                onClick={() => setPickerOpen(!pickerOpen)}
                className={buttonVariants({ variant: "outline", size: "sm" }) + " h-7 gap-1 rounded-full text-xs"}
              >
                <Plus className="h-3 w-3" />
                Add metric
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Geography level"
              value={geoLevel}
              onChange={(event) => changeGeoLevel(event.target.value as "state" | "county")}
              className="h-9 rounded-xl border border-slate-200 bg-white px-3 text-xs font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300"
            >
              <option value="state">States</option>
              <option value="county">Counties</option>
            </select>
            <button
              onClick={handleExportCsv}
              disabled={rows.length === 0}
              className={buttonVariants({ variant: "outline", size: "sm" }) + " h-9 gap-1.5 text-xs disabled:opacity-40"}
            >
              <Download className="h-3.5 w-3.5" />
              Export CSV
            </button>
            <button
              type="button"
              onClick={applyComparison}
              disabled={isPending || !hasUnappliedChanges}
              className={buttonVariants({ size: "sm" }) + " h-9 min-w-24 text-xs disabled:opacity-50"}
            >
              {isPending ? "Loading…" : hasUnappliedChanges ? "Apply" : "Applied"}
            </button>
          </div>
        </div>

        {pickerOpen && (
          <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/60">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Choose up to 6 metrics:
              </span>
              <button
                onClick={() => setPickerOpen(false)}
                className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
              >
                Close
              </button>
            </div>
            <div className="max-h-64 space-y-4 overflow-y-auto pr-1">
              {Object.entries(catalog.topics)
                .filter(([, metrics]) => metrics.length > 0)
                .map(([topic, metrics]) => (
                  <div key={topic} className="space-y-1.5">
                    <div className="text-[11px] font-bold tracking-wider text-slate-400 uppercase">{topic}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {metrics.map((m) => {
                        const isSelected = selectedMetrics.some((sm) => sm.source === m.source && sm.metric === m.metric);
                        const isAvailable = m.levels.includes(geoLevel);
                        return (
                          <button
                            key={`${m.source}:${m.metric}`}
                            type="button"
                            onClick={() => toggleMetric(m)}
                            disabled={!isAvailable}
                            title={isAvailable ? m.sourceTitle : `No ${geoLevel} data`}
                            className={`rounded-lg px-2.5 py-1 text-xs font-medium transition disabled:cursor-not-allowed disabled:opacity-35 ${
                              isSelected
                                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                                : "bg-white text-slate-700 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                            }`}
                          >
                            {isSelected && <Check className="mr-1 inline-block h-3 w-3" />}
                            {m.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}
      </Surface>

      {rows.length > 0 && initialResult ? (
        <>
          {matrix && (
            <Surface className="p-4 sm:p-6">
              <h3 className="text-base font-semibold text-slate-950 dark:text-white">Correlation matrix</h3>
              <p className="mt-1 mb-4 text-sm text-slate-500">
                Pearson r for every pair, from −1 to +1. Click a cell to plot that pair.
              </p>
              <CorrelationMatrix
                labels={series.map((s) => s.label)}
                matrix={matrix}
                xi={axes.x}
                yi={axes.y}
                onSelect={chooseAxes}
              />
            </Surface>
          )}

          <div className="grid gap-6 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
            {plottable && xs && ys ? (
              <Surface className="min-w-0 p-4 sm:p-6">
                <div className="flex flex-wrap items-end gap-2">
                  {[
                    { label: "X axis", value: axes.x, set: (v: number) => chooseAxes(v, v === axes.y ? axes.x : axes.y) },
                    { label: "Y axis", value: axes.y, set: (v: number) => chooseAxes(v === axes.x ? axes.y : axes.x, v) },
                  ].map((a) => (
                    <label key={a.label} className="flex min-w-0 flex-1 flex-col gap-1 text-[11px] font-medium tracking-wide text-slate-500 uppercase">
                      {a.label}
                      <select
                        value={a.value}
                        onChange={(e) => a.set(Number(e.target.value))}
                        className="h-9 w-full min-w-0 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold tracking-normal text-slate-800 normal-case dark:border-slate-800 dark:bg-slate-950 dark:text-slate-200"
                      >
                        {series.map((s, i) => (
                          <option key={i} value={i}>
                            {s.label}
                            {s.period ? ` (${s.period})` : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                  <button
                    type="button"
                    aria-label="Swap axes"
                    title="Swap axes"
                    onClick={() => chooseAxes(axes.y, axes.x)}
                    className={buttonVariants({ variant: "outline", size: "sm" }) + " h-9 w-9 p-0"}
                  >
                    <ArrowLeftRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="mt-5 grid grid-cols-2 gap-4 border-y border-slate-100 py-4 sm:grid-cols-4 dark:border-slate-800">
                  <StatTile
                    label="Pearson r"
                    value={stats.r === null ? "—" : formatSigned(stats.r, "score")}
                    note={stats.r === null ? "not defined" : `${strength(stats.r)} ${stats.r >= 0 ? "positive" : "negative"}`}
                  />
                  <StatTile
                    label="r²"
                    value={stats.r === null ? "—" : `${Math.round(stats.r * stats.r * 100)}%`}
                    note="of Y's spread tracks X"
                  />
                  <StatTile
                    label="Spearman ρ"
                    value={stats.rho === null ? "—" : formatSigned(stats.rho, "score")}
                    note="rank order, outlier-resistant"
                  />
                  <StatTile label="Places" value={stats.n.toLocaleString("en-US")} note={`of ${rows.length.toLocaleString("en-US")} loaded`} />
                </div>
                {stats.fit && xStep && (
                  <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                    On the trend line, each <strong className="font-semibold">{formatValue(xStep, unit(axes.x))}</strong> more{" "}
                    {xs.label.toLowerCase()} goes with{" "}
                    <strong className="font-semibold">{formatSigned(stats.fit.slope * xStep, unit(axes.y))}</strong>{" "}
                    {ys.label.toLowerCase()}.
                  </p>
                )}

                <div className="mt-4">
                  <CompareScatter
                    key={`${axes.x}:${axes.y}`}
                    rows={rows}
                    xi={axes.x}
                    yi={axes.y}
                    x={xs}
                    y={ys}
                    stats={stats}
                    level={initialResult.level}
                    activeGeoid={activeGeoid}
                    onHover={(geoid) => setHover(geoid ? { geoid, from: "chart" } : null)}
                    onPick={(geoid) => setPinned((p) => (p === geoid ? null : geoid))}
                  />
                </div>
              </Surface>
            ) : (
              <Surface className="p-8 text-center text-sm text-slate-500">
                Add a second metric to plot how the two relate.
              </Surface>
            )}

            <Surface className="flex min-w-0 flex-col overflow-hidden xl:h-0 xl:min-h-full">
              <div className="flex items-center gap-2 border-b border-slate-200 p-3 dark:border-slate-800">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute top-1/2 left-2.5 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                  <input
                    type="search"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={county ? "Find a county or state (e.g. TX)" : "Find a state"}
                    className="h-9 w-full rounded-xl border border-slate-200 bg-white pr-3 pl-8 text-sm dark:border-slate-800 dark:bg-slate-950"
                  />
                </div>
                {pinned && (
                  <button type="button" onClick={() => setPinned(null)} className="shrink-0 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white">
                    Clear pin
                  </button>
                )}
              </div>
              <div ref={scrollRef} className="relative max-h-160 min-h-0 flex-1 overflow-auto xl:max-h-none">
                <table className="w-full text-left text-sm">
                  <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
                    <tr>
                      <th className="px-3 py-2.5 font-mono">#</th>
                      <th className="px-3 py-2.5">{header("name")}</th>
                      {county && <th className="px-3 py-2.5">State</th>}
                      {columnOrder.map((key) => (
                        <th key={String(key)} className="max-w-40 min-w-24 px-3 py-2.5 align-top">
                          {header(key)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {visibleRows.map((row, rIdx) => {
                      const active = row.geoid === activeGeoid;
                      return (
                        <tr
                          key={row.geoid}
                          data-geoid={row.geoid}
                          onPointerEnter={() => setHover({ geoid: row.geoid, from: "table" })}
                          onPointerLeave={() => setHover(null)}
                          onClick={() => setPinned((p) => (p === row.geoid ? null : row.geoid))}
                          className={`cursor-pointer transition ${
                            active
                              ? "bg-sky-50 dark:bg-sky-950/40"
                              : "hover:bg-slate-50 dark:hover:bg-slate-900/40"
                          } ${row.geoid === pinned ? "outline-2 -outline-offset-2 outline-sky-500" : ""}`}
                        >
                          <td className="px-3 py-2 font-mono text-xs text-slate-400">{rIdx + 1}</td>
                          <td className="px-3 py-2 font-medium whitespace-nowrap text-slate-900 dark:text-white">{row.name}</td>
                          {county && <td className="px-3 py-2 text-xs text-slate-500">{row.state ?? "—"}</td>}
                          {columnOrder.map((key) => {
                            if (key === "trend") {
                              const res = stats.residuals.get(row.geoid);
                              return (
                                <td key="trend" className="px-3 py-2 font-mono text-xs whitespace-nowrap text-slate-600 tabular-nums dark:text-slate-300">
                                  {res === undefined ? "—" : formatSigned(res, unit(axes.y))}
                                </td>
                              );
                            }
                            const val = row.values[key as number];
                            return (
                              <td
                                key={key}
                                className={`px-3 py-2 font-mono text-xs whitespace-nowrap tabular-nums ${
                                  plottable && (key === axes.x || key === axes.y)
                                    ? "text-slate-950 dark:text-white"
                                    : "text-slate-600 dark:text-slate-400"
                                }`}
                              >
                                {formatValue(val, unit(key as number))}
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
                {visibleRows.length === 0 && <p className="p-6 text-center text-sm text-slate-500">No places match “{query}”.</p>}
              </div>
              {sortedRows.length > visibleRows.length && (
                <p className="border-t border-slate-200 px-4 py-2.5 text-xs text-slate-500 dark:border-slate-800">
                  Showing {visibleRows.length.toLocaleString("en-US")} of {sortedRows.length.toLocaleString("en-US")} places. Search, re-sort, or
                  export CSV for the rest.
                </p>
              )}
            </Surface>
          </div>
        </>
      ) : (
        <Surface className="p-12 text-center text-slate-500">
          <SlidersHorizontal className="mx-auto mb-3 h-10 w-10 text-slate-400" />
          {initialResult && series.length > 0 ? (
            <>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                No {initialResult.level === "county" ? "county" : "state"} data for these metrics
              </h3>
              <p className="mt-1 text-sm">
                Switch the geography level, or add metrics that are available at this level (others are greyed out in the
                picker).
              </p>
            </>
          ) : (
            <>
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Choose metrics to compare</h3>
              <p className="mt-1 text-sm">
                Pick from {catalog.allMetrics.length.toLocaleString("en-US")} metrics across {datasetCount} datasets to rank,
                correlate, and compare states and counties.
              </p>
            </>
          )}
        </Surface>
      )}
    </div>
  );
}
