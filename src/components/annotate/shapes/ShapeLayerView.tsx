"use client";

import type { Map as MapLibreMap } from "maplibre-gl";
import type { Layer } from "@/lib/types";
import { ArrowShape } from "./ArrowShape";
import { LineShape } from "./LineShape";
import { RectangleShape } from "./RectangleShape";
import { CircleShape } from "./CircleShape";
import { PolygonShape } from "./PolygonShape";
import { FreehandShape } from "./FreehandShape";
import { TextShape } from "./TextShape";
import { IconShape } from "./IconShape";
import { HighlightShape } from "./HighlightShape";
import { CompositionShape } from "./CompositionShape";
import { ImageShape } from "./ImageShape";
import { useAppStore } from "@/lib/store/useAppStore";
import { resolveLayerBindings } from "@/lib/map/liveBindings";

export function ShapeLayerView({ layer, map }: { layer: Layer; map: MapLibreMap }) {
  const liveValues = useAppStore((state) => state.liveValues);
  const resolved = resolveLayerBindings(layer, liveValues);
  switch (resolved.type) {
    case "arrow":
      return <ArrowShape layer={resolved} map={map} />;
    case "line":
      return <LineShape layer={resolved} map={map} />;
    case "rectangle":
      return <RectangleShape layer={resolved} map={map} />;
    case "circle":
      return <CircleShape layer={resolved} map={map} />;
    case "polygon":
      return <PolygonShape layer={resolved} map={map} />;
    case "freehand":
      return <FreehandShape layer={resolved} map={map} />;
    case "text":
      return <TextShape layer={resolved} map={map} />;
    case "icon":
      return <IconShape layer={resolved} map={map} />;
    case "highlight":
      return <HighlightShape layer={resolved} map={map} />;
    case "composition":
      return <CompositionShape layer={resolved} map={map} />;
    case "image":
      return <ImageShape layer={resolved} map={map} />;
    default:
      return null;
  }
}
