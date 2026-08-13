import {
  forceSimulation,
  forceLink,
  forceManyBody,
  forceCenter,
  forceCollide,
  type SimulationNodeDatum,
  type SimulationLinkDatum,
} from "d3-force";
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
