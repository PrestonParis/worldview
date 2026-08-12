"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  MarkerType,
  type Node,
  type Edge as FlowEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { EntityNode, type EntityNodeData } from "./entity-node";
import { entityColors } from "@/lib/entity-colors";
import type { Entity } from "@/lib/validation/entity";
import type { Edge } from "@/lib/validation/edge";
import type { PositionedNode } from "@/lib/graph/layout";

const nodeTypes = { entity: EntityNode };

export function EntityGraph({
  entities,
  edges,
  positions,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
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
        onNodeClick={(_, node) => router.push(`/data/entities/${node.id}`)}
      >
        <Background gap={24} color="#E2E8F0" />
        <Controls showInteractive={false} />
        <MiniMap
          pannable
          zoomable
          nodeColor={(n) => entityColors[(n.data as EntityNodeData).type]?.border ?? "#94A3B8"}
          maskColor="rgba(241, 245, 249, 0.6)"
        />
      </ReactFlow>
    </div>
  );
}
