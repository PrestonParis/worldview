"use client";

import { useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { formatSigned, formatValue } from "@/lib/format";
import type { CityRow } from "@/lib/crime/offenses";

type Key = "name" | "state" | "population" | "violent" | "murder" | "property" | "violentChange" | "staffing";

const COLUMNS: { key: Key; label: string; hint?: string; unit?: string }[] = [
  { key: "name", label: "City" },
  { key: "state", label: "State" },
  { key: "population", label: "Population", unit: "people" },
  { key: "violent", label: "Violent crime", hint: "per 100,000", unit: "per_100k" },
  { key: "murder", label: "Murder", hint: "per 100,000", unit: "per_100k" },
  { key: "property", label: "Property crime", hint: "per 100,000", unit: "per_100k" },
  { key: "violentChange", label: "Violent, 1-year", hint: "change" },
  { key: "staffing", label: "Police staff", hint: "per 1,000", unit: "per_1000" },
];

// Every large-city police department, sortable and searchable. Used on its
// own and, filtered to one state, inside the state profile.
export function CitiesTable({ rows, year, compact = false }: { rows: CityRow[]; year: string; compact?: boolean }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: Key; dir: 1 | -1 }>({ key: compact ? "violent" : "population", dir: -1 });
  const q = query.trim().toLowerCase();
  const shown = rows
    .filter((r) => !q || r.name.toLowerCase().includes(q) || r.state.toLowerCase() === q)
    .sort((a, b) => {
      if (sort.key === "name" || sort.key === "state") return a[sort.key].localeCompare(b[sort.key]) * sort.dir;
      return ((a[sort.key] ?? -Infinity) - (b[sort.key] ?? -Infinity)) * sort.dir;
    });
  const cols = compact ? COLUMNS.filter((c) => c.key !== "state") : COLUMNS;

  return (
    <div className="space-y-3">
      {!compact && (
        <label className="relative block w-full max-w-xs">
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Find a city or state (GA)"
            aria-label="Find a city"
            className="w-full rounded-full border border-slate-200 bg-transparent py-1.5 pr-3 pl-9 text-sm outline-none focus:border-slate-400 dark:border-slate-700"
          />
        </label>
      )}
      <div className={`${compact ? "max-h-80" : "max-h-[32rem]"} overflow-auto rounded-xl border border-slate-200 dark:border-slate-800`}>
        <table className="w-full min-w-[44rem] text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              {cols.map((c) => (
                <th key={c.key} className={`px-3 py-2 align-bottom font-medium ${c.key === "name" || c.key === "state" ? "text-left" : "text-right"}`}>
                  <button
                    type="button"
                    onClick={() =>
                      setSort((s) => ({ key: c.key, dir: s.key === c.key ? ((-s.dir) as 1 | -1) : c.key === "name" || c.key === "state" ? 1 : -1 }))
                    }
                    className="inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white"
                  >
                    {c.label}
                    {sort.key === c.key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
                  </button>
                  {c.hint && <span className="block font-normal text-slate-400">{c.hint}</span>}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.map((r) => (
              <tr key={r.ori} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                {cols.map((c) => {
                  if (c.key === "name")
                    return (
                      <td key={c.key} className="px-3 py-1.5 text-slate-700 dark:text-slate-200">
                        {r.name}
                        {r.partial && (
                          <span className="ml-1 text-slate-400" title={`Incomplete data for ${year}`}>
                            †
                          </span>
                        )}
                      </td>
                    );
                  if (c.key === "state") return <td key={c.key} className="px-3 py-1.5 text-slate-500 dark:text-slate-400">{r.state}</td>;
                  const v = r[c.key];
                  return (
                    <td
                      key={c.key}
                      className={`px-3 py-1.5 text-right tabular-nums ${c.key === "violent" ? "font-medium text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`}
                    >
                      {c.key === "violentChange" ? (v === null ? "—" : formatSigned(v, "percent")) : formatValue(v, c.unit)}
                    </td>
                  );
                })}
              </tr>
            ))}
            {!shown.length && (
              <tr>
                <td colSpan={cols.length} className="px-3 py-6 text-center text-slate-400">
                  {rows.length ? `No city matches “${query}”.` : "No large-city departments loaded for this state."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-400">
        Rates for {year} use the population each department serves. † The department reported incomplete data for {year} — missing months, or far fewer offenses than its usual year.
      </p>
    </div>
  );
}
