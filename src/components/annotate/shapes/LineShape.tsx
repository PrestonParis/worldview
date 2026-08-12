"use client";

import { Line } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type LineLayer = Extract<Layer, { type: "line" }>;

export function LineShape({ layer, map }: { layer: LineLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const [p1, p2] = layer.points;
  const start = map.project(p1);
  const end = map.project(p2);
  const { style } = layer;

  return (
    <Line
      id={`layer:${layer.id}`}
      points={[start.x, start.y, end.x, end.y]}
      stroke={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      opacity={layer.opacity * style.opacity}
    />
  );
}
