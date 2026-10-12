"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDown, ArrowUp, Download, Search, X } from "lucide-react";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import { useWidth } from "@/components/charts/use-width";
import { US_STATE_GRID, US_STATE_GRID_COLS, US_STATE_GRID_ROWS } from "@/lib/money/us-states";
import { formatSigned, formatValue, pctChange } from "@/lib/format";
import {
  CLEARED,
  FULL_COVERAGE,
  OFFENSES,
  offenseLabel,
  type ClearedKey,
  type OffenseKey,
  type StateCrimeData,
} from "@/lib/crime/offenses";
import type { StateDetail } from "@/lib/crime/offenses";
import { CitiesTable } from "./cities-table";
import { Chip } from "./segmented";

const STEPS = 7;
const TOTALS = new Set<string>(["violent_crime", "property_crime"]);
type SortKey = "rank" | "name" | "value" | "change" | "since" | "vsUs" | "cleared";

function quantileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: STEPS - 1 }, (_, i) => sorted[Math.floor(((i + 1) / STEPS) * (sorted.length - 1))]);
}

const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));

// Tile map, detail panel, state profile, and table for one offense at a
// time. Hovering previews a state; clicking a tile or a table row selects
// it and opens its profile, where a second state can be compared.
export function CrimeStateExplorer({
  data,
  year,
  priorYear,
  baseYear,
}: {
  data: StateCrimeData;
  year: string;
  priorYear: string;
  baseYear: string;
}) {
  const [metric, setMetric] = useState<OffenseKey>("violent_crime");
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string>("");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "rank", dir: 1 });
  const profileRef = useRef<HTMLDivElement>(null);
  const [mapRef, width] = useWidth<HTMLDivElement>();

  const i = data.years.indexOf(year);
  const j = data.years.indexOf(priorYear);
  const b = data.years.indexOf(baseYear);
  const usNow = data.us[metric][i];
  const clearedKey = (CLEARED as readonly string[]).includes(metric) ? (metric as ClearedKey) : null;

  const rows = useMemo(() => {
    const base = data.rows.map((r) => {
      const s = r.rates[metric];
      const value = s[i];
      return {
        abbr: r.abbr,
        name: r.name,
        value,
        change: pctChange(value, j >= 0 ? s[j] : null),
        since: pctChange(value, b >= 0 ? s[b] : null),
        vsUs: pctChange(value, usNow),
        cleared: clearedKey ? r.cleared[clearedKey] : null,
        coverage: r.coverage[i],
        rank: 0,
      };
    });
    const ranked = base.filter((r) => r.value !== null).sort((x, y) => y.value! - x.value!);
    ranked.forEach((r, k) => (r.rank = k + 1));
    return base;
  }, [data, metric, i, j, b, usNow, clearedKey]);
  const byAbbr = useMemo(() => new Map(rows.map((r) => [r.abbr, r])), [rows]);
  const rankedCount = rows.filter((r) => r.rank).length;

  const present = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const breaks = present.length ? quantileBreaks(present) : [];
  const step = (v: number) => breaks.filter((x) => v > x).length + 1;

  const gap = 3;
  const cell = Math.min(52, Math.floor((width - gap * (US_STATE_GRID_COLS - 1)) / US_STATE_GRID_COLS));
  const mapW = cell * US_STATE_GRID_COLS + gap * (US_STATE_GRID_COLS - 1);
  const mapH = cell * US_STATE_GRID_ROWS + gap * (US_STATE_GRID_ROWS - 1);

  const select = (abbr: string | null, scroll = false) => {
    setSelected(abbr);
    if (abbr === compare) setCompare("");
    if (abbr && scroll) requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const q = query.trim().toLowerCase();
  const tableRows = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.abbr.toLowerCase() === q)
    .sort((x, y) => {
      if (sort.key === "name") return x.name.localeCompare(y.name) * sort.dir;
      const av = sort.key === "rank" ? x.rank || Infinity : (x[sort.key] ?? -Infinity);
      const bv = sort.key === "rank" ? y.rank || Infinity : (y[sort.key] ?? -Infinity);
      return (av - bv) * sort.dir;
    });

  const focus = (hover && byAbbr.get(hover)) || (selected && byAbbr.get(selected)) || null;
  const label = offenseLabel(metric);

  const downloadCsv = () => {
    const header = ["state", "abbr", ...OFFENSES.flatMap((o) => data.years.map((y) => `${o.key}_rate_${y}`)), ...data.years.map((y) => `coverage_${y}`), ...CLEARED.map((k) => `${k}_cleared_pct_${year}`)];
    const lines = data.rows.map((r) =>
      [
        `"${r.name}"`,
        r.abbr,
        ...OFFENSES.flatMap((o) => r.rates[o.key].map((v) => v ?? "")),
        ...r.coverage.map((v) => v ?? ""),
        ...CLEARED.map((k) => r.cleared[k] ?? ""),
      ].join(","),
    );
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `worldview-crime-by-state-${data.years[0]}-${year}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const headers: { key: SortKey; label: string; hint?: string }[] = [
    { key: "rank", label: "Rank" },
    { key: "name", label: "State" },
    { key: "value", label: "Rate", hint: `${year}, per 100,000` },
    { key: "change", label: "1-year change", hint: `vs ${priorYear}` },
    { key: "since", label: `Since ${baseYear}` },
    { key: "vsUs", label: "vs U.S.", hint: `U.S. ${formatValue(usNow, "per_100k")}` },
    ...(clearedKey ? [{ key: "cleared" as const, label: "Cleared", hint: "share of offenses" }] : []),
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Offense">
        {OFFENSES.map((o) => (
          <Chip key={o.key} active={o.key === metric} onClick={() => setMetric(o.key)}>
            {o.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,41rem)_minmax(16rem,22rem)]">
        <div ref={mapRef} className="min-w-0 space-y-3">
          <svg width={mapW} height={mapH} role="img" aria-label={`${label} rate by state`} className="block max-w-full">
            {US_STATE_GRID.map((c) => {
              const r = byAbbr.get(c.abbr);
              const v = r?.value;
              const s = v === null || v === undefined ? 0 : step(v);
              const x = c.col * (cell + gap);
              const y = c.row * (cell + gap);
              const isSel = selected === c.abbr || compare === c.abbr;
              return (
                <g
                  key={c.abbr}
                  tabIndex={0}
                  role="button"
                  aria-label={`${c.name}: ${formatValue(v, "per_100k")}`}
                  aria-pressed={selected === c.abbr}
                  onPointerEnter={() => setHover(c.abbr)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(c.abbr)}
                  onBlur={() => setHover(null)}
                  onClick={() => select(selected === c.abbr ? null : c.abbr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(selected === c.abbr ? null : c.abbr);
                    }
                  }}
                  className="cursor-pointer outline-none"
                >
                  <rect
                    x={x + (isSel ? 1.5 : 0)}
                    y={y + (isSel ? 1.5 : 0)}
                    width={cell - (isSel ? 3 : 0)}
                    height={cell - (isSel ? 3 : 0)}
                    rx={4}
                    fill={s ? `var(--viz-seq-${s})` : "var(--viz-empty)"}
                    stroke={isSel ? "var(--viz-series-2)" : hover === c.abbr ? "var(--viz-muted)" : "none"}
                    strokeWidth={isSel ? 3 : 2}
                  />
                  <text
                    x={x + cell / 2}
                    y={y + cell / 2}
                    dy="0.35em"
                    textAnchor="middle"
                    className="pointer-events-none text-[11px] font-semibold"
                    style={{ fill: s ? `var(--viz-seq-ink-${s})` : "var(--viz-muted)" }}
                  >
                    {c.abbr}
                  </text>
                </g>
              );
            })}
          </svg>
          {breaks.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
              <span>{formatValue(Math.min(...present), "per_100k")}</span>
              <span className="flex">
                {Array.from({ length: STEPS }, (_, k) => (
                  <span key={k} className="h-2.5 w-6 first:rounded-l last:rounded-r" style={{ background: `var(--viz-seq-${k + 1})` }} />
                ))}
              </span>
              <span>{formatValue(Math.max(...present), "per_100k")}</span>
              <span className="text-slate-400">· shades split states into sevenths by rank · click a state for its profile</span>
            </div>
          )}
        </div>

        <aside className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800" aria-live="polite">
          {focus ? (
            <>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label} rate</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{focus.name}</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">
                {formatValue(focus.value, "per_100k")}
              </p>
              <p className="text-xs text-slate-500 dark:text-slate-400">per 100,000 in {year}</p>
              <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                <dt className="text-slate-500 dark:text-slate-400">Rank</dt>
                <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">
                  {focus.rank ? `#${focus.rank} of ${rankedCount}` : "—"}
                </dd>
                <dt className="text-slate-500 dark:text-slate-400">vs {priorYear}</dt>
                <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(focus.change)}</dd>
                <dt className="text-slate-500 dark:text-slate-400">Since {baseYear}</dt>
                <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(focus.since)}</dd>
                <dt className="text-slate-500 dark:text-slate-400">vs U.S. rate</dt>
                <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(focus.vsUs)}</dd>
                {clearedKey && (
                  <>
                    <dt className="text-slate-500 dark:text-slate-400">Cleared</dt>
                    <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(focus.cleared, "percent")}</dd>
                  </>
                )}
              </dl>
              {focus.coverage !== null && focus.coverage < FULL_COVERAGE && (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  † Agencies covering {formatValue(focus.coverage, "percent")} of residents reported in {year}, so this rate understates the full state.
                </p>
              )}
              {selected !== focus.abbr && <p className="mt-3 text-xs text-slate-400">Click to open the profile.</p>}
            </>
          ) : (
            <>
              <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{label} rate</p>
              <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">United States</p>
              <p className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue(usNow, "per_100k")}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">per 100,000 in {year}</p>
              <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
                Hover a state to compare it with the nation; click one to open its profile.
              </p>
            </>
          )}
        </aside>
      </div>

      {selected && byAbbr.get(selected) && (
        <div ref={profileRef} className="scroll-mt-24">
          <StateProfile
            data={data}
            abbr={selected}
            compare={compare}
            setCompare={setCompare}
            metric={metric}
            year={year}
            priorYear={priorYear}
            onClose={() => select(null)}
          />
        </div>
      )}

      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <label className="relative block w-full max-w-xs">
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a state"
              aria-label="Find a state"
              className="w-full rounded-full border border-slate-200 bg-transparent py-1.5 pr-3 pl-9 text-sm outline-none focus:border-slate-400 dark:border-slate-700"
            />
          </label>
          <button
            type="button"
            onClick={downloadCsv}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
          >
            <Download className="size-3.5" /> Download CSV (all offenses, {data.years[0]}–{year})
          </button>
        </div>
        <div className="max-h-[32rem] overflow-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[44rem] text-sm">
            <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
              <tr>
                {headers.map((h) => (
                  <th key={h.key} className={`px-3 py-2 align-bottom font-medium ${h.key === "name" ? "text-left" : "text-right"}`}>
                    <button
                      type="button"
                      onClick={() =>
                        setSort((s) => ({
                          key: h.key,
                          dir: s.key === h.key ? ((-s.dir) as 1 | -1) : h.key === "name" || h.key === "rank" ? 1 : -1,
                        }))
                      }
                      className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                    >
                      {h.label}
                      {sort.key === h.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                    </button>
                    {h.hint && <span className="block font-normal text-slate-400">{h.hint}</span>}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {tableRows.map((r) => (
                <tr
                  key={r.abbr}
                  onClick={() => select(r.abbr, true)}
                  onPointerEnter={() => setHover(r.abbr)}
                  onPointerLeave={() => setHover(null)}
                  className={`cursor-pointer ${selected === r.abbr ? "bg-blue-50 dark:bg-blue-950/40" : "hover:bg-slate-50 dark:hover:bg-slate-900/60"}`}
                >
                  <td className="px-3 py-1.5 text-right text-slate-400 tabular-nums">{r.rank || "—"}</td>
                  <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                    <button type="button" className="text-left hover:underline" onClick={(e) => (e.stopPropagation(), select(r.abbr, true))}>
                      {r.name}
                    </button>
                    {r.coverage !== null && r.coverage < FULL_COVERAGE && (
                      <span className="ml-1 text-slate-400" title={`Partial reporting: ${formatValue(r.coverage, "percent")} of residents covered`}>
                        †
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-1.5 text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(r.value, "per_100k")}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{signed(r.change)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{signed(r.since)}</td>
                  <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{signed(r.vsUs)}</td>
                  {clearedKey && <td className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">{formatValue(r.cleared, "percent")}</td>}
                </tr>
              ))}
              {!tableRows.length && (
                <tr>
                  <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-400">
                    No state matches “{query}”.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">† Agencies covering under {FULL_COVERAGE}% of the state&apos;s residents reported in {year}; the rate counts only their offenses.</p>
      </div>
    </div>
  );
}

function StateProfile({
  data,
  abbr,
  compare,
  setCompare,
  metric,
  year,
  priorYear,
  onClose,
}: {
  data: StateCrimeData;
  abbr: string;
  compare: string;
  setCompare: (v: string) => void;
  metric: OffenseKey;
  year: string;
  priorYear: string;
  onClose: () => void;
}) {
  const row = data.rows.find((r) => r.abbr === abbr)!;
  const other = compare ? data.rows.find((r) => r.abbr === compare) : undefined;
  const i = data.years.indexOf(year);
  const j = data.years.indexOf(priorYear);
  const pts = (s: (number | null)[]) =>
    data.years.flatMap((y, k) => (s[k] === null ? [] : [{ x: Number(y), label: y, value: s[k]! }]));

  const series: Series[] = [
    { id: row.abbr, label: row.name, slot: 1, points: pts(row.rates[metric]) },
    ...(other ? [{ id: other.abbr, label: other.name, slot: 2 as const, points: pts(other.rates[metric]) }] : []),
    { id: "US", label: "United States", slot: 3, points: pts(data.us[metric]) },
  ];
  const partial = (r: typeof row) =>
    data.years.flatMap((y, k) =>
      r.coverage[k] !== null && r.coverage[k]! < FULL_COVERAGE ? [`${y} (${formatValue(r.coverage[k], "percent")})`] : [],
    );
  const notes = [row, ...(other ? [other] : [])].flatMap((r) => (partial(r).length ? [`${r.name}: ${partial(r).join(", ")}`] : []));

  const cell = "px-3 py-1.5 text-right tabular-nums";
  return (
    <section className="rounded-2xl border border-slate-300 p-5 dark:border-slate-700" aria-label={`${row.name} profile`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">State profile</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{row.name}</h3>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs text-slate-500 dark:text-slate-400">
            Compare with{" "}
            <select
              value={compare}
              onChange={(e) => setCompare(e.target.value)}
              className="ml-1 rounded-full border border-slate-200 bg-transparent px-2 py-1 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200"
            >
              <option value="">U.S. only</option>
              {data.rows
                .filter((r) => r.abbr !== abbr)
                .map((r) => (
                  <option key={r.abbr} value={r.abbr}>
                    {r.name}
                  </option>
                ))}
            </select>
          </label>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close profile"
            className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      <div className="mt-5 grid gap-6 lg:grid-cols-2">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">{offenseLabel(metric)} rate, per 100,000</p>
          <div className="mt-3">
            <TimeSeriesChart series={series} unit="per_100k" height={260} endLabels={false} />
          </div>
          {notes.length > 0 && (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
              Partial reporting (share of residents covered) — {notes.join("; ")}.
            </p>
          )}
        </div>
        <div className="min-w-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2 text-left font-medium">{year}, per 100,000</th>
                <th className="px-3 py-2 text-right font-medium">{row.abbr}</th>
                <th className="px-3 py-2 text-right font-medium">vs {priorYear}</th>
                {other && <th className="px-3 py-2 text-right font-medium">{other.abbr}</th>}
                <th className="px-3 py-2 text-right font-medium">U.S.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {OFFENSES.map((o) => (
                <tr key={o.key} className={o.key === metric ? "font-medium" : ""}>
                  <td className={`py-1.5 pr-3 text-slate-700 dark:text-slate-200 ${TOTALS.has(o.key) ? "pl-3" : "pl-6"}`}>
                    {o.label}
                  </td>
                  <td className={`${cell} text-slate-900 dark:text-white`}>{formatValue(row.rates[o.key][i], "per_100k")}</td>
                  <td className={`${cell} text-slate-500 dark:text-slate-400`}>
                    {signed(pctChange(row.rates[o.key][i], j >= 0 ? row.rates[o.key][j] : null))}
                  </td>
                  {other && <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(other.rates[o.key][i], "per_100k")}</td>}
                  <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(data.us[o.key][i], "per_100k")}</td>
                </tr>
              ))}
              {CLEARED.map((k) => (
                <tr key={k}>
                  <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{offenseLabel(k)} cleared</td>
                  <td className={`${cell} text-slate-900 dark:text-white`}>{formatValue(row.cleared[k], "percent")}</td>
                  <td className={cell} />
                  {other && <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(other.cleared[k], "percent")}</td>}
                  <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(data.usCleared[k], "percent")}</td>
                </tr>
              ))}
              {data.extra && (
                <>
                  <ExtraRow
                    label={`Homicide deaths, ${data.extra.cdcYear} (CDC)`}
                    pick={(e) => e.homicideDeaths}
                    unit="per_100k"
                    data={data}
                    abbr={row.abbr}
                    other={other?.abbr}
                    cell={cell}
                  />
                  <ExtraRow
                    label={`Firearm homicide deaths, ${data.extra.cdcYear} (CDC)`}
                    pick={(e) => e.firearmHomicide}
                    unit="per_100k"
                    data={data}
                    abbr={row.abbr}
                    other={other?.abbr}
                    cell={cell}
                  />
                  <ExtraRow
                    label={`Hate crime incidents, ${data.extra.hateYear}`}
                    pick={(e) => e.hateIncidents}
                    unit="incidents"
                    data={data}
                    abbr={row.abbr}
                    other={other?.abbr}
                    cell={cell}
                  />
                </>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <LocalDetail abbr={row.abbr} name={row.name} year={year} />
    </section>
  );
}

function ExtraRow({
  label,
  pick,
  unit,
  data,
  abbr,
  other,
  cell,
}: {
  label: string;
  pick: (e: NonNullable<StateCrimeData["extra"]>["us"]) => number | null;
  unit: string;
  data: StateCrimeData;
  abbr: string;
  other?: string;
  cell: string;
}) {
  const x = data.extra!;
  return (
    <tr>
      <td className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{label}</td>
      <td className={`${cell} text-slate-900 dark:text-white`}>{formatValue(x.byState[abbr] ? pick(x.byState[abbr]) : null, unit)}</td>
      <td className={cell} />
      {other && <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(x.byState[other] ? pick(x.byState[other]) : null, unit)}</td>}
      <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(pick(x.us), unit)}</td>
    </tr>
  );
}

// Cities and counties inside the selected state, fetched when it opens.
function LocalDetail({ abbr, name, year }: { abbr: string; name: string; year: string }) {
  const [detail, setDetail] = useState<{ abbr: string; data: StateDetail | null } | null>(null);
  const [allCounties, setAllCounties] = useState(false);
  useEffect(() => {
    let live = true;
    fetch(`/api/crime/states/${abbr}?year=${year}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: StateDetail | null) => live && setDetail({ abbr, data }))
      .catch(() => live && setDetail({ abbr, data: null }));
    return () => {
      live = false;
    };
  }, [abbr, year]);

  if (!detail || detail.abbr !== abbr) return <p className="mt-6 text-sm text-slate-400">Loading cities and counties…</p>;
  const d = detail.data;
  if (!d) return null;
  // Counties with too few deaths for a stable rate sink to the bottom.
  const counties = [...d.counties].sort((a, b) => Number(a.unreliable) - Number(b.unreliable) || (b.homicide ?? 0) - (a.homicide ?? 0));
  const shown = allCounties ? counties : counties.slice(0, 10);

  return (
    <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
      <div className="min-w-0">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Cities over 100,000 in {name}</p>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Each city&apos;s own police department, FBI data</p>
        <CitiesTable rows={d.cities} year={year} compact />
      </div>
      {counties.length > 0 && (
        <div className="min-w-0">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Homicide by county, {d.countyYear}</p>
          <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Deaths per 100,000 residents, from CDC death records</p>
          <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 text-left font-medium">County</th>
                  <th className="px-3 py-2 text-right font-medium">Homicide</th>
                  <th className="px-3 py-2 text-right font-medium">By firearm</th>
                  <th className="px-3 py-2 text-right font-medium">Deaths</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {shown.map((c) => (
                  <tr key={c.fips} className={c.unreliable ? "text-slate-400" : ""}>
                    <td className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                      {c.name}
                      {c.unreliable && <span title="Fewer than 10 deaths; the rate is unstable"> *</span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatValue(c.homicide, "per_100k")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatValue(c.firearmHomicide, "per_100k")}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.deaths === null ? "1–9" : formatValue(c.deaths, "deaths")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-400">
            <span>* Fewer than 10 deaths, so the rate is unstable.</span>
            {counties.length > 10 && (
              <button type="button" onClick={() => setAllCounties((v) => !v)} className="font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
                {allCounties ? "Show top 10" : `Show all ${counties.length}`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
