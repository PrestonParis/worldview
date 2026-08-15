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

export function ShapeLayerView({ layer, map }: { layer: Layer; map: MapLibreMap }) {
  switch (layer.type) {
    case "arrow":
      return <ArrowShape layer={layer} map={map} />;
    case "line":
      return <LineShape layer={layer} map={map} />;
    case "rectangle":
      return <RectangleShape layer={layer} map={map} />;
    case "circle":
      return <CircleShape layer={layer} map={map} />;
    case "polygon":
      return <PolygonShape layer={layer} map={map} />;
    case "freehand":
      return <FreehandShape layer={layer} map={map} />;
    case "text":
      return <TextShape layer={layer} map={map} />;
    case "icon":
      return <IconShape layer={layer} map={map} />;
    case "highlight":
      return <HighlightShape layer={layer} map={map} />;
    default:
      return null;
  }
}
