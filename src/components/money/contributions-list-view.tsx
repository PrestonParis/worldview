"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/search-input";
import { formatAmount } from "@/lib/money";
import type { Contribution } from "@/lib/validation/contribution";
import type { Entity } from "@/lib/validation/entity";
import type { Source } from "@/lib/validation/source";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ContributionsListView({
  contributions,
  totals,
  entities,
  sources,
  searchPlaceholder,
}: {
  contributions: Contribution[];
  totals: { currency: string; total: number }[];
  entities: Entity[];
  sources: Source[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return contributions;
    return contributions.filter((c) => {
      const donor = entityById.get(c.donorEntityId)?.name ?? "";
      const recipient = entityById.get(c.recipientEntityId)?.name ?? "";
      return donor.toLowerCase().includes(q) || recipient.toLowerCase().includes(q);
    });
  }, [contributions, entityById, query]);

  return (
    <div>
      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
        Total raised:{" "}
        {totals.map((t, i) => (
          <span key={t.currency} className="tabular-nums">
            {i > 0 ? " · " : ""}
            {formatAmount(t.total, t.currency)}
          </span>
        ))}
      </p>

      <div className="mt-3">
        <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No contributions match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs tracking-wider text-slate-400 uppercase dark:border-slate-800">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Donor</th>
                <th className="py-2 pr-4 font-medium">Recipient</th>
                <th className="py-2 pr-4 text-right font-medium">Amount</th>
                <th className="py-2 pr-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const donor = entityById.get(c.donorEntityId);
                const recipient = entityById.get(c.recipientEntityId);
                const source = c.sourceRecordId ? sourceById.get(c.sourceRecordId) : null;
                return (
                  <tr key={c.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">
                      {formatDate(c.date)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {donor?.name ?? "Unknown"}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {recipient?.name ?? "Unknown"}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-800 dark:text-slate-200">
                      {formatAmount(c.amount, c.currency)}
                    </td>
                    <td className="py-2.5 pr-4">
                      {source ? (
                        source.url ? (
                          <a
                            href={source.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs underline"
                          >
                            {source.title}
                          </a>
                        ) : (
                          <span className="text-xs text-slate-500 dark:text-slate-400">{source.title}</span>
                        )
                      ) : (
                        <span className="text-xs text-slate-400">N/A</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
