"use client";

import { useMemo, useState } from "react";
import { SearchInput } from "@/components/search/search-input";
import { EntityGraph } from "./entity-graph";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

export function GraphView({
  entities,
  edges,
  positions,
  searchPlaceholder,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
  searchPlaceholder: string;
}) {
  const [query, setQuery] = useState("");

  const { visibleEntities, visibleEdges } = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return { visibleEntities: entities, visibleEdges: edges };

    const matches = new Set(
      entities.filter((e) => e.name.toLowerCase().includes(q)).map((e) => e.id),
    );
    return {
      visibleEntities: entities.filter((e) => matches.has(e.id)),
      visibleEdges: edges.filter(
        (e) => matches.has(e.sourceEntityId) && matches.has(e.targetEntityId),
      ),
    };
  }, [entities, edges, query]);

  return (
    <div className="flex h-full flex-col">
      <SearchInput value={query} onChange={setQuery} placeholder={searchPlaceholder} />

      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        {visibleEntities.length === 0 ? (
          <div className="flex h-full items-center justify-center text-sm text-slate-400">
            No entities match &ldquo;{query}&rdquo;.
          </div>
        ) : (
          <EntityGraph entities={visibleEntities} edges={visibleEdges} positions={positions} />
        )}
      </div>
    </div>
  );
}
