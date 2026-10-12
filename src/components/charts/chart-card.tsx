"use client";

import { useState, type ReactNode } from "react";
import { SortableTable } from "@/components/data/sortable-table";

export interface TableView {
  columns: string[];
  rows: (string | number)[][];
}

// Frame for every chart: title, one-line subtitle, the chart or its table
// view, and the source line. The table view keeps every value reachable
// without hovering; every column of it sorts.
export function ChartCard({
  title,
  subtitle,
  source,
  table,
  children,
  className = "",
}: {
  title: string;
  subtitle?: string;
  source?: { label: string; href?: string };
  table?: TableView;
  children: ReactNode;
  className?: string;
}) {
  const [showTable, setShowTable] = useState(false);
  return (
    <figure className={`min-w-0 rounded-2xl border border-slate-200 p-5 dark:border-slate-800 ${className}`}>
      <figcaption className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">{title}</h3>
          {subtitle && <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>}
        </div>
        {table && (
          <div className="flex shrink-0 rounded-lg bg-slate-100 p-0.5 text-xs font-medium dark:bg-slate-900" role="group" aria-label="View">
            {["Chart", "Table"].map((label) => {
              const active = (label === "Table") === showTable;
              return (
                <button
                  key={label}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setShowTable(label === "Table")}
                  className={`rounded-md px-2.5 py-1 ${
                    active ? "bg-white text-slate-900 shadow-sm dark:bg-slate-700 dark:text-white" : "text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        )}
      </figcaption>
      <div className="mt-4">
        {showTable && table ? (
          <div className="max-h-80 overflow-auto rounded-lg border border-slate-100 dark:border-slate-800">
            <SortableTable
              columns={table.columns.map((c, i) => ({ label: c, align: i > 0 ? "right" : "left" }))}
              rows={table.rows.map((r, i) => ({
                key: String(i),
                cells: r.map((cell, j) => ({
                  content: cell,
                  className: `px-3 py-1.5 ${j > 0 ? "tabular-nums" : "text-slate-700 dark:text-slate-300"}`,
                })),
              }))}
              theadClassName="sticky top-0 bg-slate-50 text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400"
            />
          </div>
        ) : (
          children
        )}
      </div>
      {source && (
        <p className="mt-3 text-xs text-slate-400">
          Source:{" "}
          {source.href ? (
            <a href={source.href} className="underline decoration-slate-300 underline-offset-2 hover:text-slate-600 dark:hover:text-slate-200">
              {source.label}
            </a>
          ) : (
            source.label
          )}
        </p>
      )}
    </figure>
  );
}
