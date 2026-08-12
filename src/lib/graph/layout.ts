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
