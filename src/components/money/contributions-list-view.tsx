"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { SortTh, useTableSort } from "@/components/data/sortable-table";
import { SearchInput } from "@/components/search/search-input";
import { formatAmount } from "@/lib/money";
import { donorTypeGroup, partyColor, partyLetter } from "@/lib/money/semantic";
import { industryLabel } from "@/lib/money/industries";
import { publicEntityPath } from "@/lib/people/public";
import type { Contribution } from "@/lib/validation/contribution";
import type { Entity } from "@/lib/validation/entity";
import type { Source } from "@/lib/validation/source";
import { csvCell } from "@/lib/csv";

const PAGE_SIZE = 50;

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

const selectClass =
  "rounded-md border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100";

// The raw record layer of Money & Influence: every itemized contribution,
// filterable by donor, recipient, type, party, state, amount, and date, and
// exportable as CSV.
export function ContributionsListView({
  contributions,
  entities,
  sources,
  partyByEntity = {},
  searchPlaceholder,
}: {
  contributions: Contribution[];
  entities: Entity[];
  sources: Source[];
  partyByEntity?: Record<string, string>;
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("");
  const [party, setParty] = useState("");
  const [state, setState] = useState("");
  const [minAmount, setMinAmount] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [shown, setShown] = useState(PAGE_SIZE);

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);
  const nameOf = (id: string) => entityById.get(id)?.name ?? "Unnamed";

  const typeOptions = useMemo(() => {
    const m = new Map<string, string>();
    for (const c of contributions) {
      const g = donorTypeGroup(c.contributionType);
      m.set(g.key, g.label);
    }
    return [...m.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [contributions]);
  const stateOptions = useMemo(
    () => [...new Set(contributions.map((c) => c.donorState).filter(Boolean) as string[])].sort(),
    [contributions],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const min = Number(minAmount) || 0;
    return contributions.filter((c) => {
      if (type && donorTypeGroup(c.contributionType).key !== type) return false;
      if (party && partyLetter(partyByEntity[c.recipientEntityId]) !== party) return false;
      if (state && c.donorState !== state) return false;
      if (min && c.amount < min) return false;
      const day = c.date.slice(0, 10);
      if (from && day < from) return false;
      if (to && day > to) return false;
      if (!q) return true;
      const donor = entityById.get(c.donorEntityId)?.name ?? "";
      const recipient = entityById.get(c.recipientEntityId)?.name ?? "";
      return donor.toLowerCase().includes(q) || recipient.toLowerCase().includes(q);
    });
  }, [contributions, entityById, partyByEntity, query, type, party, state, minAmount, from, to]);

  const visibleTotal = useMemo(() => visible.reduce((s, c) => s + (c.currency === "USD" || !c.currency ? c.amount : 0), 0), [visible]);

  const { sorted, sort, toggle } = useTableSort(visible, (c, col) => {
    if (col === 0) return Date.parse(c.date);
    if (col === 1) return nameOf(c.donorEntityId).toLowerCase() || null;
    if (col === 2) return donorTypeGroup(c.contributionType).label;
    if (col === 3) return nameOf(c.recipientEntityId).toLowerCase() || null;
    if (col === 4) return c.amount;
    const source = c.sourceRecordId ? sourceById.get(c.sourceRecordId) : null;
    return source?.title.toLowerCase() ?? null;
  });

  const filtered = Boolean(query || type || party || state || minAmount || from || to);
  const reset = () => {
    setQuery("");
    setType("");
    setParty("");
    setState("");
    setMinAmount("");
    setFrom("");
    setTo("");
    setShown(PAGE_SIZE);
  };
  const on = <T,>(set: (v: T) => void) => (v: T) => {
    set(v);
    setShown(PAGE_SIZE);
  };

  const exportCsv = () => {
    const header = ["date", "donor", "donor_type", "fec_donor_type", "donor_state", "donor_industry", "recipient", "recipient_party", "amount", "currency", "source"];
    const lines = sorted.map((c) => {
      const g = donorTypeGroup(c.contributionType);
      const source = c.sourceRecordId ? sourceById.get(c.sourceRecordId) : null;
      return [
        c.date.slice(0, 10),
        nameOf(c.donorEntityId),
        g.label,
        g.fec,
        c.donorState ?? "",
        c.donorIndustry ? industryLabel(c.donorIndustry) : "",
        nameOf(c.recipientEntityId),
        partyByEntity[c.recipientEntityId] ?? "",
        c.amount,
        c.currency || "USD",
        source?.url || source?.title || "",
      ]
        .map(csvCell)
        .join(",");
    });
    const blob = new Blob([[header.join(","), ...lines].join("\n")], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "worldview-contributions.csv";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-60 flex-1">
          <SearchInput value={query} onChange={on(setQuery)} placeholder={searchPlaceholder} />
        </div>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Donor type
          <select value={type} onChange={(e) => on(setType)(e.target.value)} className={selectClass}>
            <option value="">All</option>
            {typeOptions.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Recipient party
          <select value={party} onChange={(e) => on(setParty)(e.target.value)} className={selectClass}>
            <option value="">All</option>
            <option value="D">Democratic</option>
            <option value="R">Republican</option>
            <option value="I">Independent</option>
            <option value="L">Libertarian</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Donor state
          <select value={state} onChange={(e) => on(setState)(e.target.value)} className={selectClass}>
            <option value="">All</option>
            {stateOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          Min. amount
          <input
            type="number"
            min={0}
            step={100}
            inputMode="numeric"
            value={minAmount}
            onChange={(e) => on(setMinAmount)(e.target.value)}
            placeholder="$0"
            className={`${selectClass} w-28`}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          From
          <input type="date" value={from} onChange={(e) => on(setFrom)(e.target.value)} className={selectClass} />
        </label>
        <label className="flex flex-col gap-1 text-xs text-slate-500 dark:text-slate-400">
          To
          <input type="date" value={to} onChange={(e) => on(setTo)(e.target.value)} className={selectClass} />
        </label>
      </div>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-sm">
        <p className="text-slate-600 dark:text-slate-300">
          <span className="font-semibold text-slate-900 tabular-nums dark:text-white">{visible.length.toLocaleString()}</span> contributions ·{" "}
          <span className="font-semibold text-slate-900 tabular-nums dark:text-white">{formatAmount(visibleTotal, "USD")}</span>
          {filtered ? (
            <button type="button" onClick={reset} className="ml-3 text-xs text-slate-500 underline underline-offset-2 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
              Clear filters
            </button>
          ) : null}
        </p>
        <button
          type="button"
          onClick={exportCsv}
          disabled={visible.length === 0}
          className="inline-flex items-center gap-1.5 rounded-md border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-slate-400 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
        >
          <Download className="h-4 w-4" />
          Export CSV
        </button>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No contributions match these filters.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-190 border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs tracking-wider text-slate-400 uppercase dark:border-slate-800">
                {["Date", "Donor", "Donor type", "Recipient", "Amount", "Source"].map((label, i) => (
                  <SortTh key={label} col={i} sort={sort} onSort={toggle} align={i === 4 ? "right" : "left"} className="py-2 pr-4 font-medium">
                    {label}
                  </SortTh>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.slice(0, shown).map((c) => {
                const donor = entityById.get(c.donorEntityId);
                const recipient = entityById.get(c.recipientEntityId);
                const source = c.sourceRecordId ? sourceById.get(c.sourceRecordId) : null;
                const g = donorTypeGroup(c.contributionType);
                const rParty = partyByEntity[c.recipientEntityId];
                return (
                  <tr key={c.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">{formatDate(c.date)}</td>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                      {donor ? (
                        <Link href={publicEntityPath(donor)} className="hover:underline">
                          {donor.name}
                        </Link>
                      ) : (
                        "Unnamed"
                      )}
                      {c.donorState ? <span className="ml-1.5 text-xs text-slate-400">{c.donorState}</span> : null}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-xs text-slate-500 dark:text-slate-400" title={g.fec}>
                      <span className="mr-1.5 inline-block h-2 w-2 rounded-sm" style={{ background: g.color }} />
                      {g.label}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-700 dark:text-slate-300">
                      {recipient ? (
                        <Link href={publicEntityPath(recipient)} className="hover:underline">
                          {recipient.name}
                        </Link>
                      ) : (
                        "Unnamed"
                      )}
                      {rParty ? (
                        <span className="ml-1.5 inline-flex items-center gap-1 text-xs text-slate-400">
                          <span className="h-1.5 w-1.5 rounded-full" style={{ background: partyColor(rParty) }} />
                          {partyLetter(rParty)}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 text-right tabular-nums text-slate-800 dark:text-slate-200">{formatAmount(c.amount, c.currency)}</td>
                    <td className="py-2.5 pr-4">
                      {source ? (
                        source.url ? (
                          <a href={source.url} target="_blank" rel="noreferrer" className="text-xs underline">
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
          <div className="mt-3 flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
            <span className="tabular-nums">
              Showing {Math.min(shown, visible.length).toLocaleString()} of {visible.length.toLocaleString()}
            </span>
            {shown < visible.length ? (
              <button
                type="button"
                onClick={() => setShown((n) => n + PAGE_SIZE * 2)}
                className="rounded-md border border-slate-200 px-3 py-1 font-medium text-slate-700 hover:border-slate-400 dark:border-slate-700 dark:text-slate-200"
              >
                Show more
              </button>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
