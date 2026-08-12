"use client";

import { Circle } from "react-konva";
import * as turf from "@turf/turf";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type CircleLayer = Extract<Layer, { type: "circle" }>;

export function CircleShape({ layer, map }: { layer: CircleLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const centerScreen = map.project(layer.center);
  // Radius is stored in real-world meters, not screen pixels, so a "500km
  // strike radius" circle reads as 500km at any zoom level — project a
  // second point due east at that distance and measure the screen gap to
  // get the current pixel radius.
  const edgeGeo = turf.destination(layer.center, layer.radiusMeters, 90, {
    units: "meters",
  }).geometry.coordinates as [number, number];
  const edgeScreen = map.project(edgeGeo);
  const radius = Math.hypot(edgeScreen.x - centerScreen.x, edgeScreen.y - centerScreen.y);
  const { style } = layer;

  return (
    <Circle
      id={`layer:${layer.id}`}
      x={centerScreen.x}
      y={centerScreen.y}
      radius={radius}
      stroke={style.color}
      strokeWidth={style.thickness}
      dash={style.dashed ? [style.thickness * 2.5, style.thickness * 2] : undefined}
      opacity={layer.opacity * style.opacity}
    />
  );
}
