"use client";

import { Line } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type FreehandLayer = Extract<Layer, { type: "freehand" }>;

export function FreehandShape({ layer, map }: { layer: FreehandLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const screenPoints = layer.points.flatMap((geo) => {
    const p = map.project(geo);
    return [p.x, p.y];
  });
  const { style } = layer;

  return (
    <Line
      id={`layer:${layer.id}`}
      points={screenPoints}
      stroke={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      lineCap="round"
      lineJoin="round"
      tension={0.3}
      // A thin freehand stroke is hard to click precisely — widen the hit
      // area without changing how it looks.
      hitStrokeWidth={Math.max(style.thickness, 14)}
      opacity={layer.opacity * style.opacity}
    />
  );
}
