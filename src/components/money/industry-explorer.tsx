"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, X } from "lucide-react";
import {
  formatAmount,
  industryBreakdown,
  industryDonors,
  type IndustryBreakdownRow,
  type IndustrySlice,
} from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";

const MAX_COMPARE = 3;
const BAR = "bg-emerald-500 dark:bg-emerald-600";
const BAR_MUTED = "bg-slate-300 dark:bg-slate-600"; // unclassified slice

function pct(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
}

function SectorRow({
  slice,
  max,
  rows,
  currency,
  recipientIds,
  entityById,
  expandable,
}: {
  slice: IndustrySlice;
  max: number;
  rows: IndustryBreakdownRow[];
  currency: string;
  recipientIds: string[];
  entityById: Map<string, Entity>;
  expandable: boolean;
}) {
  const [open, setOpen] = useState(false);
  const donors = useMemo(
    () =>
      open
        ? industryDonors(rows, { industry: slice.industry, currency, recipientIds })
        : [],
    [open, rows, slice.industry, currency, recipientIds],
  );
  const width = max > 0 ? (slice.total / max) * 100 : 0;

  return (
    <div className="border-b border-slate-100 py-2 last:border-0 dark:border-slate-800/60">
      <button
        type="button"
        onClick={() => expandable && setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 text-left ${expandable ? "cursor-pointer" : "cursor-default"}`}
      >
        <span className="flex w-40 shrink-0 items-center gap-1 text-sm text-slate-700 dark:text-slate-300">
          {expandable ? (
            open ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-slate-400" />
            )
          ) : null}
          <span className="truncate">{slice.label}</span>
        </span>
        <span className="h-3 flex-1 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
          <span
            className={`block h-full rounded-full ${slice.industry ? BAR : BAR_MUTED}`}
            style={{ width: `${width}%` }}
          />
        </span>
        <span className="w-28 shrink-0 text-right text-sm tabular-nums text-slate-700 dark:text-slate-300">
          {formatAmount(slice.total, currency)}
        </span>
        <span className="w-12 shrink-0 text-right text-xs tabular-nums text-slate-400">
          {pct(slice.share)}
        </span>
      </button>

      {open && donors.length > 0 ? (
        <ul className="mt-1.5 ml-40 space-y-1 pl-1">
          {donors.map((d) => {
            const e = entityById.get(d.donorEntityId);
            return (
              <li key={d.donorEntityId} className="flex items-center justify-between gap-3 text-xs">
                <Link
                  href={e ? `/data/entities/${e.id}` : "#"}
                  className="min-w-0 truncate text-slate-600 hover:underline dark:text-slate-400"
                >
                  {e?.name ?? "Unknown"}
                </Link>
                <span className="shrink-0 tabular-nums text-slate-500">
                  {formatAmount(d.total, currency)}
                  <span className="ml-2 text-slate-400">
                    {d.count} gift{d.count === 1 ? "" : "s"}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function Breakdown({
  title,
  rows,
  currency,
  recipientIds,
  entityById,
  expandable,
}: {
  title?: string;
  rows: IndustryBreakdownRow[];
  currency: string;
  recipientIds: string[];
  entityById: Map<string, Entity>;
  expandable: boolean;
}) {
  const { slices, total } = useMemo(
    () => industryBreakdown(rows, { currency, recipientIds }),
    [rows, currency, recipientIds],
  );
  const max = slices[0]?.total ?? 0;
  const unclassified = slices.find((s) => s.industry === "");

  if (total === 0) {
    return (
      <div>
        {title ? <h3 className="text-sm font-semibold">{title}</h3> : null}
        <p className="mt-2 text-sm text-slate-400">No contributions on record.</p>
      </div>
    );
  }

  return (
    <div>
      {title ? (
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <h3 className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
          <span className="shrink-0 text-xs tabular-nums text-slate-400">
            {formatAmount(total, currency)}
          </span>
        </div>
      ) : null}
      <div>
        {slices.map((s) => (
          <SectorRow
            key={s.industry || "_unclassified"}
            slice={s}
            max={max}
            rows={rows}
            currency={currency}
            recipientIds={recipientIds}
            entityById={entityById}
            expandable={expandable}
          />
        ))}
      </div>
      {unclassified && unclassified.share > 0.02 ? (
        <p className="mt-2 text-xs text-slate-400">
          {pct(unclassified.share)} of this total is from donors the classifier
          couldn&rsquo;t place.
        </p>
      ) : null}
    </div>
  );
}

export function IndustryExplorer({
  rows,
  entities,
}: {
  rows: IndustryBreakdownRow[];
  entities: Entity[];
}) {
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const currencies = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.currency, (totals.get(r.currency) ?? 0) + r.total);
    return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([c]) => c);
  }, [rows]);

  const recipients = useMemo(() => {
    const totals = new Map<string, number>();
    for (const r of rows)
      totals.set(r.recipientEntityId, (totals.get(r.recipientEntityId) ?? 0) + r.total);
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([id]) => ({ id, name: entityById.get(id)?.name ?? "Unknown" }));
  }, [rows, entityById]);

  const [currency, setCurrency] = useState(currencies[0] ?? "USD");
  const [selected, setSelected] = useState<string[]>([]);

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No contribution data yet.
      </p>
    );
  }
  if (rows.every((r) => r.industry === "")) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Contributions aren&rsquo;t industry-classified yet.
      </p>
    );
  }

  const addable = recipients.filter((r) => !selected.includes(r.id));
  const comparing = selected.length >= 2;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {currencies.length > 1 ? (
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
          >
            {currencies.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        ) : null}

        <select
          value=""
          onChange={(e) => {
            if (e.target.value) setSelected((s) => [...s, e.target.value].slice(0, MAX_COMPARE));
          }}
          disabled={selected.length >= MAX_COMPARE || addable.length === 0}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:opacity-50 dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">
            {selected.length === 0 ? "All recipients; add one to filter…" : "Add a recipient…"}
          </option>
          {addable.map((r) => (
            <option key={r.id} value={r.id}>
              {r.name}
            </option>
          ))}
        </select>

        {selected.map((id) => (
          <span
            key={id}
            className="flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 text-sm dark:bg-slate-800"
          >
            {entityById.get(id)?.name ?? "Unknown"}
            <button
              type="button"
              onClick={() => setSelected((s) => s.filter((x) => x !== id))}
              className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-700"
              aria-label="Remove"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </span>
        ))}
        {selected.length > 0 ? (
          <button
            type="button"
            onClick={() => setSelected([])}
            className="text-xs text-slate-400 underline underline-offset-2 hover:text-slate-600"
          >
            clear
          </button>
        ) : null}
      </div>

      <div className="mt-5">
        {comparing ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {selected.map((id) => (
              <Breakdown
                key={id}
                title={entityById.get(id)?.name ?? "Unknown"}
                rows={rows}
                currency={currency}
                recipientIds={[id]}
                entityById={entityById}
                expandable={false}
              />
            ))}
          </div>
        ) : (
          <Breakdown
            rows={rows}
            currency={currency}
            recipientIds={selected}
            entityById={entityById}
            expandable
          />
        )}
      </div>

      {!comparing ? (
        <p className="mt-4 text-xs text-slate-400">
          Click a sector to see the donors in it. Add up to {MAX_COMPARE} recipients to
          compare their sector mixes side by side.
        </p>
      ) : null}
    </div>
  );
}
