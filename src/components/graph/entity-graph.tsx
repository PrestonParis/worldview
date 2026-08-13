"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MarkerType,
  type Node,
  type Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EntityNode, type EntityNodeData } from "./entity-node";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

const nodeTypes = { entity: EntityNode };

export function EntityGraph({
  entities,
  edges,
  positions,
  interactive = true,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
  /** Set false for small homepage-style previews: no zoom controls, no panning/zooming/dragging. */
  interactive?: boolean;
}) {
  const router = useRouter();

  const nodes = useMemo<Node<EntityNodeData>[]>(() => {
    const positionById = new Map(positions.map((p) => [p.id, p]));
    return entities.map((e) => ({
      id: e.id,
      type: "entity",
      position: positionById.get(e.id) ?? { x: 0, y: 0 },
      data: { label: e.name, type: e.type },
    }));
  }, [entities, positions]);

  const flowEdges = useMemo<FlowEdge[]>(
    () =>
      edges.map((edge) => ({
        id: edge.id,
        source: edge.sourceEntityId,
        target: edge.targetEntityId,
        label: edge.label,
        labelStyle: { fontSize: 11, fill: "#64748B" },
        labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.9 },
        style: { stroke: "#94A3B8" },
        markerEnd: { type: MarkerType.ArrowClosed, color: "#94A3B8" },
      })),
    [edges],
  );

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        minZoom={0.1}
        colorMode="system"
        onNodeClick={(_, node) => router.push(`/data/entities/${node.id}`)}
        panOnDrag={interactive}
        zoomOnScroll={interactive}
        zoomOnPinch={interactive}
        zoomOnDoubleClick={interactive}
        nodesDraggable={interactive}
      >
        <Background gap={24} color="#E2E8F0" />
        {interactive ? <Controls showInteractive={false} /> : null}
      </ReactFlow>
    </div>
  );
}
