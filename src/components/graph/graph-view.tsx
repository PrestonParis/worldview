"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";
import { EntitySearch } from "./entity-search";
import { EntityGraph } from "./entity-graph";
import { ENTITY_TYPE_ORDER } from "@/lib/graph/scope";
import { entityColorFor } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

export function GraphView({
  entities,
  edges,
  positions,
  allEntities,
  rootEntity,
  depth,
  includeHubs,
  typeFilter,
  totalEntityCount,
  searchPlaceholder,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
  allEntities: Entity[];
  rootEntity: Entity | null;
  depth: number;
  includeHubs: boolean;
  typeFilter: string[];
  totalEntityCount: number;
  searchPlaceholder: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams);
      for (const [key, value] of Object.entries(patch)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const qs = next.toString();
      router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  const activeTypes = new Set(typeFilter);
  const toggleType = (t: string) => {
    const next = new Set(activeTypes);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    setParams({ type: next.size ? [...next].join(",") : null });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <EntitySearch
          entities={allEntities}
          placeholder={searchPlaceholder}
          onSelect={(id) => setParams({ root: id })}
        />

        {ENTITY_TYPE_ORDER.map((t) => {
          const active = activeTypes.has(t);
          const c = entityColorFor(t);
          return (
            <button
              key={t}
              type="button"
              onClick={() => toggleType(t)}
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors ${
                active
                  ? "text-slate-900 dark:text-slate-100"
                  : "border-slate-200 text-slate-500 hover:border-slate-400 dark:border-slate-800 dark:text-slate-400"
              }`}
              style={active ? { background: c.bg, borderColor: c.border, color: c.text } : undefined}
            >
              <span
                className="h-2 w-2 rounded-full border-2"
                style={{ background: c.bg, borderColor: c.border }}
              />
              {t}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 dark:text-slate-400">
        {rootEntity ? (
          <>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-200">
              Focused on {rootEntity.name}
              <button
                type="button"
                aria-label="Clear focus"
                onClick={() => setParams({ root: null, depth: null, hubs: null })}
                className="rounded-full p-0.5 hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
            <span className="flex items-center gap-1">
              hops:
              {[1, 2, 3].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setParams({ depth: String(d) })}
                  className={`rounded px-1.5 py-0.5 tabular-nums ${
                    depth === d
                      ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
                      : "hover:bg-slate-100 dark:hover:bg-slate-800"
                  }`}
                >
                  {d}
                </button>
              ))}
            </span>
            <label className="flex cursor-pointer items-center gap-1.5">
              <input
                type="checkbox"
                checked={includeHubs}
                onChange={(e) => setParams({ hubs: e.target.checked ? "1" : null })}
                className="h-3.5 w-3.5 rounded border-slate-300 dark:border-slate-600"
              />
              expand parties &amp; chambers
            </label>
          </>
        ) : (
          <span>
            Showing the connected core — {entities.length} of {totalEntityCount}, with party
            and chamber hubs hidden. Search for anyone to focus on their neighbourhood; click
            a node to open its profile.
          </span>
        )}
        <span className="ml-auto tabular-nums">
          {entities.length} shown · {edges.length} links
        </span>
      </div>

      <div className="mt-3 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <EntityGraph entities={entities} edges={edges} positions={positions} />
      </div>
    </div>
  );
}
