"use client";

import { useMemo, useState } from "react";
import { SortTh, useTableSort } from "@/components/data/sortable-table";
import { SearchInput } from "@/components/search/search-input";
import { partyColorFor } from "@/lib/party-colors";
import type { AreaBreakdown } from "@/lib/validation/electionResult";

export function AreaResultsTable({
  areas,
  onSelectArea,
  selectedAreaId,
}: {
  areas: AreaBreakdown[];
  onSelectArea?: (areaId: string) => void;
  selectedAreaId?: string | null;
}) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? areas.filter((a) => a.areaName.toLowerCase().includes(q)) : areas;
  }, [areas, query]);
  const { sorted: visible, sort, toggle } = useTableSort(
    filtered,
    (a, col) => [(a.areaName || a.areaId).toLowerCase(), a.leaderParty || null, a.marginPct, a.total][col],
    { col: 2, dir: -1 },
  );

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder="Search counties…" />
        <span className="text-xs text-slate-400">{visible.length} areas</span>
      </div>

      <div className="mt-4 max-h-[440px] overflow-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[520px] border-collapse text-sm">
          <thead className="sticky top-0 bg-white dark:bg-slate-950">
            <tr className="border-b border-slate-200 text-left text-xs tracking-wider text-slate-400 uppercase dark:border-slate-800">
              {["County", "Winner", "Margin", "Votes"].map((label, i) => (
                <SortTh key={label} col={i} sort={sort} onSort={toggle} className="py-2 pr-4 font-medium uppercase">
                  {label}
                </SortTh>
              ))}
            </tr>
          </thead>
          <tbody>
            {visible.map((a) => {
              const color = partyColorFor(a.leaderParty);
              return (
                <tr
                  key={a.areaId}
                  onClick={() => onSelectArea?.(a.areaId)}
                  className={`border-b border-slate-100 dark:border-slate-900 ${
                    onSelectArea ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/50" : ""
                  } ${a.areaId === selectedAreaId ? "bg-slate-100 dark:bg-slate-900" : ""}`}
                >
                  <td className="py-2 pr-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                    {a.areaName || a.areaId}
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    <span className="inline-flex items-center gap-1.5">
                      <span
                        className="inline-block h-2 w-2 rounded-full"
                        style={{ background: color.border }}
                        aria-hidden
                      />
                      {a.leaderParty || "N/A"}
                    </span>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap tabular-nums" style={{ color: color.text }}>
                    +{a.marginPct.toFixed(1)} pts
                    <span className="ml-1 text-slate-400">({a.margin.toLocaleString()})</span>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">
                    {a.total.toLocaleString()}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
