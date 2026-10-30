"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ArrowLeft, Info, Pause, Play, RotateCcw, X } from "lucide-react";
import type { StatePath } from "@/lib/geo/state-paths";
import type { CrimeData } from "@/lib/crime/data";
import { formatSigned, formatValue, pctChange } from "@/lib/format";
import { CLEARED, FULL_COVERAGE, OFFENSES, offenseLabel, type CityRow, type ClearedKey, type OffenseKey, type OffenseTrend, type StateCrimeData } from "@/lib/crime/offenses";
import { useWidth } from "@/components/charts/use-width";
import { AtlasTrend, type TrendLine } from "./atlas-trend";
import { Segmented } from "./segmented";
import { useCrimeSelection, type Measure } from "./selection";
import { StateBreakdown } from "./state-breakdown";

type Box = [number, number, number, number];
type Prelim = NonNullable<CrimeData["prelim"]>;

const STEPS = 7;
const CHANGE_STEPS = [2.5, 5, 10, 20]; // percent; past the last is the darkest shade
const COVERAGE_STEPS = [50, 60, 70, 80, 90, 95];
// The city figures loaded for each offense; the rest have no city series.
const CITY_KEY: Partial<Record<OffenseKey, "violent" | "murder" | "property">> = {
  violent_crime: "violent",
  homicide: "murder",
  property_crime: "property",
};
const MEASURE_LABEL: Record<Measure, string> = { rate: "Rate per 100,000", change: "1-year change", coverage: "Reporting coverage" };

const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));
const cityRadius = (pop: number | null) => 2.2 + Math.sqrt((pop ?? 100_000) / 1_000_000) * 5;

function quantileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  return Array.from({ length: STEPS - 1 }, (_, i) => sorted[Math.floor(((i + 1) / STEPS) * (sorted.length - 1))]);
}

// Diverging shade for a percent change: blue falls, orange rises.
function changeFill(v: number) {
  const step = CHANGE_STEPS.filter((t) => Math.abs(v) > t).length;
  const mix = [18, 34, 52, 72, 92][step];
  return `color-mix(in oklab, var(${v < 0 ? "--viz-series-1" : "--viz-series-2"}) ${mix}%, var(--viz-empty))`;
}

// The Crime Atlas: offense × geography × year. The map, the inspector, the
// trend chart, and the state breakdown all follow one shared selection.
export function CrimeAtlas({
  data,
  offenses,
  flaggedYears,
  prelim,
  map,
  cities,
  cityPoints,
  sources,
}: {
  data: StateCrimeData;
  offenses: OffenseTrend[];
  flaggedYears: { year: string; coverage: number | null }[];
  prelim: CrimeData["prelim"];
  map: { width: number; height: number; states: StatePath[] };
  cities: CityRow[];
  cityPoints: Record<string, [number, number]>;
  sources?: ReactNode;
}) {
  const sel = useCrimeSelection();
  const { offense, measure, prelim: isPrelim } = sel;
  const years = data.years;
  const latestYear = years.at(-1)!;
  const year = isPrelim ? latestYear : sel.year;
  const i = years.indexOf(year);
  const flagged = useMemo(() => new Set(flaggedYears.map((f) => f.year)), [flaggedYears]);

  const [hover, setHover] = useState<string | null>(null);
  const [hoverCity, setHoverCity] = useState<string | null>(null);
  const [showCities, setShowCities] = useState(cities.length > 0);
  const [zoomBox, setZoomBox] = useState<Box | null>(null);
  const [playing, setPlaying] = useState(false);

  // ---- Values for the map ----
  const valueOf = (rates: (number | null)[], coverage: (number | null)[]) =>
    measure === "coverage" ? coverage[i] : measure === "change" ? pctChange(rates[i], i > 0 ? rates[i - 1] : null) : rates[i];
  const rows = useMemo(() => {
    const base = data.rows.map((r) => ({ abbr: r.abbr, name: r.name, rate: r.rates[offense][i], value: valueOf(r.rates[offense], r.coverage), rank: 0 }));
    base
      .filter((r) => r.rate !== null)
      .sort((a, b) => b.rate! - a.rate!)
      .forEach((r, k) => (r.rank = k + 1));
    return base;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, offense, i, measure]);
  const byAbbr = useMemo(() => new Map(rows.map((r) => [r.abbr, r])), [rows]);
  const present = rows.map((r) => r.value).filter((v): v is number => v !== null);
  const breaks = measure === "rate" && present.length ? quantileBreaks(present) : [];
  // Sequential step (1–7) for rate and coverage; 0 for none.
  const stepOf = (v: number | null | undefined) => {
    if (isPrelim || v === null || v === undefined || measure === "change") return 0;
    return measure === "coverage" ? COVERAGE_STEPS.filter((t) => v >= t).length + 1 : breaks.filter((x) => v > x).length + 1;
  };
  const fillOf = (v: number | null | undefined) => {
    if (isPrelim || v === null || v === undefined) return "var(--viz-empty)";
    if (measure === "change") return changeFill(v);
    return `var(--viz-seq-${stepOf(v)})`;
  };

  // ---- Cities: agency data loaded for the latest year only ----
  const citiesOn = showCities && !isPrelim && year === latestYear && cities.length > 0;
  const cityByOri = useMemo(() => new Map(cities.map((c) => [c.ori, c])), [cities]);
  const markers = useMemo(() => cities.filter((c) => cityPoints[c.ori]).sort((a, b) => (b.population ?? 0) - (a.population ?? 0)), [cities, cityPoints]);
  const city = sel.city ? (cityByOri.get(sel.city) ?? null) : null;

  // ---- Zoom: to the selected state, or to a city cluster ----
  const full: Box = [0, 0, map.width, map.height];
  const pathRefs = useRef(new Map<string, SVGPathElement>());
  const [vb, setVb] = useState<Box>(full);
  const vbRef = useRef<Box>(full);
  const fit = (b: { x: number; y: number; width: number; height: number }): Box => {
    const pad = Math.max(b.width, b.height) * 0.15;
    let w = Math.max(b.width + pad * 2, map.width / 8);
    let h = Math.max(b.height + pad * 2, map.height / 8);
    if (w / h > map.width / map.height) h = (w * map.height) / map.width;
    else w = (h * map.width) / map.height;
    return [b.x + b.width / 2 - w / 2, b.y + b.height / 2 - h / 2, w, h];
  };
  useEffect(() => {
    const el = sel.state ? pathRefs.current.get(sel.state) : null;
    const target: Box = zoomBox ?? (el ? fit(el.getBBox()) : full);
    const from = vbRef.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const t = reduce ? 1 : Math.min(1, (now - start) / 450);
      const e = 1 - (1 - t) ** 3;
      const next = from.map((v, k) => v + (target[k] - v) * e) as Box;
      vbRef.current = next;
      setVb(next);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel.state, zoomBox]);
  const k = map.width / vb[2];
  const [mapRef, mapPx] = useWidth<HTMLDivElement>();

  // Nearby departments merge into one numbered bubble until zoomed in.
  const clusters = useMemo(() => {
    if (!citiesOn) return [];
    // About 40 screen pixels, whatever the map's rendered width.
    const cell = (40 * vb[2]) / mapPx;
    const groups = new Map<string, CityRow[]>();
    for (const c of markers) {
      const [x, y] = cityPoints[c.ori];
      const key = `${Math.floor(x / cell)}|${Math.floor(y / cell)}`;
      groups.set(key, [...(groups.get(key) ?? []), c]);
    }
    return [...groups.values()].map((members) => {
      const w = members.reduce((t, c) => t + (c.population ?? 1), 0);
      const x = members.reduce((t, c) => t + cityPoints[c.ori][0] * (c.population ?? 1), 0) / w;
      const y = members.reduce((t, c) => t + cityPoints[c.ori][1] * (c.population ?? 1), 0) / w;
      return { members, x, y };
    });
  }, [citiesOn, markers, cityPoints, vb, mapPx]);

  const zoomToCluster = (members: CityRow[]) => {
    const xs = members.map((c) => cityPoints[c.ori][0]);
    const ys = members.map((c) => cityPoints[c.ori][1]);
    const [x0, y0] = [Math.min(...xs), Math.min(...ys)];
    setZoomBox(fit({ x: x0, y: y0, width: Math.max(...xs) - x0, height: Math.max(...ys) - y0 }));
  };

  // ---- Selection ----
  const pickState = (abbr: string | null) => {
    setZoomBox(null);
    sel.set({ state: abbr && abbr === sel.state && !sel.city ? null : abbr, city: null, compare: abbr === sel.compare ? "" : sel.compare });
  };
  const pickCity = (ori: string) => {
    const c = cityByOri.get(ori);
    if (!c) return;
    setZoomBox(null);
    sel.set({ city: ori, state: c.state, year: latestYear, prelim: false, compare: c.state === sel.compare ? "" : sel.compare });
  };
  const reset = () => {
    setZoomBox(null);
    sel.set({ state: null, city: null });
  };

  // ---- Year playback ----
  useEffect(() => {
    if (!playing) return;
    const id = window.setTimeout(() => {
      const at = years.indexOf(sel.year);
      if (at >= years.length - 1) setPlaying(false);
      else sel.set({ year: years[at + 1] });
    }, 900);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, sel.year, years]);
  const togglePlay = () => {
    if (playing) return setPlaying(false);
    if (sel.year === latestYear) sel.set({ year: years[0], city: null });
    sel.set({ prelim: false, city: null });
    setPlaying(true);
  };

  // ---- Inspector focus: hover previews, selection holds ----
  const focusCity = (hoverCity && cityByOri.get(hoverCity)) || (!hover && citiesOn && city) || null;
  const focusAbbr = hover ?? sel.state;
  const focusRow = focusAbbr ? data.rows.find((r) => r.abbr === focusAbbr) : undefined;

  // ---- Trend lines ----
  const trendUnit = measure === "coverage" ? "percent" : "per_100k";
  const series = (r: { rates: StateCrimeData["rows"][number]["rates"]; coverage: (number | null)[] }) => (measure === "coverage" ? r.coverage : r.rates[offense]);
  const stateRow = sel.state ? data.rows.find((r) => r.abbr === sel.state) : undefined;
  const compareRow = sel.compare ? data.rows.find((r) => r.abbr === sel.compare) : undefined;
  const lines: TrendLine[] = [
    ...(stateRow ? [{ id: stateRow.abbr, label: stateRow.name, color: "var(--viz-series-1)", values: series(stateRow) }] : []),
    ...(compareRow ? [{ id: compareRow.abbr, label: compareRow.name, color: "var(--viz-series-2)", values: series(compareRow) }] : []),
    {
      id: "US",
      label: "United States",
      color: stateRow ? "var(--viz-muted)" : "var(--viz-series-1)",
      values: measure === "coverage" ? data.usCoverage : data.us[offense],
    },
  ];

  const label = offenseLabel(offense);
  const sel_ = "rounded-full border border-slate-700 bg-slate-900 px-3 py-1.5 text-sm text-slate-100";
  const [flagOpen, setFlagOpen] = useState<string | null>(null);
  // The state's full table opens on request, so the analyses stay in view.
  const [breakdown, setBreakdown] = useState(false);
  const flagNote = flaggedYears.find((f) => f.year === flagOpen);

  return (
    <div className="space-y-6">
      <section
        id="atlas"
        aria-label="Crime Atlas"
        className="dark viz-dark relative -mx-4 scroll-mt-14 overflow-hidden bg-slate-950 px-4 pt-5 pb-5 text-slate-100 sm:mx-0 sm:rounded-3xl sm:px-6 sm:ring-1 sm:ring-slate-800"
      >
        <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(60rem_30rem_at_30%_-10%,rgba(57,135,229,.16),transparent)]" />
        <div className="relative space-y-4">
          {/* Title and data status */}
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3">
            <div>
              <p className="text-[11px] font-semibold tracking-[0.2em] text-slate-400 uppercase">Worldview / Crime</p>
              <h1 className="mt-1 text-3xl font-semibold tracking-[-0.03em] text-white sm:text-4xl">Crime in America</h1>
              <p className="mt-1 text-sm text-slate-400">Explore offenses across places and time.</p>
            </div>
            <ul className="flex flex-wrap gap-2 text-[11px] text-slate-400">
              <li className="rounded-full px-2.5 py-1 ring-1 ring-slate-700">
                Annual series, {years[0]}–{latestYear} · agency coverage varies
              </li>
              {prelim && (
                <li className="rounded-full px-2.5 py-1 text-amber-300 ring-1 ring-amber-400/40">
                  {prelim.year} preliminary · reported through {prelim.latestReported.label}
                </li>
              )}
            </ul>
          </div>

          {/* Toolbar: offense, period, geography, measure */}
          <div className="flex flex-wrap items-center gap-2 border-y border-slate-800 py-3">
            <select aria-label="Offense" value={offense} onChange={(e) => sel.set({ offense: e.target.value as OffenseKey })} className={`${sel_} font-medium`}>
              {(["violent", "property"] as const).map((g) => (
                <optgroup key={g} label={g === "violent" ? "Violent" : "Property"}>
                  {OFFENSES.filter((o) => o.group === g).map((o) => (
                    <option key={o.key} value={o.key}>
                      {o.label}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
            <select aria-label="Geography" value={sel.state ?? ""} onChange={(e) => pickState(e.target.value || null)} className={sel_}>
              <option value="">United States</option>
              {data.rows.map((r) => (
                <option key={r.abbr} value={r.abbr}>
                  {r.name}
                </option>
              ))}
            </select>
            {prelim && (
              <Segmented
                label="Period"
                value={isPrelim ? "prelim" : "annual"}
                onChange={(v) => {
                  setPlaying(false);
                  sel.set(v === "prelim" ? { prelim: true, year: prelim.year, city: null } : { prelim: false, year: latestYear });
                }}
                options={[
                  { value: "annual", label: "Annual" },
                  { value: "prelim", label: `${prelim.year} preliminary` },
                ]}
              />
            )}
            <span className="ml-auto">
              <Segmented
                label="Measure"
                value={measure}
                onChange={(v) => sel.set({ measure: v })}
                options={[
                  { value: "rate", label: "Rate" },
                  { value: "change", label: "1-yr change" },
                  { value: "coverage", label: "Coverage" },
                ]}
              />
            </span>
          </div>

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(16rem,19rem)]">
            <div className="min-w-0 space-y-3">
              <div ref={mapRef} className="relative">
                <svg
                  viewBox={vb.join(" ")}
                  role="img"
                  aria-label={`${label}, ${MEASURE_LABEL[measure].toLowerCase()} by state, ${year}`}
                  className={`block h-auto max-h-[calc(100svh-25rem)] min-h-56 w-full transition-opacity ${isPrelim ? "opacity-40" : ""}`}
                >
                  {map.states.map((st) => {
                    const v = byAbbr.get(st.abbr)?.value;
                    const isSel = sel.state === st.abbr || sel.compare === st.abbr;
                    return (
                      <path
                        key={st.abbr}
                        ref={(el) => void (el ? pathRefs.current.set(st.abbr, el) : pathRefs.current.delete(st.abbr))}
                        d={st.d}
                        tabIndex={0}
                        role="button"
                        aria-label={`${st.name}: ${formatValue(v, measure === "rate" ? "per_100k" : "percent")}`}
                        aria-pressed={sel.state === st.abbr}
                        onPointerEnter={() => setHover(st.abbr)}
                        onPointerLeave={() => setHover(null)}
                        onFocus={() => setHover(st.abbr)}
                        onBlur={() => setHover(null)}
                        onClick={() => pickState(st.abbr)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            pickState(st.abbr);
                          }
                        }}
                        className="cursor-pointer"
                        vectorEffect="non-scaling-stroke"
                        style={{
                          fill: fillOf(v),
                          stroke: isSel ? "var(--viz-series-2)" : hover === st.abbr ? "var(--viz-muted)" : "var(--viz-surface)",
                          strokeWidth: isSel ? 2.5 : hover === st.abbr ? 2 : 1,
                          strokeLinejoin: "round",
                          outline: "none",
                        }}
                      />
                    );
                  })}
                  {map.states
                    .filter((st) => st.abbr === sel.state || st.abbr === sel.compare || st.abbr === hover)
                    .map((st) => {
                      const muted = st.abbr === hover && st.abbr !== sel.state && st.abbr !== sel.compare;
                      return (
                        <path
                          key={`edge-${st.abbr}`}
                          d={st.d}
                          pointerEvents="none"
                          vectorEffect="non-scaling-stroke"
                          style={{ fill: "none", stroke: muted ? "var(--viz-muted)" : "var(--viz-series-2)", strokeWidth: muted ? 2 : 2.5, strokeLinejoin: "round" }}
                        />
                      );
                    })}
                  {!citiesOn &&
                    map.states.map((st) => {
                      if (!st.label) return null;
                      const s = stepOf(byAbbr.get(st.abbr)?.value);
                      return (
                        <text
                          key={`label-${st.abbr}`}
                          x={st.label[0]}
                          y={st.label[1]}
                          textAnchor="middle"
                          dominantBaseline="central"
                          pointerEvents="none"
                          fontSize={13 / k}
                          fontWeight={600}
                          style={{ fill: s ? `var(--viz-seq-ink-${s})` : "var(--foreground)" }}
                        >
                          {st.abbr}
                        </text>
                      );
                    })}
                  {clusters.map(({ members, x, y }) => {
                    if (members.length === 1) {
                      const c = members[0];
                      const on = sel.city === c.ori || hoverCity === c.ori;
                      return (
                        <circle
                          key={c.ori}
                          cx={x}
                          cy={y}
                          r={(cityRadius(c.population) * 0.85 + (on ? 1.5 : 0)) / Math.sqrt(k)}
                          vectorEffect="non-scaling-stroke"
                          onPointerEnter={() => setHoverCity(c.ori)}
                          onPointerLeave={() => setHoverCity(null)}
                          onClick={() => pickCity(c.ori)}
                          className="cursor-pointer"
                          style={{
                            fill: "var(--viz-series-2)",
                            fillOpacity: on ? 1 : 0.8,
                            stroke: on ? "var(--foreground)" : "var(--viz-surface)",
                            strokeWidth: on ? 2 : 0.8,
                          }}
                        >
                          <title>{`${c.name}, ${c.state} police department`}</title>
                        </circle>
                      );
                    }
                    const r = (8 + Math.sqrt(members.length) * 2.2) / k;
                    return (
                      <g key={members[0].ori} className="cursor-pointer" onClick={() => zoomToCluster(members)}>
                        <title>{`${members.length} departments: ${members.slice(0, 4).map((c) => c.name).join(", ")}${members.length > 4 ? "…" : ""} — click to zoom`}</title>
                        <circle cx={x} cy={y} r={r} vectorEffect="non-scaling-stroke" style={{ fill: "var(--viz-series-2)", fillOpacity: 0.85, stroke: "var(--viz-surface)", strokeWidth: 1.2 }} />
                        <text x={x} y={y} textAnchor="middle" dominantBaseline="central" fontSize={10.5 / k} fontWeight={700} pointerEvents="none" style={{ fill: "white" }}>
                          {members.length}
                        </text>
                      </g>
                    );
                  })}
                </svg>
                {isPrelim && (
                  <p className="absolute inset-x-0 top-1/2 mx-auto w-fit -translate-y-1/2 rounded-xl bg-slate-900/90 px-4 py-2 text-center text-sm text-slate-200 shadow-sm">
                    Preliminary figures are national; state rates are annual only.
                  </p>
                )}
                {(sel.state || zoomBox) && (
                  <button
                    type="button"
                    onClick={reset}
                    className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-full border border-slate-700 bg-slate-900/90 px-2.5 py-1 text-xs font-medium text-slate-200 shadow-sm hover:border-slate-400"
                  >
                    <RotateCcw className="size-3.5" /> United States
                  </button>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <MapLegend measure={measure} present={present} isPrelim={isPrelim} />
                {cities.length > 0 && (
                  <label className="inline-flex cursor-pointer items-center gap-1.5 text-xs text-slate-400">
                    <input type="checkbox" checked={showCities} onChange={(e) => setShowCities(e.target.checked)} className="accent-orange-600" />
                    <span className="inline-block size-2.5 rounded-full" style={{ background: "var(--viz-series-2)" }} aria-hidden />
                    City police departments
                    {(year !== latestYear || isPrelim) && <span className="text-slate-500">({latestYear} only)</span>}
                  </label>
                )}
              </div>
            </div>

            <aside className="h-fit rounded-2xl bg-white/[0.03] p-4 text-sm ring-1 ring-white/10" aria-live="polite">
              {isPrelim && prelim ? (
                <PrelimInspector p={prelim} offense={offense} latestYear={latestYear} />
              ) : focusCity ? (
                <CityInspector
                  c={focusCity}
                  cities={cities}
                  offense={offense}
                  year={latestYear}
                  stateRow={data.rows.find((r) => r.abbr === focusCity.state)}
                  us={data.us}
                  i={years.indexOf(latestYear)}
                  pinned={sel.city === focusCity.ori}
                  onBack={() => sel.set({ city: null })}
                />
              ) : (
                <GeoInspector
                  name={focusRow?.name ?? "United States"}
                  abbr={focusRow?.abbr ?? null}
                  rates={focusRow ? focusRow.rates : data.us}
                  coverage={focusRow ? focusRow.coverage : data.usCoverage}
                  rank={focusRow ? (byAbbr.get(focusRow.abbr)?.rank ?? 0) : 0}
                  ranked={rows.filter((r) => r.rank).length}
                  usRate={data.us[offense][i]}
                  cleared={
                    focusRow
                      ? year === latestYear && (CLEARED as readonly string[]).includes(offense)
                        ? focusRow.cleared[offense as ClearedKey]
                        : null
                      : (offenses.find((o) => o.key === offense)?.cleared.find((p) => p.year === year)?.value ?? null)
                  }
                  offense={offense}
                  years={years}
                  i={i}
                  preview={!!hover && hover !== sel.state}
                  onOffense={(o) => sel.set({ offense: o })}
                />
              )}
              {stateRow && !isPrelim && (
                <button
                  type="button"
                  aria-expanded={breakdown}
                  aria-controls="state-breakdown"
                  onClick={() => setBreakdown(!breakdown)}
                  className="mt-4 w-full rounded-full bg-white/10 px-3 py-1.5 text-xs font-medium text-white hover:bg-white/15"
                >
                  {breakdown ? "Hide" : "Full"} {stateRow.name} breakdown
                </button>
              )}
            </aside>
          </div>

          {/* Timeline: the history of the selection; each year moves the map */}
          <div className={`flex items-start gap-3 border-t border-slate-800 pt-3 ${isPrelim ? "opacity-40" : ""}`}>
            <button
              type="button"
              onClick={togglePlay}
              disabled={isPrelim}
              aria-label={playing ? "Pause" : `Play ${years[0]} to ${latestYear}`}
              className="mt-6 inline-flex size-8 shrink-0 items-center justify-center rounded-full bg-white text-slate-900 hover:bg-slate-200"
            >
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
            </button>
            <div className="min-w-0 flex-1">
              <AtlasTrend
                years={years}
                lines={lines}
                unit={trendUnit}
                year={isPrelim ? null : year}
                flagged={flagged}
                height={96}
                fromZero={false}
                onYear={(y) => {
                  setPlaying(false);
                  sel.set({ year: y, prelim: false, city: y === latestYear ? sel.city : null });
                }}
              />
            </div>
          </div>
          {flaggedYears.length > 0 && (
            <div className="text-xs">
              <div className="flex flex-wrap gap-2">
                {flaggedYears.map((f) => (
                  <button
                    key={f.year}
                    type="button"
                    aria-expanded={flagOpen === f.year}
                    onClick={() => setFlagOpen(flagOpen === f.year ? null : f.year)}
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 ring-1 ${
                      f.year === year && !isPrelim ? "bg-amber-400/15 text-amber-200 ring-amber-400/50" : "text-amber-300/80 ring-amber-400/30 hover:ring-amber-400/60"
                    }`}
                  >
                    <Info className="size-3.5" aria-hidden />
                    {f.year} · Partial reporting ({formatValue(f.coverage, "percent")} population coverage)
                  </button>
                ))}
              </div>
              {flagNote && (
                <p className="mt-2 max-w-3xl leading-5 text-slate-300">
                  In {flagNote.year} the FBI retired its summary reporting system for NIBRS, and many agencies, including some of the largest, had not
                  yet switched. Agencies covering {formatValue(flagNote.coverage, "percent")} of residents reported, so {flagNote.year} rates read low
                  and changes into and out of {flagNote.year} reflect participation as well as crime. The year is shaded on every chart.
                </p>
              )}
            </div>
          )}
          {sources}
        </div>
      </section>

      {stateRow && breakdown && (
        <StateBreakdown
          data={data}
          abbr={stateRow.abbr}
          compare={sel.compare}
          metric={offense}
          year={year}
          latestYear={latestYear}
          onPickCity={(ori) => {
            pickCity(ori);
            window.scrollTo({ top: document.getElementById("atlas")?.offsetTop ?? 0, behavior: "smooth" });
          }}
          onClose={() => setBreakdown(false)}
        />
      )}
    </div>
  );
}

function MapLegend({ measure, present, isPrelim }: { measure: Measure; present: number[]; isPrelim: boolean }) {
  if (isPrelim || !present.length) return null;
  const swatch = (bg: string, key: number) => <span key={key} className="h-2.5 w-6 first:rounded-l last:rounded-r" style={{ background: bg }} />;
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-slate-500 dark:text-slate-400">
      {measure === "rate" && (
        <>
          <span>{formatValue(Math.min(...present), "per_100k")}</span>
          <span className="flex">{Array.from({ length: STEPS }, (_, n) => swatch(`var(--viz-seq-${n + 1})`, n))}</span>
          <span>{formatValue(Math.max(...present), "per_100k")}</span>
          <span className="text-slate-400">· shades split states into sevenths by rank</span>
        </>
      )}
      {measure === "change" && (
        <>
          <span>Fell 20%+</span>
          <span className="flex">{[-25, -15, -7, -3, -1, 1, 3, 7, 15, 25].map((v, n) => swatch(changeFill(v), n))}</span>
          <span>Rose 20%+</span>
          <span className="text-slate-400">· vs the year before</span>
        </>
      )}
      {measure === "coverage" && (
        <>
          <span>&lt;50%</span>
          <span className="flex">{Array.from({ length: STEPS }, (_, n) => swatch(`var(--viz-seq-${n + 1})`, n))}</span>
          <span>95%+</span>
          <span className="text-slate-400">· residents covered by agencies that reported</span>
        </>
      )}
    </div>
  );
}

function GeoInspector({
  name,
  abbr,
  rates,
  coverage,
  rank,
  ranked,
  usRate,
  cleared,
  offense,
  years,
  i,
  preview,
  onOffense,
}: {
  name: string;
  abbr: string | null;
  rates: Record<OffenseKey, (number | null)[]>;
  coverage: (number | null)[];
  rank: number;
  ranked: number;
  usRate: number | null;
  cleared: number | null;
  offense: OffenseKey;
  years: string[];
  i: number;
  preview: boolean;
  onOffense: (o: OffenseKey) => void;
}) {
  const year = years[i];
  const prior = i > 0 ? years[i - 1] : null;
  const rate = rates[offense][i];
  const group = OFFENSES.find((o) => o.key === offense)!.group;
  const cov = coverage[i];
  const dd = "text-right font-medium text-slate-900 tabular-nums dark:text-white";
  return (
    <>
      <p className="flex items-baseline justify-between gap-2">
        <span className="text-lg font-semibold text-slate-950 dark:text-white">{name}</span>
        {preview && <span className="text-[11px] tracking-wide text-slate-400 uppercase">Preview</span>}
      </p>
      <p className="mt-3 text-[11px] font-semibold tracking-[0.14em] text-slate-400 uppercase">
        {offenseLabel(offense)} rate · {year}
      </p>
      <p className="mt-0.5 text-5xl font-semibold tracking-[-0.03em] text-slate-950 tabular-nums dark:text-white">{formatValue(rate, "per_100k")}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">Offenses per 100,000 residents</p>
      {prior && (
        <p className="mt-2 text-sm font-medium text-slate-800 tabular-nums dark:text-slate-100">
          {signed(pctChange(rate, rates[offense][i - 1]))} <span className="font-normal text-slate-500 dark:text-slate-400">vs {prior}</span>
        </p>
      )}
      <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
        {abbr && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">vs U.S. rate</dt>
            <dd className={dd}>{signed(pctChange(rate, usRate))}</dd>
            <dt className="text-slate-500 dark:text-slate-400">Rank</dt>
            <dd className={dd}>{rank ? `#${rank} of ${ranked}` : "—"}</dd>
          </>
        )}
        {cleared !== null && (
          <>
            <dt className="text-slate-500 dark:text-slate-400">
              <a href="#response" className="underline decoration-slate-300 underline-offset-2 hover:text-slate-900 dark:hover:text-white">
                Cleared
              </a>
            </dt>
            <dd className={dd}>{formatValue(cleared, "percent")}</dd>
          </>
        )}
        <dt className="text-slate-500 dark:text-slate-400">Residents covered</dt>
        <dd className={cov !== null && cov < FULL_COVERAGE ? "text-right font-medium text-amber-700 tabular-nums dark:text-amber-400" : dd}>{formatValue(cov, "percent")}</dd>
      </dl>
      {cov !== null && cov < FULL_COVERAGE && (
        <p className="mt-2 text-xs text-amber-800 dark:text-amber-300">Agencies covering {formatValue(cov, "percent")} of residents reported in {year}, so this rate reads low.</p>
      )}

      <p className="mt-5 text-xs font-medium tracking-wide text-slate-400 uppercase">{group === "violent" ? "Violent" : "Property"} offenses</p>
      <ul className="mt-2 space-y-0.5">
        {OFFENSES.filter((o) => o.group === group).map((o) => (
          <li key={o.key}>
            <button
              type="button"
              onClick={() => onOffense(o.key)}
              aria-pressed={o.key === offense}
              className={`flex w-full items-baseline justify-between gap-3 rounded-md px-2 py-1 text-left text-sm ${
                o.key === offense ? "bg-slate-100 font-semibold text-slate-950 dark:bg-slate-800 dark:text-white" : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-900"
              } ${o.key === "violent_crime" || o.key === "property_crime" ? "" : "pl-4"}`}
            >
              <span>{o.label}</span>
              <span className="tabular-nums">{formatValue(rates[o.key][i], "per_100k")}</span>
            </button>
          </li>
        ))}
      </ul>
      {!abbr && <p className="mt-4 text-xs text-slate-400">Select a state or a city bubble on the map.</p>}
    </>
  );
}

function CityInspector({
  c,
  cities,
  offense,
  year,
  stateRow,
  us,
  i,
  pinned,
  onBack,
}: {
  c: CityRow;
  cities: CityRow[];
  offense: OffenseKey;
  year: string;
  stateRow: StateCrimeData["rows"][number] | undefined;
  us: StateCrimeData["us"];
  i: number;
  pinned: boolean;
  onBack: () => void;
}) {
  const key = CITY_KEY[offense] ?? "violent";
  const shownOffense = CITY_KEY[offense] ? offense : "violent_crime";
  const rank = (k: "violent" | "murder" | "property") => {
    const v = c[k];
    if (v === null) return null;
    const ranked = cities.filter((x) => x[k] !== null);
    return { n: ranked.filter((x) => x[k]! > v).length + 1, of: ranked.length };
  };
  const rows: { label: string; key: "violent" | "murder" | "property" }[] = [
    { label: "Violent crime", key: "violent" },
    { label: "Murder", key: "murder" },
    { label: "Property crime", key: "property" },
  ];
  const dd = "text-right font-medium text-slate-900 tabular-nums dark:text-white";
  return (
    <>
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">{pinned ? "Police department" : "Preview"}</p>
        {pinned && (
          <button type="button" onClick={onBack} aria-label="Close department" className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white">
            <X className="size-4" />
          </button>
        )}
      </div>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">
        {c.name}, {c.state}
        {c.partial && (
          <span className="ml-1 text-slate-400" title={`Incomplete data for ${year}`}>
            †
          </span>
        )}
      </p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Serves {formatValue(c.population, "people")} residents · agency {c.ori}
      </p>
      <p className="mt-3 text-4xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{formatValue(c[key], "per_100k")}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {offenseLabel(shownOffense)} per 100,000 served, {year}
      </p>
      {!CITY_KEY[offense] && <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Department figures cover violent crime, murder, and property crime.</p>}
      <dl className="mt-4 grid grid-cols-[1fr_auto_auto] gap-x-3 gap-y-2 text-xs">
        {rows.map((r) => {
          const n = rank(r.key);
          return (
            <div key={r.key} className="contents">
              <dt className={`text-slate-500 dark:text-slate-400 ${r.key === key ? "font-semibold text-slate-800 dark:text-slate-100" : ""}`}>{r.label}</dt>
              <dd className={dd}>{formatValue(c[r.key], "per_100k")}</dd>
              <dd className="text-right text-slate-400 tabular-nums">{n ? `#${n.n} of ${n.of}` : ""}</dd>
            </div>
          );
        })}
        <dt className="text-slate-500 dark:text-slate-400">vs {stateRow?.name ?? c.state}</dt>
        <dd className={`col-span-2 ${dd}`}>{signed(pctChange(c[key], stateRow?.rates[shownOffense][i] ?? null))}</dd>
        <dt className="text-slate-500 dark:text-slate-400">vs U.S.</dt>
        <dd className={`col-span-2 ${dd}`}>{signed(pctChange(c[key], us[shownOffense][i]))}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Violent, 1-year</dt>
        <dd className={`col-span-2 ${dd}`}>{signed(c.violentChange)}</dd>
        <dt className="text-slate-500 dark:text-slate-400">Police staff per 1,000</dt>
        <dd className={`col-span-2 ${dd}`}>{formatValue(c.staffing, "per_1000")}</dd>
      </dl>
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Rates use the population of the department&apos;s jurisdiction. The state and U.S. rates include every reporting agency.
      </p>
      {c.partial && (
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">† The department reported incomplete data for {year} — missing months, or far fewer offenses than its usual year.</p>
      )}
      {pinned && (
        <button type="button" onClick={onBack} className="mt-4 inline-flex items-center gap-1 text-xs font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
          <ArrowLeft className="size-3.5" /> Back to {stateRow?.name ?? c.state}
        </button>
      )}
    </>
  );
}

// The preliminary year: matching months against the same months of the last
// complete year, separate from the newest month any agency has reported.
function PrelimInspector({ p, offense, latestYear }: { p: Prelim; offense: OffenseKey; latestYear: string }) {
  const row = p.rows.find((r) => r.key === offense);
  return (
    <>
      <p className="text-xs font-medium tracking-wide text-amber-700 uppercase dark:text-amber-400">{p.year} preliminary · United States</p>
      <p className="mt-1 text-lg font-semibold text-slate-950 dark:text-white">{offenseLabel(offense)}</p>
      {p.span && row ? (
        <>
          <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 tabular-nums dark:text-white">{signed(row.change)}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {p.span} {p.year} vs {p.span} {latestYear}
          </p>
          <dl className="mt-4 grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
            <dt className="text-slate-500 dark:text-slate-400">
              {p.span} {latestYear}
            </dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(row.prior, "per_100k")}</dd>
            <dt className="text-slate-500 dark:text-slate-400">
              {p.span} {p.year}
            </dt>
            <dd className="text-right font-medium text-slate-900 tabular-nums dark:text-white">{formatValue(row.current, "per_100k")}</dd>
          </dl>
          <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Per 100,000 residents, each month scaled up to the full population by its own reporting coverage.</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">No month of {p.year} has reached 85% coverage yet, so there is no comparable period.</p>
      )}
      <dl className="mt-4 space-y-2 border-t border-slate-200 pt-3 text-xs dark:border-slate-800">
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Comparable period</dt>
          <dd className="font-medium text-slate-900 dark:text-white">{p.span ? `${p.span} ${p.year} — every month at 85%+ coverage` : "None yet"}</dd>
        </div>
        <div>
          <dt className="text-slate-500 dark:text-slate-400">Latest month reported</dt>
          <dd className="font-medium text-slate-900 dark:text-white">
            {p.latestReported.label} — {formatValue(p.latestReported.coverage, "percent")} of residents covered
          </dd>
        </div>
      </dl>
      <ul className="mt-3 space-y-1">
        {p.reported.map((m) => (
          <li key={m.label} className="grid grid-cols-[4.5rem_1fr_3rem] items-center gap-2 text-xs">
            <span className="text-slate-500 dark:text-slate-400">{m.label.replace(/ \d{4}$/, "")}</span>
            <span className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
              <span className="block h-1.5 rounded-full" style={{ width: `${m.coverage ?? 0}%`, background: (m.coverage ?? 0) >= 85 ? "var(--viz-series-1)" : "var(--viz-axis)" }} />
            </span>
            <span className="text-right text-slate-700 tabular-nums dark:text-slate-300">{formatValue(m.coverage, "percent")}</span>
          </li>
        ))}
      </ul>
    </>
  );
}
