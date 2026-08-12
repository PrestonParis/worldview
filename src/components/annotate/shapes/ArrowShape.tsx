"use client";

import { Arrow } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type ArrowLayer = Extract<Layer, { type: "arrow" }>;

export function ArrowShape({ layer, map }: { layer: ArrowLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const [p1, p2] = layer.points;
  const start = map.project(p1);
  const end = map.project(p2);
  const { style } = layer;

  // A curved arrow is a 3-point spline through one offset control point,
  // bowed perpendicular to the line at 20% of its length — simple, not a
  // general bezier editor, but reads as "curved" without hand-rolled path
  // math.
  const points = style.curved
    ? (() => {
        const dx = end.x - start.x;
        const dy = end.y - start.y;
        const dist = Math.hypot(dx, dy) || 1;
        const offset = dist * 0.2;
        const midX = (start.x + end.x) / 2 - (dy / dist) * offset;
        const midY = (start.y + end.y) / 2 + (dx / dist) * offset;
        return [start.x, start.y, midX, midY, end.x, end.y];
      })()
    : [start.x, start.y, end.x, end.y];

  return (
    <Arrow
      id={`layer:${layer.id}`}
      points={points}
      tension={style.curved ? 0.5 : 0}
      stroke={style.color}
      fill={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      pointerLength={9 + style.thickness}
      pointerWidth={9 + style.thickness}
      pointerAtBeginning={style.startArrowhead}
      pointerAtEnding={style.endArrowhead}
      opacity={layer.opacity * style.opacity}
    />
  );
}
