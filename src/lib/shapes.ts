import * as turf from "@turf/turf";
import type {
  ArrowStyle,
  DrawableToolId,
  HighlightStyle,
  IconKind,
  IconStyle,
  Layer,
  LayerBase,
  LonLat,
  MultiPointToolId,
  ShapeStyle,
  TextStyle,
} from "@/lib/types";
import type { ToolOptions } from "@/lib/store/toolSlice";

function baseStyle(options: ToolOptions): ShapeStyle {
  return {
    color: options.color,
    thickness: options.thickness,
    dashed: options.dashed,
    opacity: 1,
  };
}

function arrowStyle(options: ToolOptions): ArrowStyle {
  return {
    ...baseStyle(options),
    curved: Boolean(options.curved),
    startArrowhead: Boolean(options.startArrowhead),
    endArrowhead: options.endArrowhead === undefined ? true : Boolean(options.endArrowhead),
  };
}

function textStyle(options: ToolOptions): TextStyle {
  return {
    color: options.color,
    fontFamily: typeof options.fontFamily === "string" ? options.fontFamily : "sans",
    fontSize: typeof options.fontSize === "number" ? options.fontSize : 28,
    bold: Boolean(options.bold),
    italic: Boolean(options.italic),
    outline: Boolean(options.outline),
    shadow: Boolean(options.shadow),
    rotation: typeof options.rotation === "number" ? options.rotation : 0,
    opacity: 1,
  };
}

function iconStyle(options: ToolOptions): IconStyle {
  return {
    color: options.color,
    size: typeof options.size === "number" ? options.size : 28,
    opacity: 1,
  };
}

function highlightStyle(options: ToolOptions): HighlightStyle {
  return {
    color: options.color,
    opacity: typeof options.opacity === "number" ? options.opacity : 0.55,
  };
}

const TYPE_LABEL: Record<DrawableToolId | MultiPointToolId | "text" | "icon", string> = {
  arrow: "Arrow",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  highlight: "Highlight",
  polygon: "Polygon",
  freehand: "Freehand",
  text: "Text",
  icon: "Icon",
};

function makeBase(
  type: DrawableToolId | MultiPointToolId | "text" | "icon",
  order: number,
  nameSuffix: number
): LayerBase {
  return {
    id: crypto.randomUUID(),
    name: `${TYPE_LABEL[type]} ${nameSuffix}`,
    visible: true,
    locked: false,
    opacity: 1,
    order,
    parentGroupId: null,
  };
}

interface CreateShapeLayerArgs {
  type: DrawableToolId;
  // The raw two-point drag gesture (mousedown point, mouseup point). Every
  // drawable tool in this phase uses the same click-drag interaction, so
  // they share this input shape — circle just interprets it as
  // center+radius instead of storing both points directly.
  points: [LonLat, LonLat];
  options: ToolOptions;
  order: number;
  nameSuffix: number;
}

export function createShapeLayer({
  type,
  points,
  options,
  order,
  nameSuffix,
}: CreateShapeLayerArgs): Layer {
  const base = makeBase(type, order, nameSuffix);

  switch (type) {
    case "arrow":
      return { ...base, type: "arrow", points, style: arrowStyle(options) };
    case "line":
      return { ...base, type: "line", points, style: baseStyle(options) };
    case "rectangle":
      return { ...base, type: "rectangle", points, style: baseStyle(options) };
    case "circle": {
      const [center, edge] = points;
      const radiusMeters = turf.distance(center, edge, { units: "meters" });
      return {
        ...base,
        type: "circle",
        center,
        radiusMeters: Math.max(radiusMeters, 1),
        style: baseStyle(options),
      };
    }
    case "highlight": {
      const [center, edge] = points;
      const radiusMeters = turf.distance(center, edge, { units: "meters" });
      return {
        ...base,
        type: "highlight",
        center,
        radiusMeters: Math.max(radiusMeters, 1),
        style: highlightStyle(options),
      };
    }
  }
}

export function createIconLayer(
  point: LonLat,
  icon: IconKind,
  options: ToolOptions,
  order: number,
  nameSuffix: number
): Layer {
  const base = makeBase("icon", order, nameSuffix);
  return { ...base, type: "icon", point, icon, style: iconStyle(options) };
}

export function createMultiPointLayer(
  type: MultiPointToolId,
  points: LonLat[],
  options: ToolOptions,
  order: number,
  nameSuffix: number
): Layer {
  const base = makeBase(type, order, nameSuffix);
  return { ...base, type, points, style: baseStyle(options) };
}

export function createTextLayer(
  point: LonLat,
  text: string,
  options: ToolOptions,
  order: number,
  nameSuffix: number
): Layer {
  const base = makeBase("text", order, nameSuffix);
  return { ...base, type: "text", point, text, style: textStyle(options) };
}
