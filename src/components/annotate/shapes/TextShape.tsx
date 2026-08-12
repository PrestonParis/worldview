"use client";

import { Text } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";
import { resolveFontFamily } from "@/lib/fonts";

type TextLayer = Extract<Layer, { type: "text" }>;

export function TextShape({ layer, map }: { layer: TextLayer; map: MapLibreMap }) {
  if (!layer.visible || !layer.text) return null;

  const p = map.project(layer.point);
  const { style } = layer;
  const fontStyle =
    style.bold && style.italic
      ? "italic bold"
      : style.bold
        ? "bold"
        : style.italic
          ? "italic"
          : "normal";

  return (
    <Text
      id={`layer:${layer.id}`}
      x={p.x}
      y={p.y}
      text={layer.text}
      fontFamily={resolveFontFamily(style.fontFamily)}
      fontSize={style.fontSize}
      fontStyle={fontStyle}
      fill={style.color}
      rotation={style.rotation}
      opacity={layer.opacity * style.opacity}
      stroke={style.outline ? "#000000" : undefined}
      strokeWidth={style.outline ? Math.max(2, style.fontSize / 12) : undefined}
      fillAfterStrokeEnabled={style.outline}
      shadowColor={style.shadow ? "#000000" : undefined}
      shadowBlur={style.shadow ? 8 : undefined}
      shadowOffsetX={style.shadow ? 2 : undefined}
      shadowOffsetY={style.shadow ? 2 : undefined}
      shadowOpacity={style.shadow ? 0.6 : undefined}
    />
  );
}
