"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Download, X } from "lucide-react";
import { TimeSeriesChart, type Series } from "@/components/charts/time-series-chart";
import type { StatePath } from "@/lib/geo/state-paths";
import { formatSigned, formatValue, pctChange } from "@/lib/format";
import {
  CLEARED,
  FULL_COVERAGE,
  OFFENSES,
  offenseLabel,
  type CityRow,
  type ClearedKey,
  type OffenseKey,
  type StateCrimeData,
} from "@/lib/crime/offenses";
import type { StateDetail } from "@/lib/crime/offenses";
import { CitiesTable } from "./cities-table";
import { Chip } from "./segmented";

const STEPS = 7;
const TOTALS = new Set<string>(["violent_crime", "property_crime"]);

function quantileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: STEPS - 1 }, (_, i) => sorted[Math.floor(((i + 1) / STEPS) * (sorted.length - 1))]);
}

const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));

// Marker radius in map units: area grows with population.
const cityRadius = (pop: number | null) => 2.2 + Math.sqrt((pop ?? 100_000) / 1_000_000) * 5;

// U.S. map, detail panel, and state profile for one offense at a time.
// States are shaded by rate; each large city's police department is a
// marker where the city is. Hovering previews a state or a city; clicking a
// state opens its profile, clicking a city shows its numbers in the panel.
export function CrimeStateExplorer({
  data,
  year,
  priorYear,
  baseYear,
  map,
  cities,
  cityPoints,
}: {
  data: StateCrimeData;
  year: string;
  priorYear: string;
  baseYear: string;
  map: { width: number; height: number; states: StatePath[] };
  cities: CityRow[];
  cityPoints: Record<string, [number, number]>;
}) {
  const [metric, setMetric] = useState<OffenseKey>("violent_crime");
  const [hover, setHover] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [compare, setCompare] = useState<string>("");
  const [hoverCity, setHoverCity] = useState<string | null>(null);
  const [city, setCity] = useState<string | null>(null);
  const [showCities, setShowCities] = useState(cities.length > 0);
  const profileRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<HTMLDivElement>(null);

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

  const cityByOri = useMemo(() => new Map(cities.map((c) => [c.ori, c])), [cities]);
  // Largest first, so small cities draw on top and stay clickable.
  const markers = useMemo(
    () => cities.filter((c) => cityPoints[c.ori]).sort((a, b) => (b.population ?? 0) - (a.population ?? 0)),
    [cities, cityPoints],
  );

  const select = (abbr: string | null, scroll = false) => {
    setSelected(abbr);
    setCity(null);
    if (abbr === compare) setCompare("");
    if (abbr && scroll) requestAnimationFrame(() => profileRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  const pickCity = (ori: string | null, scroll = false) => {
    setCity(ori);
    if (ori && scroll) requestAnimationFrame(() => mapRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };
  const focusCity = (hoverCity && cityByOri.get(hoverCity)) || (!hover && city && cityByOri.get(city)) || null;
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2" role="group" aria-label="Offense">
        {OFFENSES.map((o) => (
          <Chip key={o.key} active={o.key === metric} onClick={() => setMetric(o.key)}>
            {o.label}
          </Chip>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,20rem)]">
        <div ref={mapRef} className="min-w-0 scroll-mt-24 space-y-3">
          <svg viewBox={`0 0 ${map.width} ${map.height}`} role="img" aria-label={`${label} rate by state`} className="block h-auto w-full">
            {map.states.map((st) => {
              const v = byAbbr.get(st.abbr)?.value;
              const s = v === null || v === undefined ? 0 : step(v);
              const isSel = selected === st.abbr || compare === st.abbr;
              return (
                <path
                  key={st.abbr}
                  d={st.d}
                  tabIndex={0}
                  role="button"
                  aria-label={`${st.name}: ${formatValue(v, "per_100k")}`}
                  aria-pressed={selected === st.abbr}
                  onPointerEnter={() => setHover(st.abbr)}
                  onPointerLeave={() => setHover(null)}
                  onFocus={() => setHover(st.abbr)}
                  onBlur={() => setHover(null)}
                  onClick={() => select(selected === st.abbr ? null : st.abbr)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      select(selected === st.abbr ? null : st.abbr);
                    }
                  }}
                  className="cursor-pointer"
                  style={{
                    fill: s ? `var(--viz-seq-${s})` : "var(--viz-empty)",
                    stroke: isSel ? "var(--viz-series-2)" : hover === st.abbr ? "var(--viz-muted)" : "var(--viz-surface)",
                    strokeWidth: isSel ? 2.5 : hover === st.abbr ? 2 : 1,
                    strokeLinejoin: "round",
                    outline: "none",
                  }}
                />
              );
            })}
            {/* Selected and hovered outlines on top of their neighbors */}
            {map.states
              .filter((st) => st.abbr === selected || st.abbr === compare || st.abbr === hover)
              .map((st) => (
                <path
                  key={`edge-${st.abbr}`}
                  d={st.d}
                  pointerEvents="none"
                  style={{
                    fill: "none",
                    stroke: st.abbr === hover && st.abbr !== selected && st.abbr !== compare ? "var(--viz-muted)" : "var(--viz-series-2)",
                    strokeWidth: st.abbr === hover && st.abbr !== selected && st.abbr !== compare ? 2 : 2.5,
                    strokeLinejoin: "round",
                  }}
                />
              ))}
            {!showCities &&
              map.states.map((st) => {
                if (!st.label) return null;
                const v = byAbbr.get(st.abbr)?.value;
                const s = v === null || v === undefined ? 0 : step(v);
                return (
                  <text
                    key={`label-${st.abbr}`}
                    x={st.label[0]}
                    y={st.label[1]}
                    textAnchor="middle"
                    dominantBaseline="central"
                    pointerEvents="none"
                    className="text-[13px] font-semibold"
                    style={{ fill: s ? `var(--viz-seq-ink-${s})` : "var(--viz-muted)" }}
                  >
                    {st.abbr}
                  </text>
                );
              })}
            {showCities &&
              markers.map((c) => {
                const [x, y] = cityPoints[c.ori];
                const on = city === c.ori || hoverCity === c.ori;
                return (
                  <circle
                    key={c.ori}
                    cx={x}
                    cy={y}
                    r={cityRadius(c.population) + (on ? 1.5 : 0)}
                    onPointerEnter={() => setHoverCity(c.ori)}
                    onPointerLeave={() => setHoverCity(null)}
                    onClick={() => pickCity(city === c.ori ? null : c.ori)}
                    className="cursor-pointer"
                    style={{
                      fill: "var(--viz-series-2)",
                      fillOpacity: on ? 1 : 0.75,
                      stroke: on ? "var(--foreground)" : "var(--viz-surface)",
                      strokeWidth: on ? 2 : 0.8,
                    }}
                  >
                    <title>{`${c.name}, ${c.state}`}</title>
                  </circle>
                );
              })}
            {/* The chosen city again, above every other marker */}
            {showCities && city && cityPoints[city] && (
              <circle
                cx={cityPoints[city][0]}
                cy={cityPoints[city][1]}
                r={cityRadius(cityByOri.get(city)?.population ?? null) + 1.5}
                pointerEvents="none"
                style={{ fill: "var(--viz-series-2)", stroke: "var(--foreground)", strokeWidth: 2 }}
              />
            )}
          </svg>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
            {breaks.length > 0 && (
              <>
                <span>{formatValue(Math.min(...present), "per_100k")}</span>
                <span className="flex">
                  {Array.from({ length: STEPS }, (_, k) => (
                    <span key={k} className="h-2.5 w-6 first:rounded-l last:rounded-r" style={{ background: `var(--viz-seq-${k + 1})` }} />
                  ))}
                </span>
                <span>{formatValue(Math.max(...present), "per_100k")}</span>
                <span className="text-slate-400">· state shades split states into sevenths by rank</span>
              </>
            )}
            {cities.length > 0 && (
              <label className="ml-auto inline-flex cursor-pointer items-center gap-1.5">
                <input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} className="accent-orange-600" />
                <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--viz-series-2)" }} aria-hidden />
                Cities over 100,000, sized by population
              </label>
            )}
          </div>
        </div>

        <aside className="rounded-2xl border border-slate-200 p-4 text-sm dark:border-slate-800" aria-live="polite">
          {focusCity ? (
            <CityCard
              c={focusCity}
              cities={cities}
              year={year}
              usViolent={data.us.violent_crime[i]}
              stateViolent={data.rows.find((r) => r.abbr === focusCity.state)?.rates.violent_crime[i] ?? null}
              stateName={byAbbr.get(focusCity.state)?.name ?? focusCity.state}
              pinned={city === focusCity.ori}
              onClose={() => pickCity(null)}
              onState={() => select(focusCity.state, true)}
            />
          ) : focus ? (
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
                Hover a state to compare it with the nation; click one to open its profile. Click a city marker for its police department&apos;s
                numbers.
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

      <button
        type="button"
        onClick={downloadCsv}
        className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-400 dark:border-slate-700 dark:text-slate-300"
      >
        <Download className="size-3.5" /> Download CSV (all states and offenses, {data.years[0]}–{year})
      </button>
    </div>
  );
}

function CityCard({
  c,
  cities,
  year,
  usViolent,
  stateViolent,
  stateName,
  pinned,
  onClose,
  onState,
}: {
  c: CityRow;
  cities: CityRow[];
  year: string;
  usViolent: number | null;
  stateViolent: number | null;
  stateName: string;
  pinned: boolean;
  onClose: () => void;
  onState: () => void;
}) {
  const rank = (key: "violent" | "murder" | "property") => {
    const v = c[key];
    if (v === null) return null;
    const ranked = cities.filter((x) => x[key] !== null);
    return { n: ranked.filter((x) => x[key]! > v).length + 1, of: ranked.length };
  };
  const rows: { label: string; key: "violent" | "murder" | "property" }[] = [
    { label: "Violent crime", key: "violent" },
    { label: "Murder", key: "murder" },
    { label: "Property crime", key: "property" },
  ];
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">City police department</p>
          <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
            {c.name}, {c.state}
            {c.partial && (
              <span className="ml-1 text-slate-400" title={`Incomplete data for ${year}`}>
                †
              </span>
            )}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{formatValue(c.population, "people")} residents served</p>
        </div>
        {pinned && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close city"
            className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-3 text-3xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue(c.violent, "per_100k")}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">violent crimes per 100,000 in {year}</p>
      <dl className="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs">
        {rows.map((r) => {
          const k = rank(r.key);
          return (
            <div key={r.key} className="contents">
              <dt className="text-slate-500 dark:text-slate-400">{r.label}</dt>
              <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(c[r.key], "per_100k")}</dd>
              <dd className="text-right text-slate-400 tabular-nums">{k ? `#${k.n} of ${k.of}` : ""}</dd>
            </div>
          );
        })}
        <dt className="text-slate-500 dark:text-slate-400">Violent, 1-year</dt>
        <dd className="col-span-2 text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(c.violentChange)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Violent vs {stateName}</dt>
        <dd className="col-span-2 text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(pctChange(c.violent, stateViolent))}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Violent vs U.S.</dt>
        <dd className="col-span-2 text-right font-medium text-slate-900 tabular-nums dark:text-white">{signed(pctChange(c.violent, usViolent))}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Police staff per 1,000</dt>
        <dd className="col-span-2 text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(c.staffing, "per_1000")}</dd>
      </dl>
      {c.partial && (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          † The department reported incomplete data for {year} — missing months, or far fewer offenses than its usual year.
        </p>
      )}
      {pinned ? (
        <button type="button" onClick={onState} className="mt-4 text-xs font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
          Open the {stateName} profile
        </button>
      ) : (
        <p className="mt-3 text-xs text-slate-400">Click the marker to keep this open.</p>
      )}
    </>
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
