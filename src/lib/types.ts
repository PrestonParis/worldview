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

export type DataProviderId =
  | "worldview"
  | "ais-ships"
  | "usgs-earthquakes"
  | "gdacs"
  | "nasa-firms"
  | "natural-earth-disputes"
  | "marine-regions-eez";

export type DataRefreshMode = "manual" | "interval" | "frozen";
export type DataVisualizationType = "circle" | "heatmap" | "line" | "fill" | "choropleth";

export interface DataColorStop {
  value: number;
  color: string;
}

export interface DataLayerStyle {
  color: string;
  opacity: number;
  radius: number;
  strokeColor: string;
  strokeWidth: number;
  colorStops?: DataColorStop[];
}

export interface DataLayerSource {
  providerId: DataProviderId;
  datasetId: string;
  query: Record<string, string | number | boolean>;
}

export interface DataLayerMetadata {
  attribution: string;
  sourceUrl: string;
  freshnessLabel: string;
}

export interface DataLayerConfig {
  source: DataLayerSource;
  visualization: DataVisualizationType;
  refreshMode: DataRefreshMode;
  refreshSeconds: number;
  timeRange: { from: string | null; to: string | null };
  filters: Record<string, string | number | boolean>;
  style: DataLayerStyle;
  labels: { visible: boolean; field: string | null; minZoom: number };
  legend: { visible: boolean; title: string };
  metadata: DataLayerMetadata;
  frozenData?: GeoJSON.FeatureCollection;
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
  // Optional project-scoped live-value bindings. Static values remain on the
  // layer and are used whenever a key is absent, so disabling a feed never
  // destroys the authored design.
  bindings?: { text?: string; color?: string };
}

export type Layer =
  | (LayerBase & { type: "map" })
  | (LayerBase & { type: "group" })
  | (LayerBase & { type: "data"; data: DataLayerConfig })
  | (LayerBase & {
      type: "composition";
      role: "title" | "subtitle" | "caption" | "source" | "timestamp";
      position: [number, number];
      width: number;
      text: string;
      backgroundColor: string;
      backgroundOpacity: number;
      padding: number;
      style: TextStyle;
    })
  | (LayerBase & {
      type: "image";
      position: [number, number];
      width: number;
      height: number;
      dataUrl: string;
    })
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
