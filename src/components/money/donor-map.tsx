"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import {
  formatAmount,
  stateBreakdown,
  stateDonors,
  US_STATE_GRID,
  US_STATE_GRID_COLS,
  US_STATE_GRID_ROWS,
  usStateName,
  type StateBreakdownRow,
} from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";

const MAX_COMPARE = 3;
const CELL = 44;
const GAP = 4;

function homeStateOf(entity: Entity | undefined): string {
  if (!entity?.metadata) return "";
  try {
    const m = JSON.parse(entity.metadata) as Record<string, unknown>;
    return typeof m.state === "string" ? m.state.toUpperCase() : "";
  } catch {
    return "";
  }
}

// Light → deep green by intensity (0..1). Text flips to white past the midpoint.
function fillFor(intensity: number): { fill: string; text: string } {
  if (intensity <= 0) return { fill: "var(--tile-empty)", text: "var(--tile-empty-text)" };
  const light = 92 - intensity * 56; // 92% → 36%
  return { fill: `hsl(152 55% ${light}%)`, text: intensity > 0.5 ? "#fff" : "#0f172a" };
}

export function DonorMap({
  rows,
  entities,
}: {
  rows: StateBreakdownRow[];
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
  const [active, setActive] = useState<string | null>(null);

  const { states, total, unknown } = useMemo(
    () => stateBreakdown(rows, { currency, recipientIds: selected }),
    [rows, currency, selected],
  );
  const byState = useMemo(() => new Map(states.map((s) => [s.state, s])), [states]);
  const maxTotal = states[0]?.total ?? 0;

  const homeState =
    selected.length === 1 ? homeStateOf(entityById.get(selected[0])) : "";
  const inState = homeState ? (byState.get(homeState)?.total ?? 0) : 0;

  if (rows.length === 0) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        No contribution data yet. Run <code>npm run import:fec-donors</code>.
      </p>
    );
  }
  if (rows.every((r) => r.state === "")) {
    return (
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Contributions don&rsquo;t have a donor state yet. Run{" "}
        <code>npm run import:fec-donors -- --refresh</code> to pull it from the filings.
      </p>
    );
  }

  const addable = recipients.filter((r) => !selected.includes(r.id));
  const activeTotal = active ? byState.get(active) : null;
  const activeDonors = active
    ? stateDonors(rows, { state: active, currency, recipientIds: selected }).slice(0, 6)
    : [];

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

      <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
        <span className="tabular-nums">{formatAmount(total, currency)}</span> total
        {unknown && unknown.share > 0.01 ? (
          <span className="text-slate-400">
            {" "}
            · {(unknown.share * 100).toFixed(0)}% from filings with no state
          </span>
        ) : null}
        {homeState ? (
          <span className="text-slate-400">
            {" "}
            · {total > 0 ? ((inState / total) * 100).toFixed(0) : 0}% in-state ({homeState}),{" "}
            {total > 0 ? (((total - inState) / total) * 100).toFixed(0) : 0}% out-of-state
          </span>
        ) : null}
      </p>

      <div className="mt-4 grid gap-6 lg:grid-cols-[auto_minmax(0,1fr)]">
        <div
          className="[--tile-empty:#f1f5f9] dark:[--tile-empty:#1e293b] [--tile-empty-text:#94a3b8]"
          style={{ overflowX: "auto" }}
        >
          <svg
            width={US_STATE_GRID_COLS * (CELL + GAP)}
            height={US_STATE_GRID_ROWS * (CELL + GAP)}
            role="img"
            aria-label="US donor map"
          >
            {US_STATE_GRID.map((cell) => {
              const s = byState.get(cell.abbr);
              const intensity = maxTotal > 0 && s ? Math.sqrt(s.total / maxTotal) : 0;
              const { fill, text } = fillFor(intensity);
              const isActive = active === cell.abbr;
              const isHome = homeState === cell.abbr;
              return (
                <g
                  key={cell.abbr}
                  transform={`translate(${cell.col * (CELL + GAP)}, ${cell.row * (CELL + GAP)})`}
                  onMouseEnter={() => setActive(cell.abbr)}
                  onMouseLeave={() => setActive((a) => (a === cell.abbr ? null : a))}
                  style={{ cursor: s ? "pointer" : "default" }}
                >
                  <rect
                    width={CELL}
                    height={CELL}
                    rx={5}
                    fill={fill}
                    stroke={isActive ? "#0f172a" : isHome ? "#16a34a" : "transparent"}
                    strokeWidth={isActive || isHome ? 2 : 0}
                  />
                  <text
                    x={CELL / 2}
                    y={CELL / 2 + 4}
                    textAnchor="middle"
                    fontSize={12}
                    fontWeight={600}
                    fill={text}
                  >
                    {cell.abbr}
                  </text>
                </g>
              );
            })}
          </svg>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-400">
            <span>less</span>
            <span className="flex h-3 w-40 overflow-hidden rounded">
              {[0.05, 0.25, 0.45, 0.65, 0.85, 1].map((i) => (
                <span key={i} className="flex-1" style={{ background: fillFor(i).fill }} />
              ))}
            </span>
            <span>more</span>
          </div>
        </div>

        <div className="min-w-0">
          {activeTotal ? (
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800">
              <div className="flex items-baseline justify-between gap-3">
                <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {usStateName(active!)}
                </h3>
                <span className="text-sm tabular-nums text-slate-700 dark:text-slate-300">
                  {formatAmount(activeTotal.total, currency)}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-slate-400">
                {(activeTotal.share * 100).toFixed(1)}% of total · {activeTotal.count} gift
                {activeTotal.count === 1 ? "" : "s"}
              </p>
              <ul className="mt-3 space-y-1">
                {activeDonors.map((d) => {
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
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : (
            <p className="text-sm text-slate-400">Hover a state for its total and top donors.</p>
          )}
        </div>
      </div>
    </div>
  );
}
