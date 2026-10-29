"use client";

import { useState } from "react";
import { SortableTable } from "@/components/data/sortable-table";
import { formatValue } from "@/lib/format";
import type { ArmsSale } from "@/lib/israel/records";
import { Segmented } from "./segmented";

const STATUS_STYLE: Record<ArmsSale["status"], string> = {
  Notified: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200",
  "Emergency notification": "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200",
  Contracted: "bg-emerald-100 text-emerald-900 dark:bg-emerald-900/40 dark:text-emerald-200",
};

export function ArmsTracker({ sales }: { sales: ArmsSale[] }) {
  const [status, setStatus] = useState<"all" | ArmsSale["status"]>("all");
  const [category, setCategory] = useState<"all" | ArmsSale["category"]>("all");
  const [all, setAll] = useState(false);
  const shown = sales.filter((s) => (status === "all" || s.status === status) && (category === "all" || s.category === category));
  const total = shown.reduce((s, r) => s + r.value, 0);
  // Newest first; the table can re-sort what's shown.
  const rows = all ? shown : [...shown].sort((a, b) => b.notified.localeCompare(a.notified)).slice(0, 8);
  const categories = [...new Set(sales.map((s) => s.category))];

  return (
    <div className="rounded-2xl border border-slate-200 p-5 dark:border-slate-800">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-slate-950 dark:text-white">Weapons transfer tracker</h3>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {shown.length} notified sales · {formatValue(total, "usd", { compact: true })} in estimated value
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented
            label="Status"
            value={status}
            onChange={setStatus}
            options={[
              ["all", "All"],
              ["Notified", "Notified"],
              ["Emergency notification", "Emergency"],
              ["Contracted", "Contracted"],
            ]}
          />
          <Segmented label="Type" value={category} onChange={setCategory} options={[["all", "All types"], ...categories.map((c) => [c, c] as const)]} />
        </div>
      </div>
      <div className="mt-4 overflow-x-auto">
        <SortableTable
          className="w-full min-w-[760px] text-sm"
          thClassName="py-2 pr-3 text-left text-xs font-medium text-slate-500 dark:text-slate-400"
          rowClassName="border-t border-slate-100 align-top dark:border-slate-800"
          initialSort={{ col: 0, dir: -1 }}
          columns={[
            { label: "Notified" },
            { label: "Weapon system" },
            { label: "Manufacturer" },
            { label: "Est. value", align: "right" },
            { label: "Status" },
            { label: "Delivery" },
          ]}
          rows={rows.map((s) => ({
            key: `${s.notified}-${s.item}`,
            cells: [
              { content: <span className="tabular-nums">{s.notified}</span>, sort: s.notified, className: "py-2 pr-3 whitespace-nowrap" },
              {
                content: (
                  <span>
                    <a href={s.source} className="font-medium text-slate-900 underline-offset-2 hover:underline dark:text-white">
                      {s.item}
                    </a>
                    {s.followUp && <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">{s.followUp}</span>}
                  </span>
                ),
                sort: s.item,
                className: "py-2 pr-3",
              },
              { content: s.contractor, className: "py-2 pr-3 text-slate-600 dark:text-slate-300" },
              { content: <span className="tabular-nums">{formatValue(s.value, "usd", { compact: true })}</span>, sort: s.value, className: "py-2 pr-3 text-right" },
              { content: <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLE[s.status]}`}>{s.status}</span>, sort: s.status, className: "py-2 pr-3 whitespace-nowrap" },
              { content: s.delivery, className: "py-2 pr-3 text-slate-600 dark:text-slate-300" },
            ],
          }))}
        />
      </div>
      {shown.length > 8 && (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 text-xs font-medium text-slate-600 underline underline-offset-2 dark:text-slate-300">
          {all ? "Show newest 8" : `Show all ${shown.length}`}
        </button>
      )}
      <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
        Values are the estimates in each congressional notification. Funding source (U.S. aid, Israel&apos;s own funds, or both) is not
        stated in notifications. Emergency notifications skipped the usual congressional review period.
      </p>
    </div>
  );
}
