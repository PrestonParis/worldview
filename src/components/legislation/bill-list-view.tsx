"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/search/search-input";
import { billStatuses } from "@/lib/validation/bill";
import { formatBillStatus, StatusPill } from "./bill-status";
import type { Bill } from "@/lib/validation/bill";
import type { VoteTally } from "@/lib/validation/vote";
import type { Entity } from "@/lib/validation/entity";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function Tally({ tally }: { tally?: VoteTally }) {
  if (!tally || tally.yea + tally.nay + tally.present + tally.absent === 0) {
    return <span className="text-xs text-slate-400">No votes recorded</span>;
  }
  return (
    <span className="text-xs tabular-nums text-slate-600 dark:text-slate-400">
      {tally.yea} Yea · {tally.nay} Nay
      {tally.present ? ` · ${tally.present} Present` : ""}
      {tally.absent ? ` · ${tally.absent} Absent` : ""}
    </span>
  );
}

export function BillListView({
  bills,
  tallies,
  entities,
  searchPlaceholder,
}: {
  bills: Bill[];
  tallies: Record<string, VoteTally>;
  entities: Entity[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("");

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return bills.filter((b) => {
      if (statusFilter && b.status !== statusFilter) return false;
      if (!q) return true;
      const sponsor = entityById.get(b.sponsorEntityId)?.name ?? "";
      return (
        b.title.toLowerCase().includes(q) ||
        b.billNumber.toLowerCase().includes(q) ||
        sponsor.toLowerCase().includes(q)
      );
    });
  }, [bills, entityById, query, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">All statuses</option>
          {billStatuses.map((s) => (
            <option key={s} value={s}>
              {formatBillStatus(s)}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No bills match this search.</p>
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {visible.map((b) => {
            const sponsor = entityById.get(b.sponsorEntityId);
            return (
              <li key={b.id}>
                <Link
                  href={`/legislation/${b.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs tabular-nums text-slate-500 dark:text-slate-400">
                        {b.billNumber}
                      </span>
                      <StatusPill status={b.status} />
                    </div>
                    <p className="mt-0.5 truncate text-slate-900 dark:text-slate-100">{b.title}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {sponsor?.name ?? "Unknown sponsor"}
                      {b.chamber ? ` · ${b.chamber}` : ""} · {formatDate(b.introducedDate)}
                    </p>
                  </div>
                  <Tally tally={tallies[b.id]} />
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
