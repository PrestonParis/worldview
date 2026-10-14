"use client";

import { useEffect, useState } from "react";
import { Image as KonvaImage } from "react-konva";
import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";

type ImageLayer = Extract<Layer, { type: "image" }>;

export function ImageShape({ layer, map }: { layer: ImageLayer; map: MapLibreMap }) {
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  useEffect(() => {
    const next = new Image();
    next.onload = () => setImage(next);
    next.src = layer.dataUrl;
    return () => { next.onload = null; };
  }, [layer.dataUrl]);
  if (!layer.visible || !image) return null;
  const container = map.getContainer();
  return <KonvaImage id={`layer:${layer.id}`} image={image} x={layer.position[0] * container.clientWidth} y={layer.position[1] * container.clientHeight} width={layer.width * container.clientWidth} height={layer.height * container.clientHeight} opacity={layer.opacity} />;
}
