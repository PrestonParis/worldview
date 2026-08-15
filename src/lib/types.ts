export type MapStyleId =
  | "satellite"
  | "political"
  | "terrain"
  | "minimalist"
  | "dark"
  | "grayscale";

export type GeoFeatureKey =
  | "seas"
  | "mountains"
  | "rivers"
  | "lakes"
  | "deserts"
  | "islands"
  | "forests"
  | "cities";

export interface MapViewState {
  center: [number, number];
  zoom: number;
  bearing: number;
  pitch: number;
  style: MapStyleId;
  showLabels: boolean;
  showNeighbors: boolean;
  featureToggles: Record<GeoFeatureKey, boolean>;
  selectedCountryId: string | null;
}

export type ToolId =
  | "select"
  | "arrow"
  | "line"
  | "rectangle"
  | "circle"
  | "polygon"
  | "freehand"
  | "text"
  | "icon"
  | "highlight";

// Tools handled by the click-drag-to-two-points gesture (mousedown at
// point A, mouseup at point B). "highlight" shares circle's exact
// center+edge interpretation of the two points, just rendered as a glow
// instead of a stroked outline.
export type DrawableToolId = "arrow" | "line" | "rectangle" | "circle" | "highlight";

// Tools handled by an arbitrary-length point list: polygon (click each
// vertex, finish with a double-click/Enter) and freehand (continuous drag,
// points accumulate while the mouse is down).
export type MultiPointToolId = "polygon" | "freehand";

// "icon" is a single-click placement, like "text" — no drag gesture.
export type IconKind = "flag" | "pin" | "star";

// [longitude, latitude] — every shape stores its geometry this way, never
// in screen pixels, so it stays pinned to the earth through pan/zoom. See
// AnnotationCanvas.tsx for the projection loop.
export type LonLat = [number, number];

export interface ShapeStyle {
  color: string;
  thickness: number;
  dashed: boolean;
  opacity: number;
}

export interface ArrowStyle extends ShapeStyle {
  curved: boolean;
  startArrowhead: boolean;
  endArrowhead: boolean;
}

export interface TextStyle {
  color: string;
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  outline: boolean;
  shadow: boolean;
  rotation: number; // degrees
  opacity: number;
}

export interface IconStyle {
  color: string;
  size: number;
  opacity: number;
}

// Deliberately no thickness/dashed — a highlight is a filled glow, not a
// stroked shape, so it gets its own smaller style shape rather than
// reusing ShapeStyle and leaving those fields meaningless.
export interface HighlightStyle {
  color: string;
  opacity: number;
}

export interface LayerBase {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
  opacity: number;
  order: number;
  parentGroupId: string | null;
}

export type Layer =
  | (LayerBase & { type: "map" })
  | (LayerBase & { type: "group" })
  | (LayerBase & { type: "arrow"; points: [LonLat, LonLat]; style: ArrowStyle })
  | (LayerBase & { type: "line"; points: [LonLat, LonLat]; style: ShapeStyle })
  | (LayerBase & { type: "rectangle"; points: [LonLat, LonLat]; style: ShapeStyle })
  | (LayerBase & { type: "circle"; center: LonLat; radiusMeters: number; style: ShapeStyle })
  | (LayerBase & { type: "polygon"; points: LonLat[]; style: ShapeStyle })
  | (LayerBase & { type: "freehand"; points: LonLat[]; style: ShapeStyle })
  | (LayerBase & { type: "text"; point: LonLat; text: string; style: TextStyle })
  | (LayerBase & { type: "icon"; point: LonLat; icon: IconKind; style: IconStyle })
  | (LayerBase & { type: "highlight"; center: LonLat; radiusMeters: number; style: HighlightStyle });

export type ShapeLayer = Extract<Layer, { type: DrawableToolId }>;
export type AnnotationLayer = Extract<
  Layer,
  { type: DrawableToolId | MultiPointToolId | "text" | "icon" }
>;
