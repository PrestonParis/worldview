import { z } from "zod";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import type { Layer, MapViewState } from "@/lib/types";

export const CURRENT_MAP_PROJECT_VERSION = 3;

const lonLatSchema = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
const colorSchema = z.string().min(1).max(64);
const layerBase = {
  id: z.string().min(1).max(200), name: z.string().min(1).max(200),
  visible: z.boolean(), locked: z.boolean(), opacity: z.number().min(0).max(1),
  order: z.number().int().min(0), parentGroupId: z.string().max(200).nullable(),
  bindings: z.object({
    text: z.string().min(1).max(100).optional(),
    color: z.string().min(1).max(100).optional(),
  }).optional(),
};
const shapeStyleSchema = z.object({
  color: colorSchema, thickness: z.number().min(0).max(100), dashed: z.boolean(), opacity: z.number().min(0).max(1),
});
const arrowStyleSchema = shapeStyleSchema.extend({ curved: z.boolean(), startArrowhead: z.boolean(), endArrowhead: z.boolean() });
const textStyleSchema = z.object({
  color: colorSchema, fontFamily: z.string().min(1).max(100), fontSize: z.number().min(1).max(500),
  bold: z.boolean(), italic: z.boolean(), outline: z.boolean(), shadow: z.boolean(),
  rotation: z.number().min(-360).max(360), opacity: z.number().min(0).max(1),
});
const iconStyleSchema = z.object({ color: colorSchema, size: z.number().min(1).max(500), opacity: z.number().min(0).max(1) });
const highlightStyleSchema = z.object({ color: colorSchema, opacity: z.number().min(0).max(1) });

const dataLayerSchema = z.object({
  ...layerBase,
  type: z.literal("data"),
  data: z.object({
    source: z.object({
      providerId: z.enum(["worldview", "ais-ships", "usgs-earthquakes", "gdacs", "nasa-firms", "natural-earth-disputes", "marine-regions-eez"]),
      datasetId: z.string().min(1).max(200),
      query: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    }),
    visualization: z.enum(["circle", "heatmap", "line", "fill", "choropleth"]),
    refreshMode: z.enum(["manual", "interval", "frozen"]),
    refreshSeconds: z.number().int().min(0).max(86_400),
    timeRange: z.object({ from: z.string().max(40).nullable(), to: z.string().max(40).nullable() }),
    filters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])),
    style: z.object({
      color: colorSchema, opacity: z.number().min(0).max(1), radius: z.number().min(1).max(100),
      strokeColor: colorSchema, strokeWidth: z.number().min(0).max(20),
      colorStops: z.array(z.object({ value: z.number().finite(), color: colorSchema })).max(20).optional(),
    }),
    labels: z.object({ visible: z.boolean(), field: z.string().max(100).nullable(), minZoom: z.number().min(0).max(24) }),
    legend: z.object({ visible: z.boolean(), title: z.string().max(200) }),
    metadata: z.object({ attribution: z.string().max(500), sourceUrl: z.string().max(2000), freshnessLabel: z.string().max(200) }),
    frozenData: z.custom<GeoJSON.FeatureCollection>((value) =>
      typeof value === "object" && value !== null &&
      (value as { type?: unknown }).type === "FeatureCollection" &&
      Array.isArray((value as { features?: unknown }).features) &&
      ((value as { features: unknown[] }).features.length <= 50_000),
    ).optional(),
  }),
});

export const layerSchema = z.discriminatedUnion("type", [
  z.object({ ...layerBase, type: z.literal("map") }),
  z.object({ ...layerBase, type: z.literal("group") }),
  dataLayerSchema,
  z.object({
    ...layerBase,
    type: z.literal("composition"),
    role: z.enum(["title", "subtitle", "caption", "source", "timestamp"]),
    position: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    width: z.number().min(0.05).max(1),
    text: z.string().max(10_000),
    backgroundColor: colorSchema,
    backgroundOpacity: z.number().min(0).max(1),
    padding: z.number().min(0).max(100),
    style: textStyleSchema,
  }),
  z.object({
    ...layerBase,
    type: z.literal("image"),
    position: z.tuple([z.number().min(0).max(1), z.number().min(0).max(1)]),
    width: z.number().min(0.01).max(1),
    height: z.number().min(0.01).max(1),
    dataUrl: z.string().startsWith("data:image/").max(6_000_000),
  }),
  z.object({ ...layerBase, type: z.literal("arrow"), points: z.tuple([lonLatSchema, lonLatSchema]), style: arrowStyleSchema }),
  z.object({ ...layerBase, type: z.literal("line"), points: z.tuple([lonLatSchema, lonLatSchema]), style: shapeStyleSchema }),
  z.object({ ...layerBase, type: z.literal("rectangle"), points: z.tuple([lonLatSchema, lonLatSchema]), style: shapeStyleSchema }),
  z.object({ ...layerBase, type: z.literal("circle"), center: lonLatSchema, radiusMeters: z.number().positive(), style: shapeStyleSchema }),
  z.object({ ...layerBase, type: z.literal("polygon"), points: z.array(lonLatSchema).min(3).max(20_000), style: shapeStyleSchema }),
  z.object({ ...layerBase, type: z.literal("freehand"), points: z.array(lonLatSchema).min(2).max(20_000), style: shapeStyleSchema }),
  z.object({ ...layerBase, type: z.literal("text"), point: lonLatSchema, text: z.string().max(10_000), style: textStyleSchema }),
  z.object({ ...layerBase, type: z.literal("icon"), point: lonLatSchema, icon: z.enum(["flag", "pin", "star"]), style: iconStyleSchema }),
  z.object({ ...layerBase, type: z.literal("highlight"), center: lonLatSchema, radiusMeters: z.number().positive(), style: highlightStyleSchema }),
]);

export const mapViewSchema = z.object({
  center: lonLatSchema, zoom: z.number().min(0).max(24), bearing: z.number().finite(), pitch: z.number().min(0).max(85),
  style: z.enum(["satellite", "political", "terrain", "minimalist", "dark", "grayscale"]),
  showLabels: z.boolean(), showNeighbors: z.boolean(),
  featureToggles: z.object({
    seas: z.boolean(), mountains: z.boolean(), rivers: z.boolean(), lakes: z.boolean(),
    deserts: z.boolean(), islands: z.boolean(), forests: z.boolean(), cities: z.boolean(),
  }),
  selectedCountryId: z.string().max(8).nullable(),
});

const liveValuesSchema = z.record(z.string().min(1).max(100), z.string().max(10_000))
  .refine((values) => Object.keys(values).length <= 100, "Too many live values");

export const mapProjectSchema = z.object({
  id: z.uuid().optional(),
  documentVersion: z.literal(CURRENT_MAP_PROJECT_VERSION).default(CURRENT_MAP_PROJECT_VERSION),
  name: z.string().min(1, "Name is required").max(200),
  mapView: mapViewSchema,
  layers: z.array(layerSchema).min(1).max(2000, "Too many layers"),
  liveValues: liveValuesSchema.default({}),
});
export const mapProjectPatchSchema = mapProjectSchema.partial().extend({
  documentVersion: z.literal(CURRENT_MAP_PROJECT_VERSION).optional(),
  liveValues: liveValuesSchema.optional(),
});
export type MapProjectInput = z.input<typeof mapProjectSchema>;

export interface MapProject {
  id: string; ownerId: string; documentVersion: number; name: string;
  mapView: MapViewState; layers: Layer[]; liveValues: Record<string, string>;
  isPublished: boolean; shareToken: string;
  createdAt: string; updatedAt: string;
}

export function migrateMapProjectDocument(input: {
  documentVersion?: number; mapView: unknown; layers: unknown;
}): { documentVersion: typeof CURRENT_MAP_PROJECT_VERSION; mapView: MapViewState; layers: Layer[] } {
  if ((input.documentVersion ?? 1) > CURRENT_MAP_PROJECT_VERSION) {
    throw new Error(`This graphic uses unsupported project version ${input.documentVersion}.`);
  }
  const defaults = createDefaultMapView();
  const partial = typeof input.mapView === "object" && input.mapView !== null
    ? input.mapView as Partial<MapViewState>
    : {};
  const candidateView = {
    ...defaults,
    ...partial,
    featureToggles: { ...defaults.featureToggles, ...(partial.featureToggles ?? {}) },
  };
  const candidateLayers = Array.isArray(input.layers) && input.layers.length ? input.layers : createDefaultLayers();
  return {
    documentVersion: CURRENT_MAP_PROJECT_VERSION,
    mapView: mapViewSchema.parse(candidateView) as MapViewState,
    layers: z.array(layerSchema).min(1).max(2000).parse(candidateLayers) as Layer[],
  };
}
