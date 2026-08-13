"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/search/search-input";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Claim } from "@/lib/validation/claim";
import type { Source } from "@/lib/validation/source";

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ClaimListView({
  claims,
  entities,
  sources,
  mode,
  searchPlaceholder,
}: {
  claims: Claim[];
  entities: Entity[];
  sources: Source[];
  mode: "timeline" | "workbench";
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);
  const claimById = useMemo(() => new Map(claims.map((c) => [c.id, c])), [claims]);
  const sourceById = useMemo(() => new Map(sources.map((s) => [s.id, s])), [sources]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return claims;
    return claims.filter((c) => {
      const speaker = entityById.get(c.speakerEntityId)?.name ?? "";
      return (
        c.quote.toLowerCase().includes(q) ||
        (c.topic ?? "").toLowerCase().includes(q) ||
        speaker.toLowerCase().includes(q)
      );
    });
  }, [claims, entityById, query]);

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No claims match &ldquo;{query}&rdquo;.</p>
      ) : mode === "timeline" ? (
        <ol className="relative mt-6 flex flex-col gap-6 border-l border-slate-200 pl-6 dark:border-slate-800">
          {visible.map((c) => {
            const speaker = entityById.get(c.speakerEntityId);
            return (
              <li key={c.id} className="relative">
                <span
                  className="absolute top-1.5 -left-[27px] h-2.5 w-2.5 rounded-full border-2"
                  style={{
                    background: speaker ? entityColorFor(speaker.type).bg : "#fff",
                    borderColor: speaker ? entityColorFor(speaker.type).border : "#94A3B8",
                  }}
                />
                <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                  <span className="tabular-nums">{formatDate(c.date)}</span>
                  {speaker ? (
                    <>
                      <span>·</span>
                      <span className="font-medium text-slate-700 dark:text-slate-300">{speaker.name}</span>
                    </>
                  ) : null}
                  {c.venue ? (
                    <>
                      <span>·</span>
                      <span>{c.venue}</span>
                    </>
                  ) : null}
                  {c.topic ? (
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 dark:bg-slate-800">{c.topic}</span>
                  ) : null}
                </div>
                <blockquote className="mt-1.5 text-slate-800 dark:text-slate-200">
                  &ldquo;{c.quote}&rdquo;
                </blockquote>
                {c.positionClassification ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                    Position: {c.positionClassification}
                    {c.confidence != null ? ` · ${c.confidence}% confidence` : ""}
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      ) : (
        <div className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs tracking-wider text-slate-400 uppercase dark:border-slate-800">
                <th className="py-2 pr-4 font-medium">Date</th>
                <th className="py-2 pr-4 font-medium">Speaker</th>
                <th className="py-2 pr-4 font-medium">Claim</th>
                <th className="py-2 pr-4 font-medium">Position</th>
                <th className="py-2 pr-4 font-medium">Confidence</th>
                <th className="py-2 pr-4 font-medium">Contradicts</th>
              </tr>
            </thead>
            <tbody>
              {visible.map((c) => {
                const speaker = entityById.get(c.speakerEntityId);
                const contradicts = c.contradictsClaimId ? claimById.get(c.contradictsClaimId) : null;
                const source = c.sourceId ? sourceById.get(c.sourceId) : null;
                return (
                  <tr key={c.id} className="border-b border-slate-100 align-top dark:border-slate-900">
                    <td className="py-2.5 pr-4 whitespace-nowrap tabular-nums text-slate-500 dark:text-slate-400">
                      {formatDate(c.date)}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {speaker?.name ?? "Unknown"}
                    </td>
                    <td className="py-2.5 pr-4 text-slate-800 dark:text-slate-200">
                      &ldquo;{c.quote}&rdquo;
                      {source ? (
                        <span className="ml-1 text-xs text-slate-400">
                          (
                          {source.url ? (
                            <a href={source.url} target="_blank" rel="noreferrer" className="underline">
                              {source.title}
                            </a>
                          ) : (
                            source.title
                          )}
                          )
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2.5 pr-4 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {c.positionClassification || "—"}
                    </td>
                    <td className="py-2.5 pr-4 tabular-nums text-slate-600 dark:text-slate-400">
                      {c.confidence != null ? `${c.confidence}%` : "—"}
                    </td>
                    <td className="py-2.5 pr-4">
                      {contradicts ? (
                        <Link
                          href={`/data/claims/${contradicts.id}/edit`}
                          className="text-xs text-red-600 underline decoration-dotted dark:text-red-400"
                          title={contradicts.quote}
                        >
                          &ldquo;{contradicts.quote.slice(0, 40)}
                          {contradicts.quote.length > 40 ? "…" : ""}&rdquo;
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">—</span>
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
