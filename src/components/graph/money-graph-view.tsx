"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Table2 } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { EntityGraph, type EntityGraphEdgeStyle } from "./entity-graph";
import { entityColorFor } from "@/lib/entity-colors";
import { formatAmount } from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { MoneyGraphRow } from "@/lib/money";
import type { PositionedNode } from "@/lib/graph/layout";

type ViewMode = "graph" | "table";

const VIEWS: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: "graph", label: "Graph", icon: LayoutGrid },
  { mode: "table", label: "Table", icon: Table2 },
];

function shortDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function EntityCell({ entity }: { entity: Entity | undefined }) {
  if (!entity) return <span className="text-slate-400">Unknown</span>;
  return (
    <Link
      href={`/data/entities/${entity.id}`}
      className="inline-flex items-center gap-2 font-medium text-slate-800 hover:underline dark:text-slate-200"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full border-2"
        style={{
          background: entityColorFor(entity.type).bg,
          borderColor: entityColorFor(entity.type).border,
        }}
      />
      {entity.name}
    </Link>
  );
}

export function MoneyGraphView({
  entities,
  edges,
  edgeStyles,
  rows,
  positions,
  searchPlaceholder,
}: {
  entities: Entity[];
  edges: Edge[];
  edgeStyles: Record<string, EntityGraphEdgeStyle>;
  rows: MoneyGraphRow[];
  positions: PositionedNode[];
  searchPlaceholder: string;
}) {
  const [view, setView] = useState<ViewMode>("graph");
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const sortedRows = [...rows].sort(
    (a, b) =>
      (b.total ?? -1) - (a.total ?? -1) ||
      (entityById.get(a.donorEntityId)?.name ?? "").localeCompare(
        entityById.get(b.donorEntityId)?.name ?? "",
      ),
  );

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <EntitySearch entities={entities} placeholder={searchPlaceholder} />
        <div className="flex shrink-0 gap-1 rounded-md border border-slate-200 p-0.5 dark:border-slate-800">
          {VIEWS.map(({ mode, label, icon: Icon }) => (
            <button
              key={mode}
              type="button"
              onClick={() => setView(mode)}
              className={`flex items-center gap-1.5 rounded px-3 py-1.5 text-sm font-medium transition-colors ${
                view === mode
                  ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                  : "text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        Line weight tracks total contributed. <span className="text-emerald-600 dark:text-emerald-400">Solid green</span>{" "}
        = FEC filings; dashed grey = hand-entered, unverified.
      </p>

      <div className="mt-3 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {view === "graph" ? (
          <EntityGraph entities={entities} edges={edges} positions={positions} edgeStyles={edgeStyles} />
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Donor</th>
                  <th className="px-4 py-2.5 font-semibold">Recipient</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Total</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Gifts</th>
                  <th className="px-4 py-2.5 font-semibold">Period</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {sortedRows.map((row, i) => {
                  const period = [shortDate(row.firstDate), shortDate(row.lastDate)]
                    .filter(Boolean)
                    .filter((v, idx, arr) => arr.indexOf(v) === idx)
                    .join(" – ");
                  return (
                    <tr
                      key={`${row.kind}:${row.donorEntityId}:${row.recipientEntityId}:${row.currency}:${i}`}
                      className="hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-2.5">
                        <EntityCell entity={entityById.get(row.donorEntityId)} />
                      </td>
                      <td className="px-4 py-2.5">
                        <EntityCell entity={entityById.get(row.recipientEntityId)} />
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                        {row.total != null ? (
                          formatAmount(row.total, row.currency)
                        ) : (
                          <span className="text-xs text-slate-400" title={row.notes || undefined}>
                            {row.label} · unverified
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {row.count ?? "N/A"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{period || "N/A"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedRows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No donor relationships recorded.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
