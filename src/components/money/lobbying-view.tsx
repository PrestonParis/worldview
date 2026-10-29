"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SortTh, useTableSort } from "@/components/data/sortable-table";
import { entityColorFor } from "@/lib/entity-colors";
import { buildLobbyingGraph, formatAmount } from "@/lib/money";
import type { Entity } from "@/lib/validation/entity";
import { publicEntityPath } from "@/lib/people/public";
import type { Bill } from "@/lib/validation/bill";
import type { LobbyingRegistration } from "@/lib/validation/lobbying";

export function LobbyingView({
  registrations,
  entities,
  bills,
}: {
  registrations: LobbyingRegistration[];
  entities: Entity[];
  bills: Bill[];
}) {
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

  // Client → firm pairs, aggregated across filings.
  const rows = useMemo(
    () => buildLobbyingGraph({ registrations: filtered, entities }).rows,
    [filtered, entities],
  );

  const nameOf = (id: string) => entityById.get(id)?.name ?? "Unknown";

  const { sorted, sort, toggle } = useTableSort(rows, (row, col) => {
    if (col === 0) return nameOf(row.clientEntityId).toLowerCase();
    if (col === 1) return row.inHouse ? "in-house" : (entityById.get(row.registrantEntityId)?.name.toLowerCase() ?? null);
    if (col === 2) return row.total > 0 ? row.total : null;
    if (col === 3) return row.filings;
    if (col === 4) return row.lastYear;
    return row.issues[0]?.toLowerCase() ?? null;
  });

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-3">
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

      </div>

      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <div className="h-full overflow-auto">
          <table className="w-full text-left text-sm">
            <thead className="sticky top-0 bg-slate-50 text-xs tracking-wide text-slate-500 uppercase dark:bg-slate-900 dark:text-slate-400">
              <tr>
                {["Client", "Firm", "Reported", "Filings", "Years", "Issues / bills"].map((label, i) => (
                  <SortTh key={label} col={i} sort={sort} onSort={toggle} align={i === 2 || i === 3 ? "right" : "left"} className="px-4 py-2.5 font-semibold uppercase">
                    {label}
                  </SortTh>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sorted.map((row) => {
                const client = entityById.get(row.clientEntityId);
                const firm = entityById.get(row.registrantEntityId);
                return (
                  <tr
                    key={`${row.clientEntityId}:${row.registrantEntityId}`}
                    className="align-top hover:bg-slate-50 dark:hover:bg-slate-900/60"
                  >
                    <td className="px-4 py-2.5">
                      {client ? (
                        <Link
                          href={publicEntityPath(client)}
                          className="inline-flex items-center gap-2 font-medium text-slate-800 hover:underline dark:text-slate-200"
                        >
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border-2"
                            style={{
                              background: entityColorFor(client.type).bg,
                              borderColor: entityColorFor(client.type).border,
                            }}
                          />
                          {nameOf(row.clientEntityId)}
                        </Link>
                      ) : (
                        <span className="inline-flex items-center gap-2 font-medium text-slate-800 dark:text-slate-200">
                          <span
                            className="h-2 w-2 shrink-0 rounded-full border-2"
                            style={{
                              background: entityColorFor("").bg,
                              borderColor: entityColorFor("").border,
                            }}
                          />
                          {nameOf(row.clientEntityId)}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-700 dark:text-slate-300">
                      {row.inHouse ? (
                        <span className="text-slate-400">in-house</span>
                      ) : firm ? (
                        <Link href={publicEntityPath(firm)} className="hover:underline">
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
          {rows.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-400">No filings for this year.</p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
