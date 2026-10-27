"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Info, X } from "lucide-react";
import {
  getDemographicSeries,
  nationalPopulation,
  type DemographicDimensionId,
  type GeoLevel,
} from "@/lib/demographics/forecast";
import {
  GEO_LABEL,
  STATUS_LABEL,
  publishedYears,
  rangeExplanation,
  yearProvenance,
} from "@/lib/demographics/provenance";
import { packedRange, packedValue, regionCount, type RegionFile, type RegionRecord } from "@/lib/demographics/regional";
import {
  DemographicsMap,
  NEGATIVE_COLOR,
  divergingExtent,
  valueExtent,
  type MapArea,
  type MapCity,
} from "./demographics-map";
import { formatPoints } from "./format";
import { GroupPicker } from "./group-picker";
import { PlacePicker } from "./place-picker";
import { RegionTable, type TableRow } from "./region-table";
import { InfoTip, StatusBadge } from "./status-badge";
import { TrendChart, isProjected } from "./trend-chart";
import {
  changeBaseline,
  cityNotice,
  DEFAULT_FOCUS,
  DEFAULT_YEAR,
  END_YEAR,
  fitRange,
  initialViewRanges,
  isDimension,
  isMode,
  loadRegions,
  pointAt,
  rangeAround,
  regionSeries,
  seriesBounds,
  TOPIC_PAGES,
  writeParams,
  type MapMode,
  type ViewRange,
} from "./forecast-model";

const DIMENSION_ORDER: DemographicDimensionId[] = ["race", "religion", "orientation", "age", "sex"];

// `lockedDimension` pins the explorer to one dimension (a topic page's
// copy of it): no dimension tabs, and no `dim` in the URL.
export function DemographicsForecast({ lockedDimension }: { lockedDimension?: DemographicDimensionId } = {}) {
  const searchParams = useSearchParams();
  const requestedState = searchParams.get("state");
  const requestedCity = searchParams.get("city");

  // View settings start from the URL and are written back to it, so any
  // view can be shared.
  const [dimension, setDimension] = useState<DemographicDimensionId>(() => {
    const value = searchParams.get("dim");
    return lockedDimension ?? (isDimension(value) ? value : "race");
  });
  const [groups, setGroups] = useState<Partial<Record<DemographicDimensionId, string>>>(() => {
    const value = searchParams.get("group");
    // Race is the default dimension, so its links carry no dim param.
    const dim = lockedDimension ?? searchParams.get("dim") ?? "race";
    return value && isDimension(dim) ? { [dim]: value } : {};
  });
  const [year, setYear] = useState(() => Number(searchParams.get("year")) || DEFAULT_YEAR);
  const [mode, setMode] = useState<MapMode>(() => {
    const value = searchParams.get("mode");
    return isMode(value) ? value : "share";
  });
  const [viewRanges, setViewRanges] = useState<Record<DemographicDimensionId, ViewRange>>(() =>
    initialViewRanges(Number(searchParams.get("year")) || DEFAULT_YEAR),
  );
  const [notice, setNotice] = useState<string | null>(null);

  const [statesFile, setStatesFile] = useState<RegionFile | null>(null);
  const [cityFiles, setCityFiles] = useState<Record<string, RegionFile | null>>({});

  useEffect(() => {
    void loadRegions("/data/demographics/states.json").then(setStatesFile);
  }, []);

  useEffect(() => {
    if (!requestedState || requestedState in cityFiles) return;
    void loadRegions(`/data/demographics/cities/${requestedState}.json`).then((file) =>
      setCityFiles((current) => ({ ...current, [requestedState]: file })),
    );
  }, [requestedState, cityFiles]);

  const national = getDemographicSeries(dimension);
  const citySupported = national.geographies.includes("city");

  // Geography is never finer than the active dimension supports: a city is
  // only in view when this dimension is published for it.
  const state = statesFile?.regions.find((region) => region.id === requestedState) ?? null;
  const cityFile = state ? (cityFiles[state.id] ?? null) : null;
  const cityCandidate = cityFile?.regions.find((region) => region.id === requestedCity) ?? null;
  const city = citySupported && cityCandidate?.series[dimension] ? cityCandidate : null;

  const stateSeries = state && statesFile ? regionSeries(state, statesFile, dimension) : null;
  const citySeries = city && cityFile ? regionSeries(city, cityFile, dimension) : null;
  const series = citySeries ?? stateSeries ?? national;
  const level: GeoLevel = citySeries ? "city" : stateSeries ? "state" : "national";
  const region = level === "city" ? city : level === "state" ? state : null;
  const places = { state: state?.name, city: city?.name };

  // A city the URL asks for but the active dimension can't show (a shared
  // link, say) resolves to its state, with a note saying so.
  const unresolvedCity = Boolean(requestedCity && state && state.id in cityFiles && !city);
  const unresolvedState = Boolean(requestedState && statesFile && !state);
  const shownNotice =
    notice ??
    (unresolvedState
      ? "That state isn't in the data. Showing the United States instead."
      : unresolvedCity && state
        ? cityNotice(national, cityCandidate?.name ?? null, state.name)
        : null);
  const dismissNotice = () => {
    setNotice(null);
    if (unresolvedState) writeParams({ state: null, city: null });
    else if (unresolvedCity) writeParams({ city: null });
  };

  const [firstYear, lastYear] = seriesBounds(series);
  const selectedYear = Math.min(lastYear, Math.max(firstYear, year));
  const viewRange = fitRange(viewRanges[dimension], series);
  const point = pointAt(series, selectedYear) ?? series.points[0];
  const focusCategory =
    series.categories.find((category) => category.id === (groups[dimension] ?? DEFAULT_FOCUS[dimension])) ??
    series.categories[0];
  const focus = focusCategory.id;
  const universe = national.universe;
  const provenance = yearProvenance(series, level, selectedYear, places);
  const pastProvenance = yearProvenance(series, level, series.observedThrough, places);
  const futureProvenance = yearProvenance(series, level, series.observedThrough + 1, places);
  const published = publishedYears(series, level);

  // Settings -> URL, debounced so dragging the year doesn't flood history.
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        writeParams({
          dim: lockedDimension || dimension === "race" ? null : dimension,
          group: groups[dimension] ?? null,
          year: year === DEFAULT_YEAR ? null : String(year),
          mode: mode === "share" ? null : mode,
        }),
      250,
    );
    return () => window.clearTimeout(timer);
  }, [dimension, groups, year, mode, lockedDimension]);

  const navigate = (next: { state: string | null; city: string | null }) => {
    setNotice(null);
    writeParams({ state: next.state, city: next.state ? next.city : null }, true);
  };
  const selectState = (id: string) => navigate({ state: id, city: null });
  const selectCity = (id: string) => navigate({ state: id.slice(0, 2), city: id });
  const goNational = () => navigate({ state: null, city: null });
  // One level up: city -> its state -> the nation.
  const goUp = () => {
    if (city && state) navigate({ state: state.id, city: null });
    else navigate({ state: null, city: null });
  };

  // Esc goes one level up, like goUp.
  const shownCityId = city?.id ?? null;
  useEffect(() => {
    if (!requestedState) return;
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.key !== "Escape" || target?.closest("input, select, textarea")) return;
      setNotice(null);
      writeParams(shownCityId ? { city: null } : { state: null, city: null }, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestedState, shownCityId]);

  // Geography is resolved here, not the dimension: a city the new dimension
  // isn't published for gives way to its state.
  const chooseDimension = (id: DemographicDimensionId) => {
    setNotice(null);
    setDimension(id);
    if (!requestedCity || !state) return;
    const target = getDemographicSeries(id);
    const keeps = target.geographies.includes("city") && Boolean(cityCandidate?.series[id]);
    if (city && keeps) return;
    writeParams({ city: null });
    if (city) setNotice(cityNotice(target, city.name, state.name));
  };

  const moveView = (nextStart: number) => {
    const span = viewRange.end - viewRange.start;
    const start = Math.min(lastYear - span, Math.max(firstYear, nextStart));
    const end = start + span;
    setViewRanges((current) => ({ ...current, [dimension]: { start, end } }));
    if (selectedYear < start || selectedYear > end) setYear(Math.min(end, Math.max(start, selectedYear)));
  };

  const setViewSpan = (span: number | "all") => {
    const next = span === "all" ? { start: firstYear, end: lastYear } : rangeAround(series, selectedYear, span);
    setViewRanges((current) => ({ ...current, [dimension]: next }));
  };

  const selectYear = (next: number) => {
    const clamped = Math.min(lastYear, Math.max(firstYear, next));
    setYear(clamped);
    if (clamped < viewRange.start || clamped > viewRange.end) {
      const span = viewRange.end - viewRange.start;
      setViewRanges((current) => ({ ...current, [dimension]: rangeAround(series, clamped, span) }));
    }
  };

  // ---- map and table values -------------------------------------------

  // Cities carry the map inside a state only for city-level dimensions.
  const showCities = Boolean(state) && citySupported;
  const mapFile = showCities ? cityFile : statesFile;
  const mapBaseline = mapFile?.regions.find((item) => item.series[dimension])?.series[dimension]?.start ?? null;

  const shareOf = (record: RegionRecord) => packedValue(record.series[dimension], focus, selectedYear);
  const changeOf = (record: RegionRecord) => {
    const packed = record.series[dimension];
    const now = packedValue(packed, focus, selectedYear);
    const then = packed ? packedValue(packed, focus, packed.start) : null;
    return now === null || then === null || !packed || selectedYear < packed.start ? null : now - then;
  };
  const peopleOf = (record: RegionRecord) => {
    const share = packedValue(record.series[dimension], focus, selectedYear);
    const count = regionCount(record, universe, selectedYear);
    return share === null || count === null ? null : (share / 100) * count;
  };
  const mapValue = mode === "share" ? shareOf : changeOf;

  const mapStates: MapArea[] = (statesFile?.regions ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    value: mapValue(item),
  }));
  const mapCities: MapCity[] = showCities
    ? (cityFile?.regions ?? []).map((item) => ({
        id: item.id,
        name: item.name,
        lat: item.lat ?? 0,
        lon: item.lon ?? 0,
        population: item.population,
        value: mapValue(item),
      }))
    : [];
  const legendAreas = showCities ? mapCities : mapStates;
  const legendValues = legendAreas.map((area) => area.value);
  const legendHasData = legendValues.some((value) => value !== null);
  const formatValue = (value: number | null) => {
    if (value === null) return "no data";
    if (mode === "change") return `${focusCategory.label} ${formatPoints(value)} since ${mapBaseline}`;
    return `${focusCategory.label} ${value.toFixed(1)}%`;
  };

  const tableRows: TableRow[] = (mapFile?.regions ?? []).map((item) => ({
    id: item.id,
    name: item.name,
    share: shareOf(item),
    people: peopleOf(item),
    change: changeOf(item),
    end: packedRange(item.series[dimension], focus, END_YEAR),
    selectable: Boolean(item.series[dimension]),
  }));

  // The row the table is measured against: the U.S. for states, the state
  // for its cities.
  const referenceRow = ((): TableRow | null => {
    const parent = showCities ? stateSeries : national;
    if (!parent) return null;
    const now = pointAt(parent, selectedYear);
    const then = mapBaseline !== null ? pointAt(parent, mapBaseline) : undefined;
    const end = pointAt(parent, END_YEAR);
    const share = now?.values[focus] ?? null;
    const count = showCities
      ? state
        ? regionCount(state, universe, selectedYear)
        : null
      : nationalPopulation(universe, selectedYear);
    return {
      id: "reference",
      name: showCities ? `All of ${state?.name}` : "United States",
      share,
      people: share !== null && count !== null ? (share / 100) * count : null,
      change: share !== null && then && selectedYear >= then.year ? share - (then.values[focus] ?? 0) : null,
      end: end?.low && end.high ? [end.low[focus], end.high[focus]] : null,
      selectable: false,
    };
  })();

  // ---- comparison with the parent geography ----------------------------

  const parent = level === "city" ? stateSeries : level === "state" ? national : null;
  const parentLabel = level === "city" ? (state?.abbr ?? "State") : "U.S.";
  const population =
    level === "national"
      ? nationalPopulation(universe, selectedYear)
      : region
        ? regionCount(region, universe, selectedYear)
        : null;

  // Change is measured from one year everywhere: the first year the map has
  // figures for, so the map, the group line and the table agree.
  const changeFrom = (mapBaseline !== null ? pointAt(series, mapBaseline) : null) ?? changeBaseline(series);

  const placeName = city ? `${city.name}, ${state?.abbr}` : (state?.name ?? "United States");

  // The current view as a query string for the matching page: the topic
  // page from here, or back to this dimension on /demographics.
  const viewQuery = (withDim: boolean) => {
    const params = new URLSearchParams();
    if (withDim) params.set("dim", dimension);
    if (state) params.set("state", state.id);
    if (groups[dimension]) params.set("group", groups[dimension]!);
    if (year !== DEFAULT_YEAR) params.set("year", String(year));
    if (mode !== "share") params.set("mode", mode);
    const query = params.toString();
    return query ? `?${query}` : "";
  };
  const topicPage = lockedDimension ? null : TOPIC_PAGES[dimension];
  const loadingRegion = (requestedState && !statesFile) || (requestedCity && state && !(state.id in cityFiles));

  return (
    <div className="space-y-5">
      <section
        aria-label="Demographic view controls"
        className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm dark:border-slate-800 dark:bg-slate-950"
      >
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {lockedDimension ? (
            <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-sm font-semibold text-slate-950 dark:text-white">{national.label}</span>
              <Link
                href={`/demographics${viewQuery(true)}`}
                className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 hover:text-slate-950 hover:underline dark:text-slate-400 dark:hover:text-white"
              >
                <ArrowLeft size={12} />
                Compare with age, sex, and race in Demographics
              </Link>
            </div>
          ) : (
            <div
              className="flex min-w-0 basis-full flex-nowrap items-center gap-1 overflow-x-auto sm:basis-auto"
              aria-label="Demographic measure"
            >
              {DIMENSION_ORDER.map(getDemographicSeries).map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => chooseDimension(item.id)}
                  aria-pressed={dimension === item.id}
                  className={`shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-medium transition-all ${
                    dimension === item.id
                      ? "bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-900 dark:hover:text-slate-100"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          )}
          <div className="flex min-w-64 flex-1 items-center gap-2 lg:max-w-xl">
            <button
              type="button"
              onClick={() => selectYear(selectedYear - 1)}
              disabled={selectedYear <= firstYear}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30 dark:hover:bg-slate-900 dark:hover:text-white"
              aria-label="Previous year"
            >
              <ChevronLeft size={15} />
            </button>
            <span className="font-mono text-[10px] text-slate-400 tabular-nums">{firstYear}</span>
            <label className="relative flex-1">
              <span className="sr-only">Year</span>
              <input
                type="range"
                min={firstYear}
                max={lastYear}
                step={1}
                value={selectedYear}
                onChange={(event) => selectYear(Number(event.target.value))}
                className="h-1.5 w-full cursor-pointer appearance-none rounded-full accent-slate-950 dark:accent-white"
                style={{
                  background: `linear-gradient(to right, #cbd5e1 0%, #cbd5e1 ${
                    ((series.observedThrough - firstYear) / Math.max(1, lastYear - firstYear)) * 100
                  }%, #a5b4fc ${((series.observedThrough - firstYear) / Math.max(1, lastYear - firstYear)) * 100}%, #a5b4fc 100%)`,
                }}
              />
            </label>
            <span className="font-mono text-[10px] text-slate-400 tabular-nums">{lastYear}</span>
            <button
              type="button"
              onClick={() => selectYear(selectedYear + 1)}
              disabled={selectedYear >= lastYear}
              className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-950 disabled:opacity-30 dark:hover:bg-slate-900 dark:hover:text-white"
              aria-label="Next year"
            >
              <ChevronRight size={15} />
            </button>
          </div>
          <div className="flex items-center gap-2 pl-1">
            <span className="font-mono text-lg font-semibold tabular-nums text-slate-950 dark:text-white">
              {selectedYear}
            </span>
            <StatusBadge provenance={provenance} align="right" />
          </div>
        </div>
      </section>

      {shownNotice ? (
        <div
          role="status"
          className="flex items-start justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <span className="inline-flex items-start gap-2">
            <Info size={15} className="mt-0.5 shrink-0" />
            {shownNotice}
          </span>
          <button
            type="button"
            onClick={dismissNotice}
            aria-label="Dismiss"
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X size={15} />
          </button>
        </div>
      ) : null}

      <div className="space-y-5">
        <section className="rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <div className="flex min-w-0 items-center gap-3">
              {state ? (
                <button
                  type="button"
                  onClick={goUp}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 hover:text-slate-950 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900 dark:hover:text-white"
                >
                  <ArrowLeft size={13} />
                  {city ? state.name : "United States"}
                </button>
              ) : null}
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-950 dark:text-white">
                  {focusCategory.label} · {selectedYear}
                </p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {!state
                    ? "Select a state to open it"
                    : showCities
                      ? `Cities in ${state.name} with 65,000+ residents · Esc to go back`
                      : `${national.label} is estimated for states, not cities · Esc to go back`}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div
                role="group"
                aria-label="Map by"
                className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900"
              >
                {(
                  [
                    ["share", "Share"],
                    ["change", "Change"],
                  ] as const
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setMode(id)}
                    aria-pressed={mode === id}
                    className={`rounded-md px-2 py-1 text-[11px] font-semibold transition-colors ${
                      mode === id
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {showCities ? (
                cityFile && cityFile.regions.length ? (
                  <PlacePicker
                    id="demographics-city"
                    label="City"
                    value={city?.id ?? ""}
                    placeholder="Jump to a city…"
                    clearLabel={city ? `All of ${state?.name}` : undefined}
                    options={cityFile.regions.map((item) => ({
                      id: item.id,
                      name: item.name,
                      disabled: !item.series[dimension],
                    }))}
                    onChange={(value) => (value ? selectCity(value) : navigate({ state: state!.id, city: null }))}
                  />
                ) : null
              ) : (
                <PlacePicker
                  id="demographics-state"
                  label="State"
                  value={state?.id ?? ""}
                  placeholder="Jump to a state…"
                  clearLabel="All states"
                  options={[...(statesFile?.regions ?? [])]
                    .sort((a, b) => a.name.localeCompare(b.name))
                    .map((item) => ({ id: item.id, name: item.name, short: item.abbr }))}
                  onChange={(value) => (value ? selectState(value) : goNational())}
                />
              )}
            </div>
          </div>

          <div className="flex flex-col lg:grid lg:grid-cols-[minmax(0,1fr)_18rem]">
            <GroupPicker
              series={series}
              point={point}
              baseline={changeFrom}
              focus={focus}
              onFocus={(category) => setGroups((current) => ({ ...current, [dimension]: category }))}
              compare={parent ? { label: parentLabel, point: pointAt(parent, selectedYear) ?? null } : null}
              population={population}
              projected={isProjected(series, point)}
            />

            <div className="order-2 min-w-0 lg:order-1">
              <DemographicsMap
                states={mapStates}
                cities={mapCities}
                selectedStateId={state?.id ?? null}
                selectedCityId={city?.id ?? null}
                cityLevel={showCities}
                color={focusCategory.color}
                scale={mode === "change" ? "diverging" : "sequential"}
                formatValue={formatValue}
                onSelectState={selectState}
                onSelectCity={selectCity}
                onBack={goUp}
                onNational={goNational}
              />

              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 px-5 py-3 text-[10px] text-slate-500 dark:text-slate-400">
                {legendHasData ? (
                  <span className="inline-flex items-center gap-2">
                    <span className="font-semibold text-slate-600 dark:text-slate-300">Color</span>
                    {mode === "change" ? (
                      <>
                        <span className="font-mono tabular-nums">−{divergingExtent(legendValues).toFixed(1)} pp</span>
                        <span
                          className="h-2 w-40 rounded-full"
                          style={{
                            background: `linear-gradient(to right, ${NEGATIVE_COLOR}, color-mix(in srgb, ${NEGATIVE_COLOR} 10%, transparent), color-mix(in srgb, ${focusCategory.color} 10%, transparent), ${focusCategory.color})`,
                          }}
                        />
                        <span className="font-mono tabular-nums">+{divergingExtent(legendValues).toFixed(1)} pp</span>
                        <span>
                          change in {focusCategory.label} share since {mapBaseline}
                        </span>
                      </>
                    ) : (
                      <>
                        <span className="font-mono tabular-nums">{valueExtent(legendValues)[0].toFixed(1)}%</span>
                        <span
                          className="h-2 w-40 rounded-full"
                          style={{
                            background: `linear-gradient(to right, color-mix(in srgb, ${focusCategory.color} 12%, transparent), ${focusCategory.color})`,
                          }}
                        />
                        <span className="font-mono tabular-nums">{valueExtent(legendValues)[1].toFixed(1)}%</span>
                        <span>
                          {focusCategory.label}, {showCities ? "by city" : "by state"}
                        </span>
                      </>
                    )}
                  </span>
                ) : (
                  <span>
                    No {showCities ? "city" : "state"} figures for {selectedYear}.
                  </span>
                )}
                {showCities ? (
                  <>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="font-semibold text-slate-600 dark:text-slate-300">Size</span>
                      <svg width="34" height="16" aria-hidden="true">
                        <circle cx="5" cy="10" r="4" fill="none" stroke="currentColor" />
                        <circle cx="23" cy="8" r="7.5" fill="none" stroke="currentColor" />
                      </svg>
                      city population (2024)
                    </span>
                    <span className="inline-flex items-center gap-1.5">
                      <span className="h-2.5 w-2.5 rounded-full bg-slate-300" /> not published for this city
                    </span>
                    <InfoTip label="Why only cities of 65,000+" align="right">
                      The Census Bureau&apos;s American Community Survey publishes 1-year estimates only for places with
                      65,000 or more residents. Smaller places have 5-year estimates only, which aren&apos;t comparable
                      year to year, so they&apos;re left off.
                    </InfoTip>
                  </>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 px-5 py-4 dark:border-slate-800">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2.5">
                <h2 className="text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
                  {series.label} · {placeName}
                </h2>
                <StatusBadge provenance={provenance} />
              </div>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                {series.description} · {series.population}
                {loadingRegion ? " · loading…" : ""}
              </p>
              <p className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
                {STATUS_LABEL[pastProvenance.status]} by {pastProvenance.by} through {series.observedThrough} ·
                projected by {futureProvenance.by} to {lastYear}
              </p>
            </div>
            <p className="font-mono text-2xl font-semibold tabular-nums text-slate-950 dark:text-white">
              {selectedYear}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4">
            <div className="flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() =>
                  moveView(viewRange.start - Math.max(1, Math.round((viewRange.end - viewRange.start) / 3)))
                }
                className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="Show earlier years"
              >
                <ChevronLeft size={15} />
              </button>
              <span className="min-w-24 text-center font-mono font-medium tabular-nums">
                {viewRange.start}–{viewRange.end}
              </span>
              <button
                type="button"
                onClick={() =>
                  moveView(viewRange.start + Math.max(1, Math.round((viewRange.end - viewRange.start) / 3)))
                }
                className="rounded-lg p-1.5 hover:bg-slate-100 hover:text-slate-950 dark:hover:bg-slate-900 dark:hover:text-white"
                aria-label="Show later years"
              >
                <ChevronRight size={15} />
              </button>
              <span className="ml-2 hidden text-[10px] tracking-wide uppercase sm:inline">
                Click a year · drag to pan
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg bg-slate-100 p-1 dark:bg-slate-900">
              {([10, 25, 50, "all"] as const).map((span) => {
                const active =
                  span === "all"
                    ? viewRange.start === firstYear && viewRange.end === lastYear
                    : viewRange.end - viewRange.start === span;
                const fits = span === "all" || span <= lastYear - firstYear;
                return (
                  <button
                    key={span}
                    type="button"
                    disabled={!fits}
                    onClick={() => setViewSpan(span)}
                    className={`rounded-md px-2 py-1 text-[10px] font-semibold transition-colors disabled:opacity-30 ${
                      active
                        ? "bg-white text-slate-950 shadow-sm dark:bg-slate-800 dark:text-white"
                        : "text-slate-500 hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
                    }`}
                    aria-pressed={active}
                  >
                    {span === "all" ? "All" : `${span}Y`}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="px-4 pt-1 sm:px-5">
            <TrendChart
              series={series}
              focus={focus}
              selectedYear={selectedYear}
              visibleStart={viewRange.start}
              visibleEnd={viewRange.end}
              onPan={moveView}
              onSelectYear={selectYear}
              compare={parent ? { label: parentLabel, points: parent.points } : null}
              published={published}
              pastModeled={published !== null && published.length === 0}
            />
          </div>

          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 px-5 pb-4 text-[10px] text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="6" aria-hidden="true">
                <line
                  x1="1"
                  x2="21"
                  y1="3"
                  y2="3"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeDasharray={published?.length === 0 ? "2 4" : undefined}
                />
              </svg>
              {published?.length === 0
                ? "Modeled by Worldview"
                : `${STATUS_LABEL[pastProvenance.status]} (${pastProvenance.by})`}
            </span>
            {published && published.length ? (
              <span className="inline-flex items-center gap-1.5">
                <svg width="8" height="8" aria-hidden="true">
                  <circle cx="4" cy="4" r="3.5" fill="currentColor" />
                </svg>
                Survey year; lines between are interpolated
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <svg width="22" height="12" aria-hidden="true">
                <rect x="0" y="2" width="22" height="8" fill="currentColor" opacity="0.14" />
                <line x1="1" x2="21" y1="2" y2="2" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
                <line x1="1" x2="21" y1="10" y2="10" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" />
              </svg>
              Scenario range, not a confidence interval
              <InfoTip label="What the projection range means">
                <span className="block">{rangeExplanation(series, level, places)}</span>
                <span className="mt-2 block text-[11px] text-slate-500 dark:text-slate-400">
                  The band runs from the lowest to the highest scenario. No probability is attached to it, so it is not
                  a 95% confidence interval.
                </span>
              </InfoTip>
            </span>
            {parent ? (
              <span className="inline-flex items-center gap-1.5">
                <svg width="22" height="6" aria-hidden="true">
                  <line
                    x1="1"
                    x2="21"
                    y1="3"
                    y2="3"
                    stroke="#64748b"
                    strokeWidth="1.75"
                    strokeDasharray="1 4"
                    strokeLinecap="round"
                  />
                </svg>
                {parentLabel} {focusCategory.label}, for comparison
              </span>
            ) : null}
          </div>
        </section>

        {topicPage ? (
          <Link
            href={`${topicPage.href}${viewQuery(false)}`}
            className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline dark:text-blue-300"
          >
            {topicPage.blurb}
            <ArrowUpRight size={13} />
          </Link>
        ) : null}

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-950">
          <div className="border-b border-slate-200 px-5 py-3 dark:border-slate-800">
            <h2 className="text-sm font-semibold text-slate-950 dark:text-white">
              {focusCategory.label} by {showCities ? `city in ${state?.name}` : "state"}, {selectedYear}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Select a column to sort, a row to open it. {END_YEAR} figures are the projected scenario range.
            </p>
          </div>
          <RegionTable
            rows={tableRows}
            reference={referenceRow}
            placeLabel={showCities ? "City" : "State"}
            groupLabel={focusCategory.label}
            year={selectedYear}
            baselineYear={mapBaseline}
            endYear={END_YEAR}
            peopleLabel={universe === "adults" ? "Adults" : "People"}
            selectedId={showCities ? (city?.id ?? null) : (state?.id ?? null)}
            onSelect={showCities ? selectCity : selectState}
          />
        </section>
      </div>

      <section
        aria-labelledby="demographics-method"
        className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-950"
      >
        <h2 id="demographics-method" className="text-sm font-semibold text-slate-950 dark:text-white">
          About these {national.label.toLowerCase()} figures · {placeName}
        </h2>
        <dl className="mt-4 grid gap-5 text-xs leading-5 text-slate-600 sm:grid-cols-2 xl:grid-cols-4 dark:text-slate-300">
          <div>
            <dt className="font-semibold text-slate-900 dark:text-white">What&apos;s measured</dt>
            <dd className="mt-1">
              {national.definition} Shares are of{" "}
              {universe === "adults" ? "adults 18 and over" : "all residents, every age"}.
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900 dark:text-white">Through {series.observedThrough}</dt>
            <dd className="mt-1">
              <span className="font-medium">
                {STATUS_LABEL[pastProvenance.status]} · {pastProvenance.by}.
              </span>{" "}
              {pastProvenance.detail}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900 dark:text-white">After {series.observedThrough}</dt>
            <dd className="mt-1">
              <span className="font-medium">Projected · {futureProvenance.by}.</span> {futureProvenance.detail}{" "}
              <span className="font-medium">Range:</span> {rangeExplanation(series, level, places)}
            </dd>
          </div>
          <div>
            <dt className="font-semibold text-slate-900 dark:text-white">Geography</dt>
            <dd className="mt-1">
              Published for {national.geographies.map((geo) => GEO_LABEL[geo]).join(", ")}.
              {citySupported
                ? " City figures cover places with 65,000+ residents, the threshold for ACS 1-year estimates."
                : ` No source estimates ${national.label.toLowerCase()} for individual cities.`}
            </dd>
          </div>
        </dl>
        {national.categoryNotes ? (
          <dl className="mt-5 grid gap-x-5 gap-y-2 border-t border-slate-100 pt-4 text-xs leading-5 sm:grid-cols-2 dark:border-slate-900">
            {series.categories
              .filter((category) => national.categoryNotes?.[category.id])
              .map((category) => (
                <div key={category.id} className="flex gap-2">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: category.color }} />
                  <div>
                    <dt className="inline font-semibold text-slate-900 dark:text-white">{category.label}: </dt>
                    <dd className="inline text-slate-600 dark:text-slate-300">
                      {national.categoryNotes?.[category.id]}
                    </dd>
                  </div>
                </div>
              ))}
          </dl>
        ) : null}
        <div className="mt-5 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-4 dark:border-slate-900">
          <span className="text-[10px] font-semibold tracking-[0.14em] text-slate-400 uppercase">Sources</span>
          {series.sources.map((source) => (
            <a
              key={source.href}
              href={source.href}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-xs font-medium text-slate-500 transition-colors hover:text-slate-950 dark:text-slate-400 dark:hover:text-white"
            >
              {source.label}
              <ArrowUpRight size={11} />
            </a>
          ))}
        </div>
      </section>
    </div>
  );
}
