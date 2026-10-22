"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { SearchInput } from "@/components/search/search-input";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import { publicEntityPath } from "@/lib/people/public";

function parseMetadata(raw: string): [string, string][] {
  if (!raw.trim()) return [];
  try {
    const obj: unknown = JSON.parse(raw);
    if (obj && typeof obj === "object" && !Array.isArray(obj)) {
      return Object.entries(obj as Record<string, unknown>).map(([k, v]) => [k, String(v)]);
    }
  } catch {
    // not valid JSON — ignore rather than crash the page
  }
  return [];
}

export function EntityTypeSection({
  heading,
  entities,
  allEntitiesById,
  edges,
  searchPlaceholder,
}: {
  heading: string;
  entities: Entity[];
  allEntitiesById: Map<string, Entity>;
  edges: Edge[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entities;
    return entities.filter(
      (e) => e.name.toLowerCase().includes(q) || (e.description ?? "").toLowerCase().includes(q),
    );
  }, [entities, query]);

  return (
    <section className="mt-8 first:mt-0">
      <h2 className="text-xs font-semibold tracking-wider text-slate-400 uppercase">{heading}</h2>

      {entities.length === 0 ? (
        <p className="mt-3 text-sm text-slate-400">None yet.</p>
      ) : (
        <>
          <div className="mt-3">
            <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />
          </div>
          {visible.length === 0 ? (
            <p className="mt-4 text-sm text-slate-400">No matches for &ldquo;{query}&rdquo;.</p>
          ) : (
            <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
              {visible.map((e) => {
                const connections = edges.filter(
                  (edge) => edge.sourceEntityId === e.id || edge.targetEntityId === e.id,
                );
                const metadata = parseMetadata(e.metadata ?? "");
                return (
                  <div
                    key={e.id}
                    className="rounded-lg border border-slate-200 p-4 dark:border-slate-800"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <Link
                        href={publicEntityPath(e)}
                        className="font-medium text-slate-900 hover:underline dark:text-slate-100"
                      >
                        {e.name}
                      </Link>
                    </div>
                    {e.description ? (
                      <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{e.description}</p>
                    ) : null}
                    {metadata.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {metadata.map(([k, v]) => (
                          <span
                            key={k}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-slate-800 dark:text-slate-300"
                          >
                            {k}: {v}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {connections.length > 0 ? (
                      <ul className="mt-3 flex flex-col gap-1 border-t border-slate-100 pt-2 text-xs text-slate-500 dark:border-slate-900 dark:text-slate-400">
                        {connections.map((edge) => {
                          const otherId =
                            edge.sourceEntityId === e.id ? edge.targetEntityId : edge.sourceEntityId;
                          const other = allEntitiesById.get(otherId);
                          const direction = edge.sourceEntityId === e.id ? "→" : "←";
                          return (
                            <li key={edge.id} className="flex items-center gap-1.5">
                              <span
                                className="h-1.5 w-1.5 shrink-0 rounded-full border"
                                style={{
                                  background: other ? entityColorFor(other.type).bg : "#fff",
                                  borderColor: other ? entityColorFor(other.type).border : "#94A3B8",
                                }}
                              />
                              {direction} {edge.label} {direction} {other?.name ?? "Unknown"}
                            </li>
                          );
                        })}
                      </ul>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}
