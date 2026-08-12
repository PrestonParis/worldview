import * as turf from "@turf/turf";
import type {
  ArrowStyle,
  DrawableToolId,
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

const TYPE_LABEL: Record<DrawableToolId | MultiPointToolId | "text", string> = {
  arrow: "Arrow",
  line: "Line",
  rectangle: "Rectangle",
  circle: "Circle",
  polygon: "Polygon",
  freehand: "Freehand",
  text: "Text",
};

function makeBase(
  type: DrawableToolId | MultiPointToolId | "text",
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
  }
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
