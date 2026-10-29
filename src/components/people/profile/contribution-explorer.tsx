"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowDownWideNarrow, ExternalLink, Search } from "lucide-react";
import { recipientKindLabels, type RecipientKind } from "@/lib/money/recipient-kinds";
import { formatPartialDate, type ContributionRecord } from "@/lib/people/profile-model";

export interface ExplorerRow extends ContributionRecord {
  recipientName: string;
  recipientHref: string | null;
}

type Sort = "amount" | "date";

const select =
  "rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200";

// Every itemized FEC line behind the charts above, filterable. Memo lines are
// listed only on request and never enter the totals.
export function ContributionExplorer({ rows }: { rows: ExplorerRow[] }) {
  const cycles = useMemo(() => [...new Set(rows.map((r) => r.cycle))].sort((a, b) => b - a), [rows]);
  const kinds = useMemo(() => [...new Set(rows.map((r) => r.kind))], [rows]);
  const [cycle, setCycle] = useState<number | "all">("all");
  const [kind, setKind] = useState<RecipientKind | "all">("all");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("amount");
  const [showMemos, setShowMemos] = useState(false);
  const [limit, setLimit] = useState(25);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows
      .filter((r) => (showMemos || !r.memo) && (cycle === "all" || r.cycle === cycle) && (kind === "all" || r.kind === kind))
      .filter((r) => !q || r.recipientName.toLowerCase().includes(q))
      .sort((a, b) => (sort === "amount" ? b.amount - a.amount : b.date.localeCompare(a.date)));
  }, [rows, cycle, kind, query, sort, showMemos]);
  const total = shown.filter((r) => !r.memo).reduce((t, r) => t + r.amount, 0);
  const memoCount = rows.filter((r) => r.memo).length;

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="relative">
          <span className="sr-only">Search recipients</span>
          <Search aria-hidden className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search recipients"
            className={`${select} w-52 pl-9`}
          />
        </label>
        <label>
          <span className="sr-only">Election cycle</span>
          <select value={cycle} onChange={(e) => setCycle(e.target.value === "all" ? "all" : Number(e.target.value))} className={select}>
            <option value="all">All cycles</option>
            {cycles.map((c) => (
              <option key={c} value={c}>
                {c - 1}–{String(c).slice(2)}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">Recipient type</span>
          <select value={kind} onChange={(e) => setKind(e.target.value as RecipientKind | "all")} className={select}>
            <option value="all">All recipient types</option>
            {kinds.map((k) => (
              <option key={k} value={k}>
                {recipientKindLabels[k]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          onClick={() => setSort(sort === "amount" ? "date" : "amount")}
          className={`${select} inline-flex items-center gap-1.5`}
        >
          <ArrowDownWideNarrow aria-hidden className="h-4 w-4" />
          {sort === "amount" ? "Largest first" : "Newest first"}
        </button>
        {memoCount ? (
          <label className="inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400">
            <input type="checkbox" checked={showMemos} onChange={(e) => setShowMemos(e.target.checked)} className="accent-indigo-600" />
            Show {memoCount} memo lines
          </label>
        ) : null}
      </div>

      <p className="mt-3 text-sm text-slate-600 tabular-nums dark:text-slate-400">
        {shown.filter((r) => !r.memo).length} contributions totaling{" "}
        <span className="font-semibold text-slate-900 dark:text-white">${total.toLocaleString("en-US")}</span>
      </p>

      <div className="mt-3 overflow-x-auto rounded-2xl border border-slate-200 dark:border-slate-800">
        <table className="w-full min-w-[40rem] text-left text-sm">
          <thead className="bg-slate-50 text-slate-500 dark:bg-slate-900 dark:text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Date</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Recipient</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Type</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Amount</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Record</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {shown.slice(0, limit).map((r) => (
              <tr key={r.id} className={r.memo ? "text-slate-400" : "text-slate-800 dark:text-slate-200"}>
                <td className="px-4 py-2.5 whitespace-nowrap tabular-nums">{formatPartialDate(r.date)}</td>
                <td className="px-4 py-2.5">
                  {r.recipientHref ? (
                    <Link href={r.recipientHref} className="font-medium hover:text-indigo-700 dark:hover:text-indigo-300">
                      {r.recipientName}
                    </Link>
                  ) : (
                    <span className="font-medium">{r.recipientName}</span>
                  )}
                  {r.memo ? <span className="ml-2 text-xs">memo, not counted</span> : null}
                  {r.matchBasis === "city" ? (
                    <span className="ml-2 text-xs text-slate-400" title="The filing lists no matching employer; it was tied to this person by name and home city.">
                      matched by address
                    </span>
                  ) : null}
                </td>
                <td className="px-4 py-2.5 whitespace-nowrap text-slate-500">{recipientKindLabels[r.kind].replace(/s$/, "")}</td>
                <td className="px-4 py-2.5 text-right font-medium whitespace-nowrap tabular-nums">${r.amount.toLocaleString("en-US")}</td>
                <td className="px-4 py-2.5">
                  {r.committeeId ? (
                    <a
                      href={`https://www.fec.gov/data/committee/${r.committeeId}/?cycle=${r.cycle}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-1 text-slate-500 hover:text-indigo-700 dark:hover:text-indigo-300"
                    >
                      {r.committeeId} <ExternalLink aria-hidden className="h-3 w-3" />
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {shown.length > limit ? (
        <button
          type="button"
          onClick={() => setLimit(limit + 50)}
          className="mt-3 rounded-full border border-slate-200 px-4 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200"
        >
          Show more ({shown.length - limit} remaining)
        </button>
      ) : null}
    </div>
  );
}
