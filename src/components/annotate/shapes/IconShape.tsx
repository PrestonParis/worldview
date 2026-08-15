"use client";

import { Circle, Line, Star } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type IconLayer = Extract<Layer, { type: "icon" }>;

// Hand-drawn with Konva primitives rather than imported SVG path data —
// three broadcast-graphic-friendly markers: a map pin, a flag, and a star.
// Every leaf shape in a multi-node icon shares the same `id` so
// AnnotationCanvas's hit-testing (which reads `.id()` off whichever node
// the click actually landed on) resolves to the layer regardless of which
// part of the icon was clicked.
export function IconShape({ layer, map }: { layer: IconLayer; map: MapLibreMap }) {
  if (!layer.visible) return null;

  const p = map.project(layer.point);
  const { style } = layer;
  const hitId = `layer:${layer.id}`;
  const size = style.size;
  const opacity = layer.opacity * style.opacity;

  if (layer.icon === "star") {
    return (
      <Star
        id={hitId}
        x={p.x}
        y={p.y}
        numPoints={5}
        innerRadius={size * 0.24}
        outerRadius={size * 0.5}
        fill={style.color}
        opacity={opacity}
      />
    );
  }

  if (layer.icon === "flag") {
    const top = p.y - size;
    return (
      <>
        <Line
          id={hitId}
          points={[p.x, p.y, p.x, top]}
          stroke={style.color}
          strokeWidth={Math.max(2, size * 0.08)}
          opacity={opacity}
        />
        <Line
          id={hitId}
          points={[p.x, top, p.x + size * 0.65, top + size * 0.18, p.x, top + size * 0.36]}
          closed
          fill={style.color}
          opacity={opacity}
        />
      </>
    );
  }

  // "pin": teardrop head + point, tip anchored exactly at the marked
  // location (the way `point` is projected above).
  const headRadius = size * 0.32;
  const headCenterY = p.y - size * 0.7;
  return (
    <>
      <Line
        id={hitId}
        points={[
          p.x - headRadius * 0.8,
          headCenterY + headRadius * 0.55,
          p.x + headRadius * 0.8,
          headCenterY + headRadius * 0.55,
          p.x,
          p.y,
        ]}
        closed
        fill={style.color}
        opacity={opacity}
      />
      <Circle
        id={hitId}
        x={p.x}
        y={headCenterY}
        radius={headRadius}
        fill={style.color}
        opacity={opacity}
      />
    </>
  );
}
