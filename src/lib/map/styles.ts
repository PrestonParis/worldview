import type { StyleSpecification } from "maplibre-gl";
import type { MapStyleId } from "@/lib/types";

const OFM_BASE = "https://tiles.openfreemap.org/styles";

// OpenFreeMap: free, no API key, OpenMapTiles-schema vector styles.
const VECTOR_STYLE_URLS: Partial<Record<MapStyleId, string>> = {
  political: `${OFM_BASE}/liberty`,
  minimalist: `${OFM_BASE}/positron`,
  dark: `${OFM_BASE}/dark`,
  // "grayscale" reuses positron's geometry/labels; color removal happens
  // via a CSS filter on the map container (see styleUsesGrayscaleFilter).
  grayscale: `${OFM_BASE}/positron`,
};

const SATELLITE_STYLE: StyleSpecification = {
  version: 8,
  name: "Satellite",
  sources: {
    esriSatellite: {
      type: "raster",
      tiles: [
        "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      ],
      tileSize: 256,
      attribution: "Esri, Maxar, Earthstar Geographics",
      maxzoom: 19,
    },
  },
  layers: [
    { id: "background", type: "background", paint: { "background-color": "#000" } },
    { id: "esri-satellite", type: "raster", source: "esriSatellite" },
  ],
};

// Free public terrain-RGB (Terrarium encoding), formerly Mapzen, now
// mirrored on AWS Open Data. No API key required.
const TERRAIN_DEM_SOURCE = {
  type: "raster-dem" as const,
  tiles: ["https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"],
  tileSize: 256,
  encoding: "terrarium" as const,
  maxzoom: 15,
  attribution: "Terrain tiles: Mapzen / AWS Open Data",
};

export const HILLSHADE_LAYER_ID = "app-hillshade";

async function buildTerrainStyle(): Promise<StyleSpecification> {
  const res = await fetch(`${OFM_BASE}/positron`);
  const style = (await res.json()) as StyleSpecification;

  style.sources = {
    ...style.sources,
    terrainDem: TERRAIN_DEM_SOURCE,
  };

  const insertBefore = style.layers.findIndex((l) => l.id === "water");
  style.layers.splice(Math.max(insertBefore, 0), 0, {
    id: HILLSHADE_LAYER_ID,
    type: "hillshade",
    source: "terrainDem",
    paint: { "hillshade-exaggeration": 0.7 },
  });

  return style;
}

export async function resolveStyle(
  styleId: MapStyleId
): Promise<string | StyleSpecification> {
  if (styleId === "satellite") return SATELLITE_STYLE;
  if (styleId === "terrain") return buildTerrainStyle();
  return VECTOR_STYLE_URLS[styleId] ?? VECTOR_STYLE_URLS.minimalist!;
}

export function styleUsesGrayscaleFilter(styleId: MapStyleId): boolean {
  return styleId === "grayscale";
}
