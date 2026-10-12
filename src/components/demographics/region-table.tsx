"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { changeTone, formatPeople, formatPoints, formatRange, formatShare } from "./format";

export interface TableRow {
  id: string;
  name: string;
  share: number | null;
  people: number | null;
  change: number | null;
  end: [number, number] | null; // projected range in the last year
  selectable: boolean;
}

type SortKey = "name" | "share" | "people" | "change" | "end";

const value = (row: TableRow, key: SortKey): number | string | null =>
  key === "name" ? row.name : key === "end" ? (row.end ? (row.end[0] + row.end[1]) / 2 : null) : row[key];

export function RegionTable({
  rows,
  reference,
  placeLabel,
  groupLabel,
  year,
  baselineYear,
  endYear,
  peopleLabel,
  selectedId,
  onSelect,
}: {
  rows: TableRow[];
  reference: TableRow | null;
  placeLabel: string;
  groupLabel: string;
  year: number;
  baselineYear: number | null;
  endYear: number;
  peopleLabel: string;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; descending: boolean }>({ key: "share", descending: true });
  const sorted = useMemo(() => {
    const out = [...rows];
    out.sort((a, b) => {
      const left = value(a, sort.key);
      const right = value(b, sort.key);
      // Missing values sink to the bottom whichever way the column sorts.
      if (left === null) return right === null ? 0 : 1;
      if (right === null) return -1;
      const order = typeof left === "string" ? left.localeCompare(String(right)) : left - (right as number);
      return sort.descending ? -order : order;
    });
    return out;
  }, [rows, sort]);
  const hasPeople = rows.some((row) => row.people !== null);
  const hasChange = baselineYear !== null && rows.some((row) => row.change !== null);

  const header = (key: SortKey, label: string, align: "left" | "right" = "right") => {
    const active = sort.key === key;
    return (
      <th
        scope="col"
        aria-sort={active ? (sort.descending ? "descending" : "ascending") : "none"}
        className={`px-3 py-2 font-semibold ${align === "right" ? "text-right" : "text-left"}`}
      >
        <button
          type="button"
          onClick={() =>
            setSort((current) => ({ key, descending: current.key === key ? !current.descending : key !== "name" }))
          }
          className={`inline-flex items-center gap-1 hover:text-slate-950 dark:hover:text-white ${
            active ? "text-slate-900 dark:text-white" : ""
          }`}
        >
          {label}
          {active ? sort.descending ? <ArrowDown size={11} /> : <ArrowUp size={11} /> : null}
        </button>
      </th>
    );
  };

  const cells = (row: TableRow) => (
    <>
      <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-950 dark:text-white">
        {row.share === null ? "—" : formatShare(row.share)}
      </td>
      {hasPeople ? (
        <td className="px-3 py-2 text-right font-mono tabular-nums text-slate-600 dark:text-slate-300">
          {row.people === null ? "—" : formatPeople(row.people)}
        </td>
      ) : null}
      {hasChange ? (
        <td className={`px-3 py-2 text-right font-mono tabular-nums ${row.change === null ? "text-slate-400" : changeTone(row.change)}`}>
          {row.change === null ? "—" : formatPoints(row.change)}
        </td>
      ) : null}
      <td className="px-3 py-2 text-right font-mono tabular-nums text-indigo-700 dark:text-indigo-300">
        {row.end ? formatRange(...row.end) : "—"}
      </td>
    </>
  );

  return (
    <div className="max-h-112 overflow-auto">
      <table className="w-full min-w-136 text-xs">
        <caption className="sr-only">
          {groupLabel} by {placeLabel.toLowerCase()}, {year}. Select a column to sort.
        </caption>
        <thead className="sticky top-0 z-10 bg-slate-50 text-[10px] tracking-wide text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
          <tr>
            {header("name", placeLabel, "left")}
            {header("share", `Share ${year}`)}
            {hasPeople ? header("people", `${peopleLabel} ${year}`) : null}
            {hasChange ? header("change", `Since ${baselineYear}`) : null}
            {header("end", `${endYear} projected`)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-900">
          {reference ? (
            <tr className="bg-slate-50/70 font-medium dark:bg-slate-900/40">
              <th scope="row" className="px-3 py-2 text-left text-slate-900 dark:text-white">
                {reference.name}
              </th>
              {cells(reference)}
            </tr>
          ) : null}
          {sorted.map((row) => (
            <tr
              key={row.id}
              className={`${row.id === selectedId ? "bg-blue-50 dark:bg-blue-500/10" : ""} ${
                row.selectable ? "cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-900/60" : ""
              }`}
              onClick={row.selectable ? () => onSelect(row.id) : undefined}
            >
              <th scope="row" className="px-3 py-2 text-left font-normal text-slate-700 dark:text-slate-200">
                {row.selectable ? (
                  <button
                    type="button"
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelect(row.id);
                    }}
                    className="text-left hover:underline"
                  >
                    {row.name}
                  </button>
                ) : (
                  row.name
                )}
              </th>
              {cells(row)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
