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
    iterations: nodes.length > 500 ? 300 : 600,
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
