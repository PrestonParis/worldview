import type { Map as MapLibreMap, ExpressionSpecification } from "maplibre-gl";

// A reusable GeoJSON choropleth: one polygon source whose features carry a
// native `id` (a FIPS/GEOID), a fill layer painted from per-feature
// `feature-state`, and a hairline outline. The defensive
// source-readiness / setFeatureState guards are the same ones
// src/lib/map/countryLayers.ts needs and for the same reason — MapLibre
// throws if you touch feature state before the source's tiles have
// indexed, which races every style (re)load.

export interface ChoroplethIds {
  sourceId: string;
  fillLayerId: string;
  lineLayerId: string;
}

export interface AreaStyle {
  color: string;
  opacity?: number; // 0..1, default 1
}

export function addChoroplethSource(
  map: MapLibreMap,
  sourceId: string,
  dataUrl: string,
) {
  if (map.getSource(sourceId)) return;
  map.addSource(sourceId, { type: "geojson", data: dataUrl });
}

export function addChoroplethLayers(
  map: MapLibreMap,
  ids: ChoroplethIds,
  { beforeId }: { beforeId?: string } = {},
) {
  const fillColor: ExpressionSpecification = [
    "coalesce",
    ["feature-state", "color"],
    "rgba(0,0,0,0)",
  ];
  const fillOpacity: ExpressionSpecification = [
    "coalesce",
    ["feature-state", "opacity"],
    0,
  ];

  if (!map.getLayer(ids.fillLayerId)) {
    map.addLayer(
      {
        id: ids.fillLayerId,
        type: "fill",
        source: ids.sourceId,
        paint: { "fill-color": fillColor, "fill-opacity": fillOpacity },
      },
      beforeId,
    );
  }
  if (!map.getLayer(ids.lineLayerId)) {
    map.addLayer(
      {
        id: ids.lineLayerId,
        type: "line",
        source: ids.sourceId,
        paint: {
          "line-color": "#64748b",
          "line-width": 0.3,
          "line-opacity": 0.5,
        },
      },
      beforeId,
    );
  }
}

// isSourceLoaded() itself throws if the source doesn't exist yet/anymore
// (e.g. mid style-swap), so guard both "missing" and "not loaded".
function sourceReady(map: MapLibreMap, sourceId: string): boolean {
  try {
    return Boolean(map.getSource(sourceId)) && map.isSourceLoaded(sourceId);
  } catch {
    return false;
  }
}

export function waitForSourceLoaded(
  map: MapLibreMap,
  sourceId: string,
): Promise<void> {
  if (sourceReady(map, sourceId)) return Promise.resolve();
  return new Promise((resolve) => {
    const handler = () => {
      if (sourceReady(map, sourceId)) {
        map.off("sourcedata", handler);
        resolve();
      }
    };
    map.on("sourcedata", handler);
  });
}

function safeSetFeatureState(
  map: MapLibreMap,
  sourceId: string,
  id: string,
  state: AreaStyle,
) {
  try {
    map.setFeatureState({ source: sourceId, id }, state);
  } catch {
    // feature not in a loaded tile yet — skip, it's cosmetic
  }
}

function safeRemoveFeatureState(map: MapLibreMap, sourceId: string, id: string) {
  try {
    map.removeFeatureState({ source: sourceId, id });
  } catch {
    // nothing to remove
  }
}

// Replace the whole choropleth colouring: clear every previously-styled
// feature, then apply the new map. `previous` lets the caller avoid a full
// scan when only a few areas change.
export async function applyChoropleth(
  map: MapLibreMap,
  sourceId: string,
  styles: Map<string, AreaStyle>,
  previous?: Iterable<string>,
) {
  await waitForSourceLoaded(map, sourceId);
  for (const id of previous ?? []) safeRemoveFeatureState(map, sourceId, id);
  for (const [id, style] of styles) {
    safeSetFeatureState(map, sourceId, id, {
      color: style.color,
      opacity: style.opacity ?? 1,
    });
  }
}
