"use client";

import { useEffect, useState } from "react";
import { Popup, type Map as MapLibreMap, type MapLayerMouseEvent } from "maplibre-gl";
import { useAppStore } from "@/lib/store/useAppStore";
import { dataLayerEndpoint } from "@/lib/map/dataLayers";
import type { Layer } from "@/lib/types";
import { useMapInstance } from "@/lib/map/MapContext";

type DataLayer = Extract<Layer, { type: "data" }>;
type ProviderResponse = { data?: GeoJSON.FeatureCollection; error?: string };

function ids(id: string) {
  return {
    source: `app-data-source-${id}`,
    visual: `app-data-visual-${id}`,
    label: `app-data-label-${id}`,
  };
}

function removeRuntime(map: MapLibreMap, layer: DataLayer) {
  const layerIds = ids(layer.id);
  for (const id of [layerIds.label, layerIds.visual]) {
    if (map.getLayer(id)) map.removeLayer(id);
  }
  if (map.getSource(layerIds.source)) map.removeSource(layerIds.source);
}

function addRuntime(map: MapLibreMap, layer: DataLayer, data: GeoJSON.FeatureCollection) {
  if (!map.isStyleLoaded()) return;
  removeRuntime(map, layer);
  const runtime = ids(layer.id);
  map.addSource(runtime.source, { type: "geojson", data });
  const style = layer.data.style;
  const visibility = layer.visible ? "visible" : "none";
  const common = { visibility } as const;
  const visualization = layer.data.visualization;

  if (visualization === "line") {
    map.addLayer({
      id: runtime.visual, type: "line", source: runtime.source, layout: common,
      paint: { "line-color": style.color, "line-opacity": style.opacity * layer.opacity, "line-width": style.strokeWidth || 2 },
    });
  } else if (visualization === "fill" || visualization === "choropleth") {
    const values = visualization === "choropleth"
      ? data.features.map((feature) => Number(feature.properties?.value)).filter(Number.isFinite)
      : [];
    const minimum = values.length ? Math.min(...values) : 0;
    const maximum = values.length ? Math.max(...values) : 1;
    const midpoint = minimum + (maximum - minimum) / 2;
    const color = visualization === "choropleth"
      ? ["case", ["==", ["get", "value"], null], "rgba(0,0,0,0)",
          ["interpolate", ["linear"], ["to-number", ["get", "value"]], minimum, "#dbeafe", midpoint, "#60a5fa", maximum === minimum ? minimum + 1 : maximum, style.color]] as never
      : style.color;
    map.addLayer({
      id: runtime.visual, type: "fill", source: runtime.source, layout: common,
      paint: {
        "fill-color": color,
        "fill-opacity": style.opacity * layer.opacity,
        "fill-outline-color": style.strokeColor,
      },
      filter: visualization === "choropleth" ? ["!=", ["get", "value"], null] : undefined,
    });
  } else if (visualization === "heatmap") {
    map.addLayer({
      id: runtime.visual, type: "heatmap", source: runtime.source, layout: common,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["coalesce", ["to-number", ["get", "frp"]], 1], 0, 0.1, 50, 1],
        "heatmap-intensity": 1,
        "heatmap-radius": Math.max(5, style.radius * 3),
        "heatmap-opacity": style.opacity * layer.opacity,
        "heatmap-color": ["interpolate", ["linear"], ["heatmap-density"], 0, "rgba(0,0,0,0)", 0.3, "#facc15", 0.6, "#f97316", 1, style.color],
      },
    });
  } else {
    map.addLayer({
      id: runtime.visual, type: "circle", source: runtime.source, layout: common,
      paint: {
        "circle-color": style.color,
        "circle-opacity": style.opacity * layer.opacity,
        "circle-radius": ["interpolate", ["linear"], ["coalesce", ["to-number", ["get", "mag"]], ["to-number", ["get", "frp"]], 1], 0, Math.max(2, style.radius / 2), 8, style.radius * 2],
        "circle-stroke-color": style.strokeColor,
        "circle-stroke-width": style.strokeWidth,
      },
    });
  }

  if (layer.data.labels.visible && layer.data.labels.field) {
    map.addLayer({
      id: runtime.label, type: "symbol", source: runtime.source, minzoom: layer.data.labels.minZoom,
      layout: { ...common, "text-field": ["to-string", ["get", layer.data.labels.field]], "text-size": 11, "text-offset": [0, 1.2] },
      paint: { "text-color": "#f8fafc", "text-halo-color": "#0a0a0a", "text-halo-width": 1 },
    });
  }
}

function DataLayerRuntime({ map, layer, styleEpoch }: { map: MapLibreMap; layer: DataLayer; styleEpoch: number }) {
  const [data, setData] = useState<GeoJSON.FeatureCollection | null>(null);
  const [viewportEpoch, setViewportEpoch] = useState(0);
  const setStatus = useAppStore((s) => s.setDataLayerStatus);
  let endpoint = dataLayerEndpoint(layer);
  if (layer.data.source.providerId === "ais-ships") {
    const bounds = map.getBounds();
    const separator = endpoint.includes("?") ? "&" : "?";
    const bbox = [bounds.getWest(), bounds.getSouth(), bounds.getEast(), bounds.getNorth()].join(",");
    endpoint = `${endpoint}${separator}bbox=${encodeURIComponent(bbox)}`;
  }
  // The state value intentionally participates in rendering: moveend bumps it
  // so the viewport-derived endpoint above is recomputed even when the saved
  // layer configuration itself has not changed.
  void viewportEpoch;
  const renderData = layer.data.refreshMode === "frozen" ? layer.data.frozenData ?? data : data;

  useEffect(() => {
    if (layer.data.source.providerId !== "ais-ships") return;
    const refreshViewport = () => setViewportEpoch((value) => value + 1);
    map.on("moveend", refreshViewport);
    return () => { map.off("moveend", refreshViewport); };
  }, [layer.data.source.providerId, map]);

  useEffect(() => {
    if (layer.data.refreshMode === "frozen" && layer.data.frozenData) {
      return;
    }
    let cancelled = false;
    const load = async () => {
      setStatus(layer.id, { state: "loading", lastUpdated: null, count: 0, error: null });
      try {
        const response = await fetch(endpoint, { cache: "no-store" });
        const body = await response.json() as ProviderResponse;
        if (!response.ok || !body.data) throw new Error(body.error ?? `Data request failed (${response.status}).`);
        if (!cancelled) {
          setData(body.data);
          setStatus(layer.id, { state: "ready", lastUpdated: new Date().toISOString(), count: body.data.features.length, error: null });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        console.error(`${layer.name}:`, message);
        if (!cancelled) setStatus(layer.id, { state: "error", lastUpdated: null, count: 0, error: message });
      }
    };
    void load();
    const seconds = layer.data.refreshMode === "interval" ? layer.data.refreshSeconds : 0;
    const timer = seconds > 0 ? window.setInterval(load, seconds * 1000) : null;
    return () => { cancelled = true; if (timer !== null) window.clearInterval(timer); };
  }, [endpoint, layer.data.frozenData, layer.data.refreshMode, layer.data.refreshSeconds, layer.id, layer.name, setStatus]);

  useEffect(() => {
    if (!renderData || !map.isStyleLoaded()) return;
    addRuntime(map, layer, renderData);
    return () => {
      if (map.isStyleLoaded()) removeRuntime(map, layer);
    };
  }, [renderData, layer, map, styleEpoch]);

  useEffect(() => {
    const visualId = ids(layer.id).visual;
    if (!renderData || !map.getLayer(visualId)) return;
    const popup = new Popup({ closeButton: true, closeOnClick: true, offset: 10 });
    const move = () => { map.getCanvas().style.cursor = "pointer"; };
    const leave = () => { map.getCanvas().style.cursor = ""; };
    const click = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      if (!feature) return;
      const properties = feature.properties ?? {};
      const title = String(properties.name ?? properties.title ?? properties.geoName ?? properties.place ?? layer.name);
      const details = [
        properties.speedKnots !== undefined ? `${Number(properties.speedKnots).toFixed(1)} kn` : null,
        properties.mag !== undefined ? `Magnitude ${properties.mag}` : null,
        properties.destination ? `Destination: ${properties.destination}` : null,
        properties.value !== undefined && properties.value !== null ? `Value: ${properties.value}` : null,
        properties.observedAt ? `Observed: ${new Date(String(properties.observedAt)).toLocaleString()}` : null,
      ].filter(Boolean);
      const element = document.createElement("div");
      const heading = document.createElement("strong");
      heading.textContent = title;
      element.appendChild(heading);
      for (const detail of details) {
        const row = document.createElement("div");
        row.textContent = String(detail);
        element.appendChild(row);
      }
      popup.setLngLat(event.lngLat).setDOMContent(element).addTo(map);
    };
    map.on("mouseenter", visualId, move);
    map.on("mouseleave", visualId, leave);
    map.on("click", visualId, click);
    return () => {
      popup.remove();
      map.off("mouseenter", visualId, move);
      map.off("mouseleave", visualId, leave);
      map.off("click", visualId, click);
    };
  }, [layer.id, layer.name, map, renderData, styleEpoch]);

  return null;
}

export function DataLayerRenderer() {
  const { map } = useMapInstance();
  const layers = useAppStore((s) => s.layers);
  const dataLayers = layers
    .filter((layer): layer is DataLayer => layer.type === "data")
    .sort((a, b) => a.order - b.order);
  const [styleEpoch, setStyleEpoch] = useState(0);
  useEffect(() => {
    const onStyle = () => setStyleEpoch((value) => value + 1);
    if (!map) return;
    map.on("style.load", onStyle);
    return () => { map.off("style.load", onStyle); };
  }, [map]);
  if (!map) return null;
  return dataLayers.map((layer) => <DataLayerRuntime key={layer.id} map={map} layer={layer} styleEpoch={styleEpoch} />);
}
