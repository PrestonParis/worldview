"use client";

import { Line } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";
import { hexToRgba } from "@/lib/color";

type PolygonLayer = Extract<Layer, { type: "polygon" }>;

export function PolygonShape({ layer, map }: { layer: PolygonLayer; map: MapLibreMap }) {
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
      closed
      fill={hexToRgba(style.color, 0.18)}
      stroke={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      opacity={layer.opacity * style.opacity}
    />
  );
}
