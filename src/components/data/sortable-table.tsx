"use client";

import { useMemo, useState, type ReactNode } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { defaultDir, sortKey, sortRows, type SortDir, type SortValue } from "@/lib/table-sort";

export interface SortState {
  col: number;
  dir: SortDir;
}

// Click-to-sort state for any table. Rows stay in their given order until a
// header is clicked; the first click on a column picks its natural direction
// (largest/latest first for numbers, A→Z for text), the next reverses it.
export function useTableSort<T>(rows: T[], keyOf: (row: T, col: number) => SortValue, initial: SortState | null = null) {
  const [sort, setSort] = useState<SortState | null>(initial);
  const sorted = useMemo(
    () => (sort ? sortRows(rows, (r) => keyOf(r, sort.col), sort.dir) : rows),
    // keyOf is usually an inline closure; rows and sort fully determine the result.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [rows, sort],
  );
  const toggle = (col: number) =>
    setSort((s) => (s?.col === col ? { col, dir: (-s.dir) as SortDir } : { col, dir: defaultDir(rows.map((r) => keyOf(r, col))) }));
  return { sorted, sort, toggle };
}

// Header cell with a sort button. Pass the table's own th classes so each
// table keeps its look.
export function SortTh({
  col,
  sort,
  onSort,
  children,
  align = "left",
  className = "",
}: {
  col: number;
  sort: SortState | null;
  onSort: (col: number) => void;
  children: ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  const active = sort?.col === col;
  const Icon = !active ? ArrowUpDown : sort.dir === 1 ? ArrowUp : ArrowDown;
  return (
    <th
      className={`${className} ${align === "right" ? "text-right" : "text-left"}`}
      aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}
    >
      <button
        type="button"
        onClick={() => onSort(col)}
        className={`group inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white ${align === "right" ? "flex-row-reverse" : ""} ${
          active ? "text-slate-900 dark:text-white" : ""
        }`}
      >
        {children}
        <Icon className={`size-3 shrink-0 ${active ? "" : "opacity-0 group-hover:opacity-60 group-focus-visible:opacity-60"}`} aria-hidden />
      </button>
    </th>
  );
}

export interface SortCell {
  content: ReactNode;
  sort?: SortValue; // defaults to sortKey(content) for text/number content
  className?: string;
}

export interface SortColumn {
  label: string;
  align?: "left" | "right";
  className?: string;
}

// A complete sortable table for server components: cells carry rendered
// content (links and all) plus an optional explicit sort value.
export function SortableTable({
  columns,
  rows,
  initialSort = null,
  className = "w-full text-sm",
  theadClassName = "bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400",
  thClassName = "px-3 py-2 font-medium",
  tbodyClassName = "divide-y divide-slate-100 dark:divide-slate-800",
  rowClassName = "",
}: {
  columns: SortColumn[];
  rows: { key: string; cells: SortCell[] }[];
  initialSort?: SortState | null;
  className?: string;
  theadClassName?: string;
  thClassName?: string;
  tbodyClassName?: string;
  rowClassName?: string;
}) {
  const { sorted, sort, toggle } = useTableSort(
    rows,
    (r, col) => {
      const cell = r.cells[col];
      if (!cell) return null;
      if (cell.sort !== undefined) return cell.sort;
      return typeof cell.content === "string" || typeof cell.content === "number" ? sortKey(cell.content) : null;
    },
    initialSort,
  );
  return (
    <table className={className}>
      <thead className={theadClassName}>
        <tr>
          {columns.map((c, i) => (
            <SortTh key={c.label || i} col={i} sort={sort} onSort={toggle} align={c.align} className={`${thClassName} ${c.className ?? ""}`}>
              {c.label}
            </SortTh>
          ))}
        </tr>
      </thead>
      <tbody className={tbodyClassName}>
        {sorted.map((r) => (
          <tr key={r.key} className={rowClassName}>
            {r.cells.map((cell, j) => (
              <td key={j} className={`${cell.className ?? ""} ${columns[j]?.align === "right" ? "text-right" : ""}`}>
                {cell.content}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
