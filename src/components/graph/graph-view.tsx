"use client";

import { EntitySearch } from "./entity-search";
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
  return (
    <div className="flex h-full flex-col">
      <EntitySearch entities={entities} placeholder={searchPlaceholder} />

      <div className="mt-4 flex-1 overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800">
        <EntityGraph entities={entities} edges={edges} positions={positions} />
      </div>
    </div>
  );
}
