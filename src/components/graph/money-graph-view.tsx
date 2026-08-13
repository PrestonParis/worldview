"use client";

import { useState } from "react";
import Link from "next/link";
import { LayoutGrid, Table2 } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { EntityGraph } from "./entity-graph";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

type ViewMode = "graph" | "table";

const VIEWS: { mode: ViewMode; label: string; icon: typeof LayoutGrid }[] = [
  { mode: "graph", label: "Graph", icon: LayoutGrid },
  { mode: "table", label: "Table", icon: Table2 },
];

export function MoneyGraphView({
  entities,
  edges,
  positions,
  searchPlaceholder,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
  searchPlaceholder: string;
}) {
  const [view, setView] = useState<ViewMode>("graph");
  const entityById = new Map(entities.map((e) => [e.id, e]));

  const rows = edges
    .map((edge) => ({
      edge,
      source: entityById.get(edge.sourceEntityId),
      target: entityById.get(edge.targetEntityId),
    }))
    .filter(
      (row): row is { edge: Edge; source: Entity; target: Entity } =>
        Boolean(row.source && row.target),
    )
    .sort(
      (a, b) => a.source.name.localeCompare(b.source.name) || a.target.name.localeCompare(b.target.name),
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

      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {view === "graph" ? (
          <EntityGraph entities={entities} edges={edges} positions={positions} />
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Donor</th>
                  <th className="px-4 py-2.5 font-semibold">Recipient</th>
                  <th className="px-4 py-2.5 font-semibold">Relationship</th>
                  <th className="px-4 py-2.5 font-semibold">Since</th>
                  <th className="px-4 py-2.5 font-semibold">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {rows.map(({ edge, source, target }) => (
                  <tr key={edge.id} className="hover:bg-slate-50 dark:hover:bg-slate-900/60">
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/data/entities/${source.id}`}
                        className="inline-flex items-center gap-2 font-medium text-slate-800 hover:underline dark:text-slate-200"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border-2"
                          style={{
                            background: entityColorFor(source.type).bg,
                            borderColor: entityColorFor(source.type).border,
                          }}
                        />
                        {source.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">
                      <Link
                        href={`/data/entities/${target.id}`}
                        className="inline-flex items-center gap-2 font-medium text-slate-800 hover:underline dark:text-slate-200"
                      >
                        <span
                          className="h-2 w-2 shrink-0 rounded-full border-2"
                          style={{
                            background: entityColorFor(target.type).bg,
                            borderColor: entityColorFor(target.type).border,
                          }}
                        />
                        {target.name}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">{edge.label}</td>
                    <td className="px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {edge.validFrom || "—"}
                    </td>
                    <td className="max-w-xs truncate px-4 py-2.5 text-slate-500 dark:text-slate-400">
                      {edge.notes || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No donor relationships recorded.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
