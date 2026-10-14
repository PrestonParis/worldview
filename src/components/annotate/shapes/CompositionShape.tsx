"use client";

import { Group, Rect, Text } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";
import { resolveFontFamily } from "@/lib/fonts";

type CompositionLayer = Extract<Layer, { type: "composition" }>;

export function CompositionShape({ layer, map }: { layer: CompositionLayer; map: MapLibreMap }) {
  if (!layer.visible || !layer.text) return null;
  const container = map.getContainer();
  const x = layer.position[0] * container.clientWidth;
  const y = layer.position[1] * container.clientHeight;
  const width = layer.width * container.clientWidth;
  const style = layer.style;
  const fontStyle = style.bold && style.italic ? "italic bold" : style.bold ? "bold" : style.italic ? "italic" : "normal";
  const estimatedLines = Math.max(1, Math.ceil((layer.text.length * style.fontSize * 0.55) / Math.max(1, width - layer.padding * 2)));
  const height = estimatedLines * style.fontSize * 1.25 + layer.padding * 2;
  return (
    <Group id={`layer:${layer.id}`} x={x} y={y} opacity={layer.opacity} rotation={style.rotation}>
      <Rect width={width} height={height} fill={layer.backgroundColor} opacity={layer.backgroundOpacity} cornerRadius={4} />
      <Text
        width={width - layer.padding * 2} x={layer.padding} y={layer.padding}
        text={layer.text} fontFamily={resolveFontFamily(style.fontFamily)} fontSize={style.fontSize}
        fontStyle={fontStyle} fill={style.color} opacity={style.opacity} lineHeight={1.15}
        shadowColor={style.shadow ? "#000000" : undefined} shadowBlur={style.shadow ? 8 : 0}
        shadowOpacity={style.shadow ? 0.7 : 0}
      />
    </Group>
  );
}
