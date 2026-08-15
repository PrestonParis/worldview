"use client";

import { Circle } from "react-konva";
import * as turf from "@turf/turf";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type HighlightLayer = Extract<Layer, { type: "highlight" }>;

// A soft radial glow rather than a stroked outline — for calling out a
// country or location on a broadcast graphic without the "selection box"
// look a plain circle gives. Geometry (center + radiusMeters) is identical
// to CircleShape, so it shares the same drag-to-draw gesture and resize
// handles — only the fill/render differs.
export function HighlightShape({ layer, map }: { layer: HighlightLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const centerScreen = map.project(layer.center);
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
      fillRadialGradientStartPoint={{ x: 0, y: 0 }}
      fillRadialGradientEndPoint={{ x: 0, y: 0 }}
      fillRadialGradientStartRadius={0}
      fillRadialGradientEndRadius={radius}
      fillRadialGradientColorStops={[0, `${style.color}ff`, 0.7, `${style.color}ff`, 1, `${style.color}00`]}
      opacity={layer.opacity * style.opacity}
    />
  );
}
