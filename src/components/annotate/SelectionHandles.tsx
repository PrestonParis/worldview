"use client";

import { Circle } from "react-konva";
import * as turf from "@turf/turf";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

const HANDLE_RADIUS = 6;
const HANDLE_FILL = "#f8fafc";
const HANDLE_STROKE = "#3b82f6";

// Renders small draggable control points for the selected shape — the
// endpoints for arrow/line/rectangle/polygon (a drag naturally IS the
// resize/reshape gesture for a points-based shape), or center+edge for
// circle (index 0 moves it, index 1 changes the radius). Freehand and text
// don't get handles: freehand can have hundreds of points (whole-shape
// move via body-drag only), and text doesn't have a resize gesture (size
// is a tool-options field). Hit-tested by AnnotationCanvas via
// `handle:${layerId}:${index}` ids, same pattern as the shape bodies
// themselves (`layer:${layerId}`).
export function SelectionHandles({ layer, map }: { layer: Layer; map: MapLibreMap }) {
  if (
    layer.type === "arrow" ||
    layer.type === "line" ||
    layer.type === "rectangle" ||
    layer.type === "polygon"
  ) {
    return (
      <>
        {layer.points.map((geo, i) => {
          const p = map.project(geo);
          return (
            <Circle
              key={i}
              id={`handle:${layer.id}:${i}`}
              x={p.x}
              y={p.y}
              radius={HANDLE_RADIUS}
              fill={HANDLE_FILL}
              stroke={HANDLE_STROKE}
              strokeWidth={2}
            />
          );
        })}
      </>
    );
  }

  if (layer.type === "circle") {
    const center = map.project(layer.center);
    const edgeGeo = turf.destination(layer.center, layer.radiusMeters, 90, {
      units: "meters",
    }).geometry.coordinates as [number, number];
    const edge = map.project(edgeGeo);
    return (
      <>
        <Circle
          id={`handle:${layer.id}:0`}
          x={center.x}
          y={center.y}
          radius={HANDLE_RADIUS}
          fill={HANDLE_FILL}
          stroke={HANDLE_STROKE}
          strokeWidth={2}
        />
        <Circle
          id={`handle:${layer.id}:1`}
          x={edge.x}
          y={edge.y}
          radius={HANDLE_RADIUS}
          fill={HANDLE_FILL}
          stroke={HANDLE_STROKE}
          strokeWidth={2}
        />
      </>
    );
  }

  return null;
}
