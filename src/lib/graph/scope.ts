// Pure client/server-safe helpers for narrowing the People graph to
// something legible. The store holds ~1,100 entities and ~1,300 edges and
// the shape is a hub-and-spoke star — four mega-nodes (the two chambers,
// the two parties) absorb almost every edge — so rendering the whole thing
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

// Seats, committee slots and party cards: ~11k of the ~13k edges, and they
// say where someone sits rather than who they're tied to. The overview
// leaves them out (they're what glued 700+ legislators and committees into
// one unreadable blob) unless the "institutional" filter is picked; a
// focused ego network keeps them, since there they *are* the story.
export const STRUCTURAL_REL_TYPES = new Set<string>([
  "serves-in",
  "sits-on-committee",
  "chairs",
  "governor-of",
  "holds-office",
  "party-member",
]);

export function withoutStructuralEdges(edges: Edge[]): Edge[] {
  return edges.filter(
    (e) =>
      !STRUCTURAL_REL_TYPES.has(e.relType ?? "") &&
      // Subcommittee → committee links are typed member-of (there's no
      // dedicated slug) but are just as much plumbing as committee seats.
      e.label !== "subcommittee of",
  );
}

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

/** Degree of every entity over the full edge set — handed to the renderer for node sizing. */
export function degreeById(edges: Edge[]): Record<string, number> {
  return Object.fromEntries(degreeMap(edges));
}

/** Distinct relationship labels with counts, most common first — drives the filter chips. */
export function edgeLabelCounts(edges: Edge[]): { label: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const e of edges) counts.set(e.label, (counts.get(e.label) ?? 0) + 1);
  return [...counts.entries()]
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** How many entities the overview could draw at each tier — drives the "show more" control. */
export interface OverviewTiers {
  /** Entities with at least one real (non-structural) tie. */
  direct: number;
  /** Entities reachable only through seats, committees and offices. */
  structural: number;
  /** Entities with no ties at all once the four hubs are set aside. */
  unconnected: number;
}

function components(edges: Edge[]): string[][] {
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
  const deg = degreeMap(edges);
  // Breadth-first from each component's best-connected node, so a
  // component cut off at the limit keeps its core rather than a random
  // fringe.
  const starts = [...adjacency.keys()].sort((a, b) => (deg.get(b) ?? 0) - (deg.get(a) ?? 0));
  const seen = new Set<string>();
  const comps: string[][] = [];
  for (const startId of starts) {
    if (seen.has(startId)) continue;
    const comp = [startId];
    seen.add(startId);
    for (let i = 0; i < comp.length; i++) {
      for (const other of adjacency.get(comp[i]) ?? []) {
        if (!seen.has(other)) {
          seen.add(other);
          comp.push(other);
        }
      }
    }
    comps.push(comp);
  }
  return comps.sort((a, b) => b.length - a.length);
}

/**
 * The starting view, filled in tiers until `limit` entities are drawn:
 *
 * 1. Whole sub-networks of real ties (`edges`) — the donor→politician
 *    money cluster, media host/founder clusters, etc. — largest first.
 * 2. Then, if `structuralEdges` is given, people tied in only by seats,
 *    committees and offices. Their structural edges come with them.
 * 3. Then, if `includeUnconnected`, everyone with no ties at all.
 *
 * The four hubs are always left out: nearly every politician is wired to
 * a party and a chamber, which says nothing and collapses the layout.
 */
export function overviewSubgraph(
  entities: Entity[],
  edges: Edge[],
  {
    limit = 500,
    entityTypes,
    structuralEdges,
    includeUnconnected = false,
  }: {
    limit?: number;
    entityTypes?: Set<string>;
    structuralEdges?: Edge[];
    includeUnconnected?: boolean;
  } = {},
): Subgraph & { tiers: OverviewTiers } {
  const byId = new Map(entities.map((e) => [e.id, e]));
  const eligible = (id: string) => {
    const e = byId.get(id);
    return !!e && !HUB_ENTITY_NAMES.has(e.name) && (!entityTypes || entityTypes.has(e.type));
  };
  const usable = (list: Edge[]) =>
    list.filter((e) => eligible(e.sourceEntityId) && eligible(e.targetEntityId));

  const direct = usable(edges);
  const structural = structuralEdges ? usable(structuralEdges) : [];

  const kept = new Set<string>();
  const take = (ids: Iterable<string>) => {
    for (const id of ids) {
      if (kept.size >= limit) return;
      kept.add(id);
    }
  };
  const directComps = components(direct);
  for (const comp of directComps) take(comp);
  const directCount = directComps.reduce((n, c) => n + c.length, 0);

  const structuralComps = components(structural);
  const connected = new Set([...directComps.flat(), ...structuralComps.flat()]);
  for (const comp of structuralComps) take(comp.filter((id) => !kept.has(id)));
  const structuralCount = connected.size - directCount;

  const unconnected = entities
    .filter((e) => eligible(e.id) && !connected.has(e.id))
    .map((e) => e.id);
  if (includeUnconnected) take(unconnected);

  const scoped = [...kept].map((id) => byId.get(id)!);
  // Structural edges only join in once the view has grown past the real
  // ties — before that they'd only add committee clutter.
  const pool = kept.size > directCount ? [...direct, ...structural] : direct;
  const seenEdge = new Set<string>();
  const within = edgesWithin(pool, kept).filter((e) => !seenEdge.has(e.id) && seenEdge.add(e.id));
  return {
    entities: scoped,
    edges: within,
    tiers: { direct: directCount, structural: structuralCount, unconnected: unconnected.length },
  };
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
