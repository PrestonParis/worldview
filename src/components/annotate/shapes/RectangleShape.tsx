"use client";

import { Rect } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type RectangleLayer = Extract<Layer, { type: "rectangle" }>;

export function RectangleShape({
  layer,
  map,
}: {
  layer: RectangleLayer;
  map: MapLibreMap;
}) {
  if (!layer.visible) return null;

  const [p1, p2] = layer.points;
  const a = map.project(p1);
  const b = map.project(p2);
  const { style } = layer;

  // The two stored corners can be in any drag order (dragged up-left,
  // down-right, etc.) — normalize to Konva's top-left + width/height.
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const width = Math.abs(b.x - a.x);
  const height = Math.abs(b.y - a.y);

  return (
    <Rect
      id={`layer:${layer.id}`}
      x={x}
      y={y}
      width={width}
      height={height}
      stroke={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      opacity={layer.opacity * style.opacity}
    />
  );
}
