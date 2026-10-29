"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { formatSigned, formatValue, pctChange } from "@/lib/format";
import { CLEARED, OFFENSES, offenseLabel, type OffenseKey, type StateCrimeData, type StateDetail } from "@/lib/crime/offenses";
import { CitiesTable } from "./cities-table";

const TOTALS = new Set<string>(["violent_crime", "property_crime"]);
const signed = (v: number | null) => (v === null ? "—" : formatSigned(v, "percent"));

// Every offense for one state in the Atlas year, beside the compared state
// and the nation, then the state's large-city departments and counties.
export function StateBreakdown({
  data,
  abbr,
  compare,
  metric,
  year,
  latestYear,
  onPickCity,
  onClose,
}: {
  data: StateCrimeData;
  abbr: string;
  compare: string;
  metric: OffenseKey;
  year: string;
  latestYear: string;
  onPickCity: (ori: string) => void;
  onClose: () => void;
}) {
  const row = data.rows.find((r) => r.abbr === abbr)!;
  const other = compare ? data.rows.find((r) => r.abbr === compare) : undefined;
  const i = data.years.indexOf(year);
  const j = i - 1;
  const cell = "px-3 py-1.5 text-right tabular-nums";
  const latest = year === latestYear;

  return (
    <section className="rounded-2xl border border-slate-300 p-5 dark:border-slate-700" aria-label={`${row.name} breakdown`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium tracking-wide text-slate-400 uppercase">Breakdown · {year}</p>
          <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{row.name}</h3>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close breakdown"
          className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-white"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="mt-4 min-w-0 overflow-x-auto">
        <table className="w-full min-w-md text-sm">
          <thead className="text-xs text-slate-500 dark:text-slate-400">
            <tr className="border-b border-slate-200 dark:border-slate-800">
              <th className="px-3 py-2 text-left font-medium">Per 100,000</th>
              <th className="px-3 py-2 text-right font-medium">{row.abbr}</th>
              <th className="px-3 py-2 text-right font-medium">vs {j >= 0 ? data.years[j] : "prior"}</th>
              {other && <th className="px-3 py-2 text-right font-medium">{other.abbr}</th>}
              <th className="px-3 py-2 text-right font-medium">U.S.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {OFFENSES.map((o) => (
              <tr key={o.key} className={o.key === metric ? "bg-slate-50 font-medium dark:bg-slate-900/60" : ""}>
                <td className={`py-1.5 pr-3 text-slate-700 dark:text-slate-200 ${TOTALS.has(o.key) ? "pl-3" : "pl-6"}`}>{o.label}</td>
                <td className={`${cell} text-slate-900 dark:text-white`}>{formatValue(row.rates[o.key][i], "per_100k")}</td>
                <td className={`${cell} text-slate-500 dark:text-slate-400`}>
                  {signed(pctChange(row.rates[o.key][i], j >= 0 ? row.rates[o.key][j] : null))}
                </td>
                {other && <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(other.rates[o.key][i], "per_100k")}</td>}
                <td className={`${cell} text-slate-600 dark:text-slate-300`}>{formatValue(data.us[o.key][i], "per_100k")}</td>
              </tr>
            ))}
            {latest &&
              CLEARED.map((k) => (
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
                <ExtraRow label={`Homicide deaths, ${data.extra.cdcYear} (CDC)`} pick={(e) => e.homicideDeaths} unit="per_100k" data={data} abbr={row.abbr} other={other?.abbr} cell={cell} />
                <ExtraRow label={`Firearm homicide deaths, ${data.extra.cdcYear} (CDC)`} pick={(e) => e.firearmHomicide} unit="per_100k" data={data} abbr={row.abbr} other={other?.abbr} cell={cell} />
                <ExtraRow label={`Hate crime incidents, ${data.extra.hateYear}`} pick={(e) => e.hateIncidents} unit="incidents" data={data} abbr={row.abbr} other={other?.abbr} cell={cell} />
              </>
            )}
          </tbody>
        </table>
        {!latest && <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">State clearance shares are loaded for {latestYear} only.</p>}
      </div>

      <LocalDetail abbr={row.abbr} name={row.name} year={latestYear} onPickCity={onPickCity} />
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
function LocalDetail({ abbr, name, year, onPickCity }: { abbr: string; name: string; year: string; onPickCity: (ori: string) => void }) {
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
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Police departments of cities over 100,000 in {name}, {year}</p>
        <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">Each department&apos;s own jurisdiction and the population it serves. Click one to inspect it on the map.</p>
        <CitiesTable rows={d.cities} year={year} compact onSelect={onPickCity} />
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
