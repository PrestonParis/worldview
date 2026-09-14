"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { LayoutGrid, Table2 } from "lucide-react";
import { EntityGraph } from "@/components/graph/entity-graph";
import { computeHierarchicalLayout } from "@/lib/graph/layout";
import { entityColorFor } from "@/lib/entity-colors";
import { buildLobbyingGraph, formatAmount } from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";
import type { Bill } from "@/lib/validation/bill";
import type { LobbyingRegistration } from "@/lib/validation/lobbying";

type ViewMode = "graph" | "table";

export function LobbyingView({
  registrations,
  entities,
  bills,
}: {
  registrations: LobbyingRegistration[];
  entities: Entity[];
  bills: Bill[];
}) {
  const [view, setView] = useState<ViewMode>("graph");
  const [year, setYear] = useState<string>("");

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const billById = useMemo(() => new Map(bills.map((b) => [b.id, b])), [bills]);

  const years = useMemo(
    () => [...new Set(registrations.map((r) => r.year))].sort((a, b) => b - a),
    [registrations],
  );

  const filtered = useMemo(
    () => (year ? registrations.filter((r) => String(r.year) === year) : registrations),
    [registrations, year],
  );

  const graph = useMemo(
    () => buildLobbyingGraph({ registrations: filtered, entities }),
    [filtered, entities],
  );
  const positions = useMemo(
    () => computeHierarchicalLayout(graph.entities, graph.edges),
    [graph],
  );

  const nameOf = (id: string) => entityById.get(id)?.name ?? "Unknown";

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <select
          value={year}
          onChange={(e) => setYear(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-900"
        >
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>

        <div className="flex shrink-0 gap-1 rounded-md border border-slate-200 p-0.5 dark:border-slate-800">
          {(
            [
              ["graph", "Graph", LayoutGrid],
              ["table", "Table", Table2],
            ] as const
          ).map(([mode, label, Icon]) => (
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
          <div className="h-[70vh] min-h-[440px]">
            <EntityGraph
              entities={graph.entities}
              edges={graph.edges}
              positions={positions}
              edgeStyles={graph.edgeStyles}
            />
          </div>
        ) : (
          <div className="h-full overflow-auto">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">Client</th>
                  <th className="px-4 py-2.5 font-semibold">Firm</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Reported</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Filings</th>
                  <th className="px-4 py-2.5 font-semibold">Years</th>
                  <th className="px-4 py-2.5 font-semibold">Issues / bills</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {graph.rows.map((row) => {
                  const client = entityById.get(row.clientEntityId);
                  const firm = entityById.get(row.registrantEntityId);
                  return (
                    <tr
                      key={`${row.clientEntityId}:${row.registrantEntityId}`}
                      className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60"
                    >
                      <td className="px-4 py-2.5">
                        <Link
                          href={client ? `/data/entities/${client.id}` : "#"}
                          className="inline-flex items-center gap-2 font-medium text-slate-800 hover:underline dark:text-slate-200"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border-2"
                            style={{
                              background: entityColorFor(client?.type ?? "").bg,
                              borderColor: entityColorFor(client?.type ?? "").border,
                            }}
                          />
                          {nameOf(row.clientEntityId)}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                        {row.inHouse ? (
                          <span className="text-slate-400">in-house</span>
                        ) : firm ? (
                          <Link href={`/data/entities/${firm.id}`} className="hover:underline">
                            {firm.name}
                          </Link>
                        ) : (
                          "Unknown"
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-800 dark:text-slate-200">
                        {row.total > 0 ? formatAmount(row.total, "USD") : "N/A"}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-slate-500 dark:text-slate-400">
                        {row.filings}
                      </td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-500 dark:text-slate-400">
                        {row.firstYear === row.lastYear
                          ? row.firstYear
                          : `${row.firstYear}–${row.lastYear}`}
                      </td>
                      <td className="max-w-sm px-4 py-2.5 text-slate-500 dark:text-slate-400">
                        {row.issues.slice(0, 4).join(", ") || "N/A"}
                        {row.billIds.length > 0 ? (
                          <span className="mt-1 flex flex-wrap gap-1.5">
                            {row.billIds.map((bid) => {
                              const b = billById.get(bid);
                              return b ? (
                                <Link
                                  key={bid}
                                  href={`/legislation/${bid}`}
                                  className="rounded bg-slate-100 px-1.5 py-0.5 text-xs text-slate-600 hover:underline dark:bg-slate-800 dark:text-slate-300"
                                >
                                  {b.billNumber}
                                </Link>
                              ) : null;
                            })}
                          </span>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {graph.rows.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-400">No filings for this year.</p>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
