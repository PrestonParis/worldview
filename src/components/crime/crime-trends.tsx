"use client";

import { useState } from "react";
import { TimeSeriesChart, type Marker, type Series, type SeriesSlot } from "@/components/charts/time-series-chart";
import { formatSigned, formatValue, pctChange } from "@/lib/format";
import { OFFENSES, type OffenseKey, type OffenseTrend, type StateCrimeData } from "@/lib/crime/offenses";
import { Chip, Segmented } from "./segmented";
import { useCrimeSelection } from "./selection";

type Mode = "rate" | "index";

// Annual rates over a chosen span of years, compared across offenses
// (national: small multiples, or indexed to the span's first year on one
// scale) or across places (the Atlas offense for its state, a compared
// state, and the nation). A table view lists every value.
export function CrimeTrends({
  offenses,
  states,
  flaggedYears,
}: {
  offenses: OffenseTrend[];
  states: StateCrimeData;
  flaggedYears: { year: string; coverage: number | null }[];
}) {
  const allYears = offenses[0]?.rates.map((p) => p.year) ?? [];
  const [compare, setCompare] = useState<"offenses" | "places">("offenses");
  const [mode, setMode] = useState<Mode>("index");
  const [view, setView] = useState<"chart" | "table">("chart");
  const [picked, setPicked] = useState<OffenseKey[]>(["violent_crime", "homicide", "property_crime"]);
  const [range, setRange] = useState<[string, string]>([allYears[0] ?? "", allYears.at(-1) ?? ""]);
  const inRange = (y: string) => y >= range[0] && y <= range[1];
  const baseYear = range[0];

  const markers: Marker[] = flaggedYears.map((f) => ({ x: Number(f.year), label: "Partial reporting" }));
  const flagged = new Set(flaggedYears.map((f) => f.year));
  const indexed = (o: OffenseTrend) => {
    const base = o.rates.find((p) => p.year === baseYear)?.value;
    return o.rates.map((p) => ({ year: p.year, value: base ? (p.value / base) * 100 : NaN }));
  };
  const points = (o: OffenseTrend) =>
    (mode === "index" ? indexed(o) : o.rates).filter((p) => inRange(p.year)).map((p) => ({ x: Number(p.year), label: p.year, value: p.value }));
  const unit = mode === "index" ? "index" : "per_100k";
  // Colors follow the offense, not the pick order, so a line keeps its color
  // as others are toggled.
  const order = offenses.map((o) => o.key);
  const slotOf = (k: OffenseKey) => ((order.indexOf(k) % 9) + 1) as SeriesSlot;

  const toggle = (k: OffenseKey) =>
    setPicked((cur) => (cur.includes(k) ? (cur.length > 1 ? cur.filter((x) => x !== k) : cur) : order.filter((x) => x === k || cur.includes(x))));

  const years = allYears.filter(inRange);

  return (
    <div className="space-y-5">
      <YearRange years={allYears} range={range} flagged={flagged} onChange={setRange} />
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Compare"
          value={compare}
          onChange={setCompare}
          options={[
            { value: "offenses", label: "Across offenses" },
            { value: "places", label: "Across places" },
          ]}
        />
        {compare === "offenses" && (
          <Segmented
            label="Measure"
            value={mode}
            onChange={setMode}
            options={[
              { value: "rate", label: "Rate per 100,000" },
              { value: "index", label: `Indexed, ${baseYear} = 100` },
            ]}
          />
        )}
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

      {compare === "places" ? (
        <PlacesTrend states={states} years={years} markers={markers} view={view} flagged={flagged} />
      ) : view === "table" ? (
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
            Each line is that offense&apos;s rate as a share of its {baseYear} rate. Pick any.
          </p>
          <TimeSeriesChart
            series={picked.map(
              (k): Series => {
                const o = offenses.find((x) => x.key === k)!;
                return { id: k, label: o.label, slot: slotOf(k), points: points(o) };
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
                {(() => {
                  const ch = pctChange(o.rates.find((p) => p.year === range[1])?.value ?? null, o.rates.find((p) => p.year === range[0])?.value ?? null);
                  return ch === null ? null : (
                    <p className="shrink-0 text-xs text-slate-500 tabular-nums dark:text-slate-400">
                      {formatSigned(ch, "percent")} since {baseYear}
                    </p>
                  );
                })()}
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

// The span of years every Trends chart shows: click a year outside the span
// to extend it, or inside to move the nearer end.
function YearRange({ years, range, flagged, onChange }: { years: string[]; range: [string, string]; flagged: Set<string>; onChange: (r: [string, string]) => void }) {
  const [a, b] = range.map((y) => years.indexOf(y));
  const pick = (k: number) => {
    if (k < a) return onChange([years[k], range[1]]);
    if (k > b) return onChange([range[0], years[k]]);
    // Inside: move the nearer end, keeping at least two years.
    if (k - a <= b - k) onChange([years[Math.min(k, b - 1)], range[1]]);
    else onChange([range[0], years[Math.max(k, a + 1)]]);
  };
  const full = a === 0 && b === years.length - 1;
  return (
    <div className="flex items-center gap-3">
      <div role="group" aria-label={`Years ${range[0]} to ${range[1]}`} className="flex min-w-0 flex-1 overflow-x-auto rounded-full bg-slate-100 p-0.5 dark:bg-slate-900">
        {years.map((y, k) => {
          const on = k >= a && k <= b;
          const end = k === a || k === b;
          return (
            <button
              key={y}
              type="button"
              onClick={() => pick(k)}
              aria-pressed={on}
              title={flagged.has(y) ? `${y} · partial reporting` : y}
              className={`min-w-11 flex-1 py-1 text-xs tabular-nums ${k === a ? "rounded-l-full" : ""} ${k === b ? "rounded-r-full" : ""} ${
                on
                  ? end
                    ? "bg-slate-900 font-semibold text-white dark:bg-white dark:text-slate-900"
                    : "bg-slate-300/70 text-slate-900 dark:bg-slate-700 dark:text-white"
                  : "text-slate-400 hover:text-slate-900 dark:hover:text-white"
              } ${flagged.has(y) && !end ? "underline decoration-amber-500 decoration-2 underline-offset-4" : ""}`}
            >
              {y}
            </button>
          );
        })}
      </div>
      {!full && (
        <button type="button" onClick={() => onChange([years[0], years.at(-1)!])} className="shrink-0 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">
          All years
        </button>
      )}
    </div>
  );
}

// One offense across places. The offense and the first place are the
// Atlas's own selection, so changing them here moves the map too.
function PlacesTrend({
  states,
  years,
  markers,
  view,
  flagged,
}: {
  states: StateCrimeData;
  years: string[];
  markers: Marker[];
  view: "chart" | "table";
  flagged: Set<string>;
}) {
  const sel = useCrimeSelection();
  const ctl = "rounded-full border border-slate-200 bg-transparent px-3 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100";
  const places = [
    ...(sel.state ? [{ id: sel.state, slot: 1 as const }] : []),
    ...(sel.compare ? [{ id: sel.compare, slot: 2 as const }] : []),
    { id: "US", slot: (sel.state ? 9 : 1) as SeriesSlot },
  ].map((p) => {
    const row = p.id === "US" ? null : states.rows.find((r) => r.abbr === p.id);
    const values = row ? row.rates[sel.offense] : states.us[sel.offense];
    return { ...p, label: row?.name ?? "United States", values: states.years.map((y, k) => ({ year: y, value: values[k] })) };
  });
  const series: Series[] = places.map((p) => ({
    id: p.id,
    label: p.label,
    slot: p.slot,
    points: p.values.filter((v): v is { year: string; value: number } => v.value !== null && years.includes(v.year)).map((v) => ({ x: Number(v.year), label: v.year, value: v.value })),
  }));
  const offense = OFFENSES.find((o) => o.key === sel.offense)!;

  return (
    <div className="space-y-4 rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <select aria-label="Offense" value={sel.offense} onChange={(e) => sel.set({ offense: e.target.value as OffenseKey })} className={`${ctl} font-medium`}>
          {OFFENSES.map((o) => (
            <option key={o.key} value={o.key}>
              {o.label}
            </option>
          ))}
        </select>
        <span className="text-slate-500 dark:text-slate-400">in</span>
        <select aria-label="Place" value={sel.state ?? ""} onChange={(e) => sel.set({ state: e.target.value || null, city: null, compare: e.target.value === sel.compare ? "" : sel.compare })} className={ctl}>
          <option value="">United States</option>
          {states.rows.map((r) => (
            <option key={r.abbr} value={r.abbr}>
              {r.name}
            </option>
          ))}
        </select>
        <span className="text-slate-500 dark:text-slate-400">vs</span>
        <select aria-label="Compare with" value={sel.compare} onChange={(e) => sel.set({ compare: e.target.value })} className={ctl}>
          <option value="">—</option>
          {states.rows
            .filter((r) => r.abbr !== sel.state)
            .map((r) => (
              <option key={r.abbr} value={r.abbr}>
                {r.name}
              </option>
            ))}
        </select>
        <span className="text-xs text-slate-400">Shared with the Atlas</span>
      </div>
      {view === "table" ? (
        <div className="max-h-[28rem] overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 dark:text-slate-400">
              <tr className="border-b border-slate-200 dark:border-slate-800">
                <th className="px-3 py-2 text-left font-medium">Year</th>
                {places.map((p) => (
                  <th key={p.id} className="px-3 py-2 text-right font-medium">
                    {p.label}
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
                  {places.map((p) => (
                    <td key={p.id} className="px-3 py-1.5 text-right text-slate-600 tabular-nums dark:text-slate-300">
                      {formatValue(p.values.find((v) => v.year === y)?.value, "per_100k")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <TimeSeriesChart series={series} unit="per_100k" height={320} markers={markers} />
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">{offense.label}, offenses per 100,000 residents</p>
    </div>
  );
}
