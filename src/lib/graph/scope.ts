// Pure client/server-safe helpers for narrowing the People graph to
// something legible. The store holds ~1,100 entities and ~1,300 edges and
// the shape is a hub-and-spoke star: four mega-nodes (the two chambers,
// the two parties) absorb almost every edge, so rendering the whole thing
// at once is unreadable. graph-page.tsx loads everything once and then
// applies one of these to pick what actually gets drawn.

import { entityTypes, type Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import { relationshipCategoryOf } from "@/lib/relationships";

export interface Subgraph {
  entities: Entity[];
  edges: Edge[];
}

/**
 * Keep only edges whose relationship category is in `categories`, then drop
 * any node that's now unconnected (except `keepId`, so a focused person
 * doesn't vanish when none of their edges match).
 */
export function filterByRelCategory(
  sub: Subgraph,
  categories: Set<string>,
  keepId?: string,
): Subgraph {
  if (categories.size === 0) return sub;
  const edges = sub.edges.filter((e) => {
    const cat = relationshipCategoryOf(e.relType ?? "");
    return cat !== null && categories.has(cat);
  });
  const connected = new Set(edges.flatMap((e) => [e.sourceEntityId, e.targetEntityId]));
  if (keepId) connected.add(keepId);
  return { entities: sub.entities.filter((e) => connected.has(e.id)), edges };
}

// The nodes that turn the graph into a hairball. Matched by name because
// there's no "is a hub" flag in the data. Kept out of overview and not
// expanded through during neighbourhood traversal unless asked for.
export const HUB_ENTITY_NAMES = new Set<string>([
  "United States House of Representatives",
  "United States Senate",
  "Republican Party",
  "Democratic Party",
]);

// Kept in sync with the schema's entity taxonomy so the filter chips and
// the legend never drift.
export const ENTITY_TYPE_ORDER = entityTypes;

function degreeMap(edges: Edge[]): Map<string, number> {
  const deg = new Map<string, number>();
  for (const e of edges) {
    deg.set(e.sourceEntityId, (deg.get(e.sourceEntityId) ?? 0) + 1);
    deg.set(e.targetEntityId, (deg.get(e.targetEntityId) ?? 0) + 1);
  }
  return deg;
}

function edgesWithin(edges: Edge[], ids: Set<string>): Edge[] {
  return edges.filter((e) => ids.has(e.sourceEntityId) && ids.has(e.targetEntityId));
}

/** Degree of every entity over the full edge set; handed to the renderer for node sizing. */
export function degreeById(edges: Edge[]): Record<string, number> {
  return Object.fromEntries(degreeMap(edges));
}

/** Distinct relationship labels with counts, most common first; drives the filter chips. */
export function edgeLabelCounts(edges: Edge[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/**
 * The "connected core" starting view. Almost every politician is wired
 * only to their party and chamber (the hubs), which says nothing, so the
 * overview drops the hubs and keeps the sub-networks that are actually a
 * graph: the donor→politician money cluster, governor clusters, the media
 * host/founder clusters, etc. Whole connected components are taken
 * largest-first up to `limit` nodes. Falls back to top-degree when there
 * are no non-hub edges yet (a fresh database).
 */
export function overviewSubgraph(
  entities: Entity[],
  edges: Edge[],
  { limit = 160, entityTypes }: { limit?: number; entityTypes?: Set<string> } = {},
): Subgraph {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const hubNames = HUB_ENTITY_NAMES;
  const nonHubEdges = edges.filter(
    (e) =>
      !hubNames.has(byId.get(e.sourceEntityId)?.name ?? "") &&
      !hubNames.has(byId.get(e.targetEntityId)?.name ?? ""),
  );

  if (nonHubEdges.length === 0) {
    const deg = degreeMap(edges);
    const top = entities
      .filter((e) => !hubNames.has(e.name))
      .filter((e) => !entityTypes || entityTypes.has(e.type))
      .sort((a, b) => (deg.get(b.id) ?? 0) - (deg.get(a.id) ?? 0))
      .slice(0, limit);
    const ids = new Set(top.map((e) => e.id));
    return { entities: top, edges: edgesWithin(edges, ids) };
  }

  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adjacency.get(a);
    if (list) list.push(b);
    else adjacency.set(a, [b]);
  };
  for (const e of nonHubEdges) {
    link(e.sourceEntityId, e.targetEntityId);
    link(e.targetEntityId, e.sourceEntityId);
  }

  const seen = new Set<string>();
  const components: string[][] = [];
  for (const startId of adjacency.keys()) {
    if (seen.has(startId)) continue;
    const stack = [startId];
    seen.add(startId);
    const comp: string[] = [];
    while (stack.length) {
      const id = stack.pop()!;
      comp.push(id);
      for (const other of adjacency.get(id) ?? []) {
        if (!seen.has(other)) {
          seen.add(other);
          stack.push(other);
        }
      }
    }
    components.push(comp);
  }
  components.sort((a, b) => b.length - a.length);

  const kept = new Set<string>();
  for (const comp of components) {
    if (kept.size >= limit) break;
    for (const id of comp) kept.add(id);
  }

  let scoped = [...kept].map((id) => byId.get(id)!).filter(Boolean);
  if (entityTypes) scoped = scoped.filter((e) => entityTypes.has(e.type));
  const ids = new Set(scoped.map((e) => e.id));
  return { entities: scoped, edges: edgesWithin(nonHubEdges, ids) };
}

/**
 * The ego network around one entity: everything within `depth` hops.
 * Hubs are shown when directly adjacent but never expanded through (so
 * depth 2 from a senator doesn't drag in all 100 senators), unless
 * `includeHubs` is set.
 */
export function neighborhoodSubgraph(
  entities: Entity[],
  edges: Edge[],
  rootId: string,
  {
    depth = 1,
    entityTypes,
    includeHubs = false,
  }: { depth?: number; entityTypes?: Set<string>; includeHubs?: boolean } = {},
): Subgraph {
  const byId = new Map(entities.map((e) => [e.id, e]));
  if (!byId.has(rootId)) return { entities: [], edges: [] };

  const hubIds = new Set(
    entities.filter((e) => HUB_ENTITY_NAMES.has(e.name)).map((e) => e.id),
  );
  const adjacency = new Map<string, string[]>();
  const link = (a: string, b: string) => {
    const list = adjacency.get(a);
    if (list) list.push(b);
    else adjacency.set(a, [b]);
  };
  for (const e of edges) {
    link(e.sourceEntityId, e.targetEntityId);
    link(e.targetEntityId, e.sourceEntityId);
  }

  const reached = new Set<string>([rootId]);
  let frontier = [rootId];
  for (let hop = 0; hop < depth; hop++) {
    const next: string[] = [];
    for (const id of frontier) {
      // Don't traverse outward *through* a hub (unless asked).
      if (!includeHubs && hubIds.has(id) && id !== rootId) continue;
      for (const other of adjacency.get(id) ?? []) {
        if (reached.has(other)) continue;
        if (!includeHubs && hubIds.has(other)) {
          reached.add(other); // show it, don't expand it
          continue;
        }
        reached.add(other);
        next.push(other);
      }
    }
    frontier = next;
  }

  let scoped = [...reached].map((id) => byId.get(id)!).filter(Boolean);
  if (entityTypes) {
    scoped = scoped.filter((e) => e.id === rootId || entityTypes.has(e.type));
  }
  const ids = new Set(scoped.map((e) => e.id));
  return { entities: scoped, edges: edgesWithin(edges, ids) };
}
