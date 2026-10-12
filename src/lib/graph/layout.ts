import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
import Graph from "graphology";
import forceAtlas2 from "graphology-layout-forceatlas2";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";

export interface PositionedNode {
  id: string;
  x: number;
  y: number;
}

interface SimNode extends SimulationNodeDatum {
  id: string;
}

// Runs entirely server-side (d3-force has no DOM dependency) so the client
// bundle only has to ship the render layer, not the simulation. Ticked
// synchronously to a fixed count rather than animated — we want a settled
// layout on first paint, not a live physics view.
export function computeForceLayout(entities: Entity[], edges: Edge[]): PositionedNode[] {
  if (entities.length === 0) return [];

  const nodes: SimNode[] = entities.map((e) => ({ id: e.id }));
  const links: SimulationLinkDatum<SimNode>[] = edges
    .filter(
      (e) =>
        entities.some((n) => n.id === e.sourceEntityId) &&
        entities.some((n) => n.id === e.targetEntityId),
    )
    .map((e) => ({ source: e.sourceEntityId, target: e.targetEntityId }));

  const simulation = forceSimulation(nodes)
    .force(
      "link",
      forceLink<SimNode, SimulationLinkDatum<SimNode>>(links)
        .id((d) => d.id)
        .distance(160),
    )
    .force("charge", forceManyBody().strength(-350))
    .force("center", forceCenter(0, 0))
    .force("collide", forceCollide(70))
    .stop();

  const iterations = Math.min(400, Math.max(120, entities.length * 4));
  for (let i = 0; i < iterations; i++) simulation.tick();

  return nodes.map((n) => ({ id: n.id, x: n.x ?? 0, y: n.y ?? 0 }));
}

const LAYER_HEIGHT = 180;
const NODE_SPACING = 240;

// Layered top-down layout for directed flows (e.g. money moving from
// donor to recipient): a node's layer is one below the deepest node
// that flows into it, so entities with no incoming edges — the ultimate
// sources — settle at the top and everything downstream cascades below
// them. Within a layer, nodes are ordered by the average x of their
// predecessors (a simple barycenter pass) to keep edges from crossing
// more than necessary.
export function computeHierarchicalLayout(entities: Entity[], edges: Edge[]): PositionedNode[] {
  if (entities.length === 0) return [];

  const entityIds = new Set(entities.map((e) => e.id));
  const relevantEdges = edges.filter(
    (e) => entityIds.has(e.sourceEntityId) && entityIds.has(e.targetEntityId),
  );

  const incoming = new Map<string, string[]>();
  for (const e of relevantEdges) {
    incoming.set(e.targetEntityId, [...(incoming.get(e.targetEntityId) ?? []), e.sourceEntityId]);
  }

  const layerOf = new Map<string, number>();
  function layerFor(id: string, visiting: Set<string>): number {
    const cached = layerOf.get(id);
    if (cached !== undefined) return cached;
    if (visiting.has(id)) return 0; // cycle guard — shouldn't happen, but data can be messy
    visiting.add(id);
    const preds = incoming.get(id) ?? [];
    const layer = preds.length === 0 ? 0 : Math.max(...preds.map((p) => layerFor(p, visiting))) + 1;
    visiting.delete(id);
    layerOf.set(id, layer);
    return layer;
  }
  for (const e of entities) layerFor(e.id, new Set());

  const byLayer = new Map<number, string[]>();
  for (const e of entities) {
    const layer = layerOf.get(e.id) ?? 0;
    byLayer.set(layer, [...(byLayer.get(layer) ?? []), e.id]);
  }

  const nameById = new Map(entities.map((e) => [e.id, e.name]));
  const xById = new Map<string, number>();
  const positions: PositionedNode[] = [];

  const sortedLayers = [...byLayer.keys()].sort((a, b) => a - b);
  for (const layer of sortedLayers) {
    const ids = byLayer.get(layer)!;
    const avgPredecessorX = (id: string) => {
      const preds = incoming.get(id) ?? [];
      if (preds.length === 0) return 0;
      return preds.reduce((sum, p) => sum + (xById.get(p) ?? 0), 0) / preds.length;
    };
    ids.sort(
      (a, b) => avgPredecessorX(a) - avgPredecessorX(b) || nameById.get(a)!.localeCompare(nameById.get(b)!),
    );

    const width = (ids.length - 1) * NODE_SPACING;
    ids.forEach((id, i) => {
      const x = i * NODE_SPACING - width / 2;
      xById.set(id, x);
      positions.push({ id, x, y: layer * LAYER_HEIGHT });
    });
  }

  return positions;
}

// Deterministic pseudo-random in [0, 1) from a string, so the same graph
// gets the same starting positions (and so the same settled layout) on
// every request instead of reshuffling on each reload.
function seeded(id: string, salt: number): number {
  let h = 2166136261 ^ salt;
  for (let i = 0; i < id.length; i++) {
    h ^= id.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 100000) / 100000;
}

// ForceAtlas2 — the standard layout for social networks: it pulls tightly
// knit groups into visible clusters and pushes hubs apart, where d3-force's
// uniform springs tend to produce one undifferentiated disc. Used for the
// People overview.
export function computeClusterLayout(
  nodes: { id: string; size: number }[],
  links: { source: string; target: string }[],
): PositionedNode[] {
  if (nodes.length === 0) return [];
  const graph = new Graph({ type: "undirected", multi: false });
  for (const n of nodes) {
    // Seed in a small box: FA2's forces are scale-free but weak at long
    // range, so a wide random start never converges and stays a square.
    graph.addNode(n.id, { x: seeded(n.id, 1) * 10, y: seeded(n.id, 2) * 10, size: n.size });
  }
  for (const l of links) {
    if (l.source !== l.target && graph.hasNode(l.source) && graph.hasNode(l.target)) {
      graph.mergeEdge(l.source, l.target);
    }
  }
  forceAtlas2.assign(graph, {
    iterations: nodes.length > 5000 ? 120 : nodes.length > 500 ? 300 : 600,
    settings: {
      ...forceAtlas2.inferSettings(graph),
      barnesHutOptimize: nodes.length > 300,
      // Not adjustSizes: node sizes are screen pixels, unrelated to layout
      // units, and letting them drive repulsion swamps the edge attraction
      // that's supposed to form the clusters.
      linLogMode: true,
      gravity: 1,
      scalingRatio: 10,
    },
  });
  return graph.mapNodes((id, attrs) => ({ id, x: attrs.x as number, y: attrs.y as number }));
}

// Radial layout for a focused ego network: the root at the centre and one
// ring per hop. Ring 1 is grouped by entity type so like sits with like;
// each later ring is ordered by the angle of the node that reached it, so
// children sit outside their parent and edges stay short and uncrossed.
export function computeRadialLayout(
  rootId: string,
  nodes: { id: string; type: string; name: string }[],
  links: { source: string; target: string }[],
): PositionedNode[] {
  const ids = new Set(nodes.map((n) => n.id));
  if (!ids.has(rootId)) return computeClusterLayout(nodes.map((n) => ({ id: n.id, size: 1 })), links);
  const info = new Map(nodes.map((n) => [n.id, n]));
  const adjacency = new Map<string, string[]>();
  for (const l of links) {
    if (!ids.has(l.source) || !ids.has(l.target)) continue;
    adjacency.set(l.source, [...(adjacency.get(l.source) ?? []), l.target]);
    adjacency.set(l.target, [...(adjacency.get(l.target) ?? []), l.source]);
  }

  const parent = new Map<string, string>();
  const rings: string[][] = [[rootId]];
  const seen = new Set([rootId]);
  while (true) {
    const next: string[] = [];
    for (const id of rings[rings.length - 1]) {
      for (const other of adjacency.get(id) ?? []) {
        if (seen.has(other)) continue;
        seen.add(other);
        parent.set(other, id);
        next.push(other);
      }
    }
    if (!next.length) break;
    rings.push(next);
  }
  // Anything the filters disconnected from the root goes on an outer ring.
  const orphans = nodes.map((n) => n.id).filter((id) => !seen.has(id));
  if (orphans.length) rings.push(orphans);

  const angle = new Map<string, number>([[rootId, 0]]);
  const positions: PositionedNode[] = [{ id: rootId, x: 0, y: 0 }];
  let radius = 0;
  for (let k = 1; k < rings.length; k++) {
    const ring = [...rings[k]];
    if (k === 1) {
      ring.sort((a, b) => {
        const ia = info.get(a)!, ib = info.get(b)!;
        return ia.type.localeCompare(ib.type) || ia.name.localeCompare(ib.name);
      });
    } else {
      ring.sort((a, b) => (angle.get(parent.get(a) ?? "") ?? 0) - (angle.get(parent.get(b) ?? "") ?? 0));
    }
    // Each ring must be far enough out that its nodes are ~60 units apart
    // along the circumference, and always outside the previous ring.
    radius = Math.max(radius + 160, (ring.length * 60) / (2 * Math.PI));
    let angles: number[];
    if (k === 1) {
      angles = ring.map((_, i) => (i / ring.length) * 2 * Math.PI - Math.PI / 2);
    } else {
      // Sit each node at its parent's angle, then sweep once to push
      // neighbours apart to the minimum gap, and re-centre the run on the
      // parents so the push doesn't drift the whole ring one way.
      const want = ring.map((id) => angle.get(parent.get(id) ?? "") ?? 0);
      const gap = Math.min((2 * Math.PI) / ring.length, 60 / radius);
      angles = [...want];
      for (let i = 1; i < angles.length; i++) angles[i] = Math.max(angles[i], angles[i - 1] + gap);
      const drift = (angles.reduce((a, b) => a + b, 0) - want.reduce((a, b) => a + b, 0)) / angles.length;
      angles = angles.map((a) => a - drift);
    }
    ring.forEach((id, i) => {
      const a = angles[i];
      angle.set(id, a);
      positions.push({ id, x: Math.cos(a) * radius, y: Math.sin(a) * radius });
    });
  }
  return positions;
}

// Rows for the People graph, top to bottom: money at the top, the people
// it reaches at the bottom, and the outlets and institutions that sit
// between them in the middle.
export const GRAPH_ROWS = [
  { key: "donors", label: "Donors", types: ["donor", "company", "lobbyist"] },
  { key: "commentators", label: "Commentators", types: ["pundit", "journalist"] },
  { key: "organizations", label: "Organizations", types: ["organization"] },
  { key: "politicians", label: "Politicians", types: ["politician"] },
] as const;

/** Index into GRAPH_ROWS; unknown types sit with the organizations. */
export function graphRowIndexForType(type: string): number {
  const r = GRAPH_ROWS.findIndex((row) => (row.types as readonly string[]).includes(type));
  return r === -1 ? 2 : r;
}

export interface GraphRow {
  key: string;
  label: string;
  /** Graph-space y of the row's centre line. */
  y: number;
  count: number;
}

// Spacing in graph units. The ratio is what matters: when the rows are
// zoomed to fill the canvas height, neighbouring nodes in the longest row
// land ~22px apart — room for a dot and a slanted label — so that row runs
// off to the right and is scrolled.
const ROW_NODE_GAP = 14;
export const ROW_GAP = 110;
const ORDER_SWEEPS = 6;

/**
 * Layered layout: one horizontal row per entity group (GRAPH_ROWS). Each
 * row is ordered by the barycentre of its neighbours in the other rows —
 * a few sweeps of the classic Sugiyama heuristic — so donors sit above the
 * candidates they fund and edges stay short. The longest row sets the
 * width; the others are placed under or over their neighbours, and nodes
 * with no ties are pushed to the right end of their row.
 */
export function computeRowLayout(
  nodes: { id: string; type: string }[],
  links: { source: string; target: string }[],
): { positions: PositionedNode[]; rows: GraphRow[] } {
  const rowOf = new Map<string, number>();
  const members = GRAPH_ROWS.map(() => [] as string[]);
  for (const n of nodes) {
    const idx = graphRowIndexForType(n.type);
    rowOf.set(n.id, idx);
    members[idx].push(n.id);
  }

  const neighbours = new Map<string, string[]>();
  for (const l of links) {
    const a = rowOf.get(l.source);
    const b = rowOf.get(l.target);
    if (a === undefined || b === undefined || a === b) continue;
    for (const [from, to] of [[l.source, l.target], [l.target, l.source]]) {
      const list = neighbours.get(from);
      if (list) list.push(to);
      else neighbours.set(from, [to]);
    }
  }

  // Normalised position within the row, 0..1.
  const pos = new Map<string, number>();
  const assign = (ids: string[]) =>
    ids.forEach((id, i) => pos.set(id, ids.length === 1 ? 0.5 : i / (ids.length - 1)));
  for (const ids of members) {
    ids.sort((a, b) => (neighbours.get(b)?.length ?? 0) - (neighbours.get(a)?.length ?? 0));
    assign(ids);
  }
  const reorder = (ids: string[]) => {
    const key = new Map<string, number>();
    for (const id of ids) {
      const ns = neighbours.get(id);
      // Unconnected nodes go to the far right, in their current order.
      key.set(id, ns ? ns.reduce((sum, n) => sum + pos.get(n)!, 0) / ns.length : 2 + pos.get(id)!);
    }
    ids.sort((a, b) => key.get(a)! - key.get(b)!);
    assign(ids);
  };
  for (let sweep = 0; sweep < ORDER_SWEEPS; sweep++) {
    const order = sweep % 2 === 0 ? members.keys() : [...members.keys()].reverse();
    for (const r of order) reorder(members[r]);
  }

  // x positions. The longest row is laid out evenly at ROW_NODE_GAP; every
  // other node sits at the mean x of its neighbours, so a donor lands right
  // above the candidates it funds. Overlaps are then pushed apart along the
  // row, and nodes with no ties fill in after the last connected one.
  const anchor = members.reduce((best, ids, r) => (ids.length > members[best].length ? r : best), 0);
  const x = new Map<string, number>();
  const width = Math.max(1, members[anchor].length - 1) * ROW_NODE_GAP;
  for (const ids of members) for (const id of ids) x.set(id, pos.get(id)! * width);
  const settle = (ids: string[]) => {
    const connected = ids.filter((id) => neighbours.has(id));
    const desired = new Map(
      connected.map((id) => {
        const ns = neighbours.get(id)!;
        return [id, ns.reduce((sum, n) => sum + x.get(n)!, 0) / ns.length] as const;
      }),
    );
    connected.sort((a, b) => desired.get(a)! - desired.get(b)!);
    // 1-D overlap removal by block merging: runs of nodes that would
    // overlap become a block centred on its members' mean desired x, so
    // each node moves as little as it can and nothing drifts globally.
    const blocks: { ids: string[]; start: number }[] = [];
    for (const id of connected) {
      let block = { ids: [id], start: desired.get(id)! };
      while (blocks.length) {
        const last = blocks[blocks.length - 1];
        if (last.start + last.ids.length * ROW_NODE_GAP <= block.start) break;
        blocks.pop();
        const ids = [...last.ids, ...block.ids];
        const start =
          ids.reduce((sum, m, i) => sum + desired.get(m)! - i * ROW_NODE_GAP, 0) / ids.length;
        block = { ids, start };
      }
      blocks.push(block);
    }
    let prev = -Infinity;
    for (const block of blocks) {
      block.ids.forEach((id, i) => x.set(id, block.start + i * ROW_NODE_GAP));
      prev = block.start + (block.ids.length - 1) * ROW_NODE_GAP;
    }
    for (const id of ids.filter((id) => !neighbours.has(id))) {
      prev = Math.max(prev + ROW_NODE_GAP, connected.length ? prev + ROW_NODE_GAP : 0);
      x.set(id, prev);
    }
    ids.splice(0, ids.length, ...[...ids].sort((a, b) => x.get(a)! - x.get(b)!));
  };
  for (let pass = 0; pass < 2; pass++) {
    members.forEach((ids, r) => {
      if (r !== anchor) settle(ids);
    });
  }

  const used = members.map((ids, r) => ({ ids, r })).filter(({ ids }) => ids.length > 0);
  const positions: PositionedNode[] = [];
  const rows: GraphRow[] = [];
  used.forEach(({ ids, r }, i) => {
    // Sigma's y axis points up, so the first row gets the largest y.
    const y = (used.length - 1 - i) * ROW_GAP;
    rows.push({ key: GRAPH_ROWS[r].key, label: GRAPH_ROWS[r].label, y, count: ids.length });
    for (const id of ids) positions.push({ id, x: x.get(id)!, y });
  });
  return { positions, rows };
}
