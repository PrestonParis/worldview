"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/search-input";
import type { Entity } from "@/lib/validation/entity";
import type { Claim } from "@/lib/validation/claim";
import type { Source } from "@/lib/validation/source";

type FeedItem =
  | { kind: "claim"; date: string; claim: Claim }
  | { kind: "source"; date: string; source: Source };

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function NewsFeedView({
  claims,
  sources,
  entities,
  searchPlaceholder,
}: {
  claims: Claim[];
  sources: Source[];
  entities: Entity[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");
  const entityById = useMemo(() => new Map(entities.map((e) => [e.id, e])), [entities]);

  const items = useMemo<FeedItem[]>(() => {
    const claimItems: FeedItem[] = claims.map((c) => ({ kind: "claim", date: c.date, claim: c }));
    const sourceItems: FeedItem[] = sources
      .filter((s): s is typeof s & { publishedAt: string } => Boolean(s.publishedAt))
      .map((s) => ({ kind: "source", date: s.publishedAt, source: s }));
    return [...claimItems, ...sourceItems].sort((a, b) => (a.date < b.date ? 1 : -1));
  }, [claims, sources]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((item) => {
      if (item.kind === "claim") {
        const speaker = entityById.get(item.claim.speakerEntityId)?.name ?? "";
        return (
          item.claim.quote.toLowerCase().includes(q) || speaker.toLowerCase().includes(q)
        );
      }
      return (
        item.source.title.toLowerCase().includes(q) ||
        (item.source.publisher ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, entityById, query]);

  return (
    <div>
      <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />

      {visible.length === 0 ? (
        <p className="mt-6 text-sm text-slate-400">No results for &ldquo;{query}&rdquo;.</p>
      ) : (
        <ol className="mt-6 flex flex-col divide-y divide-slate-200 dark:divide-slate-800">
          {visible.map((item) =>
            item.kind === "claim" ? (
              <li key={`claim-${item.claim.id}`} className="flex gap-4 py-3">
                <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">
                  {formatDate(item.date)}
                </span>
                <div>
                  <span className="mr-2 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 dark:bg-blue-950 dark:text-blue-300">
                    Statement
                  </span>
                  <span className="text-sm text-slate-800 dark:text-slate-200">
                    {entityById.get(item.claim.speakerEntityId)?.name ?? "Unknown"} — &ldquo;
                    {item.claim.quote}&rdquo;
                  </span>
                </div>
              </li>
            ) : (
              <li key={`source-${item.source.id}`} className="flex gap-4 py-3">
                <span className="w-24 shrink-0 pt-0.5 text-xs tabular-nums text-slate-400">
                  {formatDate(item.date)}
                </span>
                <div>
                  <span className="mr-2 rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
                    {item.source.sourceType.replace("_", " ")}
                  </span>
                  {item.source.url ? (
                    <a
                      href={item.source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm text-slate-800 underline dark:text-slate-200"
                    >
                      {item.source.title}
                    </a>
                  ) : (
                    <span className="text-sm text-slate-800 dark:text-slate-200">{item.source.title}</span>
                  )}
                  {item.source.publisher ? (
                    <span className="ml-1 text-xs text-slate-400">— {item.source.publisher}</span>
                  ) : null}
                </div>
              </li>
            ),
          )}
        </ol>
      )}
    </div>
  );
}
