"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/search/search-input";
import { electionLevels, electionTypes } from "@/lib/validation/election";
import { partyColorFor } from "@/lib/party-colors";
import { ElectionStatusPill } from "./election-status";
import type { Election } from "@/lib/validation/election";
import type { ElectionSummary } from "@/lib/validation/candidacy";
import type { Entity } from "@/lib/validation/entity";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function titleCase(s: string): string {
  return s.replace(/^./, (c) => c.toUpperCase());
}

function Outcome({
  summary,
  entityById,
}: {
  summary?: ElectionSummary;
  entityById: Map<string, Entity>;
}) {
  if (!summary || !summary.reporting) {
    return <span className="text-xs text-slate-400">No results recorded</span>;
  }
  const winnerId = summary.winnerEntityId ?? summary.leaderEntityId;
  const winner = winnerId ? entityById.get(winnerId) : undefined;
  const party = summary.winnerEntityId ? summary.winnerParty : summary.leaderParty;
  const color = partyColorFor(party);
  return (
    <span className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
      <span
        className="inline-block h-2 w-2 shrink-0 rounded-full"
        style={{ background: color.border }}
        aria-hidden
      />
      <span className="text-slate-700 dark:text-slate-300">
        {winner?.name ?? "Unknown"}
      </span>
      {summary.marginPct != null ? (
        <span className="tabular-nums">
          +{summary.marginPct.toFixed(1)} pts
        </span>
      ) : null}
    </span>
  );
}

export function ElectionListView({
  elections,
  summaries,
  entities,
  searchPlaceholder,
}: {
  elections: Election[];
  summaries: Record<string, ElectionSummary>;
  entities: Entity[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const [levelFilter, setLevelFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const entityById = useMemo(
    () => new Map(entities.map((e) => [e.id, e])),
    [entities],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return elections.filter((e) => {
      if (levelFilter && e.level !== levelFilter) return false;
      if (typeFilter && e.electionType !== typeFilter) return false;
      if (!q) return true;
      const summary = summaries[e.id];
      const winnerId = summary?.winnerEntityId ?? summary?.leaderEntityId;
      const winner = winnerId ? entityById.get(winnerId)?.name ?? "" : "";
      return (
        e.name.toLowerCase().includes(q) ||
        e.office.toLowerCase().includes(q) ||
        e.jurisdiction.toLowerCase().includes(q) ||
        winner.toLowerCase().includes(q)
      );
    });
  }, [elections, summaries, entityById, query, levelFilter, typeFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
        <select
          value={levelFilter}
          onChange={(e) => setLevelFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">All levels</option>
          {electionLevels.map((l) => (
            <option key={l} value={l}>
              {titleCase(l)}
            </option>
          ))}
        </select>
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
        >
          <option value="">All types</option>
          {electionTypes.map((t) => (
            <option key={t} value={t}>
              {titleCase(t)}
            </option>
          ))}
        </select>
      </div>

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No elections match this search.</p>
      ) : (
        <ul className="mt-6 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {visible.map((e) => (
            <li key={e.id}>
              <Link
                href={`/elections/${e.id}`}
                className="flex flex-wrap items-center justify-between gap-2 py-3 hover:bg-slate-50 dark:hover:bg-slate-900/50"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-slate-900 dark:text-slate-100">{e.name}</p>
                    <ElectionStatusPill status={e.status} />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {e.office} · {e.jurisdiction} · {formatDate(e.electionDate)}
                  </p>
                </div>
                <Outcome summary={summaries[e.id]} entityById={entityById} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
