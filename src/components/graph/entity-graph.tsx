"use client";

import { useMemo, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { useIsDark } from "@/lib/theme";
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
import { publicEntityPath } from "@/lib/people/public";

const nodeTypes = { entity: EntityNode };

export interface EntityGraphEdgeStyle {
  stroke?: string;
  strokeWidth?: number;
  dashed?: boolean;
}

export function EntityGraph({
  entities,
  edges,
  positions,
  interactive = true,
  edgeStyles,
}: {
  entities: Entity[];
  edges: Edge[];
  positions: PositionedNode[];
  /** Set false for small homepage-style previews: no zoom controls, no panning/zooming/dragging. */
  interactive?: boolean;
  /** Per-edge visual overrides, keyed by edge id. Absent → the default grey edge. */
  edgeStyles?: Record<string, EntityGraphEdgeStyle>;
}) {
  const router = useRouter();

  // ReactFlow's colorMode follows the page theme, which is only known in the
  // browser — it renders "light" on the server and may render "dark" on the
  // client's very first paint, producing a hydration mismatch. useSyncExternalStore is the sanctioned
  // way to let a value differ between the server and client render passes:
  // the snapshot never changes after mount (no subscription needed), it
  // just reports false for the server render and true once actually
  // running in the browser.
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const dark = useIsDark();

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
      edges.map((edge) => {
        const s = edgeStyles?.[edge.id];
        const stroke = s?.stroke ?? "#94A3B8";
        return {
          id: edge.id,
          source: edge.sourceEntityId,
          target: edge.targetEntityId,
          label: edge.label,
          labelStyle: { fontSize: 11, fill: "#64748B" },
          labelBgStyle: { fill: "#FFFFFF", fillOpacity: 0.9 },
          style: {
            stroke,
            ...(s?.strokeWidth ? { strokeWidth: s.strokeWidth } : {}),
            ...(s?.dashed ? { strokeDasharray: "5 4" } : {}),
          },
          markerEnd: { type: MarkerType.ArrowClosed, color: stroke },
        };
      }),
    [edges, edgeStyles],
  );

  if (!mounted) {
    return <div className="h-full w-full animate-pulse bg-slate-50 dark:bg-slate-900" />;
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={flowEdges}
        nodeTypes={nodeTypes}
        fitView
        // The graph can have 1,000+ nodes — fitting them all on first paint
        // zooms out so far that no label is readable. Floor the initial fit
        // at 100% zoom so it opens on a legible neighborhood instead; pan
        // and zoom out from there to see more. Skipped for the small
        // homepage preview, which is meant to show its whole (tiny) subset.
        fitViewOptions={interactive ? { minZoom: 1 } : undefined}
        minZoom={0.1}
        colorMode={dark ? "dark" : "light"}
        // The graph can have 1,000+ nodes/edges — without this, React Flow
        // keeps every one of them in the DOM at all times regardless of
        // whether it's on-screen, which is what makes pan/zoom feel laggy.
        onlyRenderVisibleElements
        onNodeClick={(_, node) => {
          const entity = entities.find((item) => item.id === node.id);
          if (entity) router.push(publicEntityPath(entity));
        }}
        panOnDrag={interactive}
        panOnScroll={interactive}
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
