import type { Map as MapLibreMap } from "maplibre-gl";
import { countryId, getNeighborIds, loadCountries } from "@/lib/countries";
import type { GeoFeatureKey } from "@/lib/types";

export const COUNTRIES_SOURCE_ID = "app-countries";
export const COUNTRIES_FILL_LAYER = "app-countries-fill";
export const COUNTRIES_LINE_LAYER = "app-countries-border";

// Our own border/highlight layers are re-added on top of every basemap
// style (including raster satellite, which has no vector boundary layer of
// its own) so borders, selection highlighting, and the neighbor toggle look
// and behave identically regardless of which of the 6 styles is active.
export function ensureCountryLayers(map: MapLibreMap) {
  if (!map.getSource(COUNTRIES_SOURCE_ID)) {
    map.addSource(COUNTRIES_SOURCE_ID, {
      type: "geojson",
      data: "/data/countries.geojson",
      promoteId: "ISO3166-1-Alpha-3",
    });
  }

  if (!map.getLayer(COUNTRIES_FILL_LAYER)) {
    map.addLayer({
      id: COUNTRIES_FILL_LAYER,
      type: "fill",
      source: COUNTRIES_SOURCE_ID,
      paint: {
        "fill-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#3b82f6",
          ["boolean", ["feature-state", "neighbor"], false],
          "#94a3b8",
          "rgba(0,0,0,0)",
        ],
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.2,
          ["boolean", ["feature-state", "neighbor"], false],
          0.12,
          0,
        ],
      },
    });
  }

  if (!map.getLayer(COUNTRIES_LINE_LAYER)) {
    map.addLayer({
      id: COUNTRIES_LINE_LAYER,
      type: "line",
      source: COUNTRIES_SOURCE_ID,
      paint: {
        "line-color": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          "#f8fafc",
          "#64748b",
        ],
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          2.5,
          1,
        ],
        "line-opacity": 0.9,
      },
    });
  }
}

// setFeatureState throws if called before the GeoJSON source has finished
// loading/indexing its promoted ids, which can happen right after a style
// swap (the source is re-added on "style.load" but loads asynchronously).
// isSourceLoaded() itself throws (rather than returning false) if the
// source doesn't exist yet/anymore — e.g. mid-way through a style swap that
// tears down and re-adds "app-countries" — so this has to guard against
// both "not loaded yet" and "doesn't exist right now" states.
function isCountrySourceReady(map: MapLibreMap, sourceId: string): boolean {
  try {
    return Boolean(map.getSource(sourceId)) && map.isSourceLoaded(sourceId);
  } catch {
    return false;
  }
}

function waitForSourceLoaded(map: MapLibreMap, sourceId: string): Promise<void> {
  if (isCountrySourceReady(map, sourceId)) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => {
      if (isCountrySourceReady(map, sourceId)) {
        map.off("sourcedata", handler);
        resolve();
      }
    };
    map.on("sourcedata", handler);
  });
}

// isSourceLoaded() being true only means "no tiles currently queued" — it
// doesn't guarantee the specific tile containing a given feature's
// geometry has been parsed yet, which is what setFeatureState actually
// needs (MapLibre indexes feature state per-tile as tiles load). Right
// after a style swap this is still racy even with the wait above, so these
// calls are wrapped defensively: a miss here just means the highlight
// doesn't apply this pass, which is a minor cosmetic gap, not worth
// crashing the app over.
function safeSetFeatureState(
  map: MapLibreMap,
  id: string,
  state: { selected?: boolean; neighbor?: boolean }
) {
  try {
    map.setFeatureState({ source: COUNTRIES_SOURCE_ID, id }, state);
  } catch {
    // feature not in a loaded tile yet — skip
  }
}

function safeRemoveFeatureState(map: MapLibreMap, id: string) {
  try {
    map.removeFeatureState({ source: COUNTRIES_SOURCE_ID, id });
  } catch {
    // feature not in a loaded tile yet — nothing to remove
  }
}

export async function applySelectionState(
  map: MapLibreMap,
  selectedId: string | null,
  showNeighbors: boolean
) {
  await waitForSourceLoaded(map, COUNTRIES_SOURCE_ID);
  const { features } = await loadCountries();
  for (const feature of features) {
    safeRemoveFeatureState(map, countryId(feature));
  }

  if (!selectedId) return;

  safeSetFeatureState(map, selectedId, { selected: true });

  if (showNeighbors) {
    const neighbors = await getNeighborIds(selectedId);
    for (const neighborId of neighbors) {
      safeSetFeatureState(map, neighborId, { neighbor: true });
    }
  }
}

export function applyLabelVisibility(map: MapLibreMap, show: boolean) {
  const style = map.getStyle();
  if (!style) return;
  for (const layer of style.layers) {
    if (layer.type === "symbol") {
      map.setLayoutProperty(layer.id, "visibility", show ? "visible" : "none");
    }
  }
}

// Best-effort mapping onto real OpenMapTiles-schema layer ids present in
// the OpenFreeMap styles. Layers that don't exist in the active style are
// silently skipped. "lakes" and "islands" have no distinct layer in this
// basemap (lakes share the general "water" fill, islands aren't a separate
// feature class) — their toggles are wired up but currently no-ops until a
// dedicated Natural Earth physical-features layer is added in a later
// phase, rather than faking an effect by reusing an unrelated layer.
const FEATURE_LAYER_MAP: Record<GeoFeatureKey, string[]> = {
  seas: ["water", "water_name_point_label", "water_name_line_label"],
  rivers: ["waterway_river", "waterway_other", "waterway_tunnel", "waterway_line_label"],
  lakes: [],
  mountains: ["natural_earth", "app-hillshade"],
  deserts: ["landcover_sand"],
  islands: [],
  forests: ["landcover_wood"],
  cities: ["label_city", "label_city_capital", "label_town", "label_village", "poi_r20", "poi_r7"],
};

export function applyFeatureToggles(
  map: MapLibreMap,
  toggles: Record<GeoFeatureKey, boolean>
) {
  const style = map.getStyle();
  if (!style) return;
  const existingIds = new Set(style.layers.map((l) => l.id));

  for (const key of Object.keys(FEATURE_LAYER_MAP) as GeoFeatureKey[]) {
    const visible = toggles[key];
    for (const layerId of FEATURE_LAYER_MAP[key]) {
      if (existingIds.has(layerId)) {
        map.setLayoutProperty(layerId, "visibility", visible ? "visible" : "none");
      }
    }
  }
}
