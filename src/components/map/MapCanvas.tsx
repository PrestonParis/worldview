"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreGlMap,
  NavigationControl,
  setWorkerUrl,
  type Map as MapLibreMap,
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { useAppStore } from "@/lib/store/useAppStore";
import { getCountryBbox } from "@/lib/countries";
import { useMapInstance } from "@/lib/map/MapContext";
import { resolveStyle, styleUsesGrayscaleFilter } from "@/lib/map/styles";
import {
  applyFeatureToggles,
  applyLabelVisibility,
  applySelectionState,
  ensureCountryLayers,
} from "@/lib/map/countryLayers";

// MapLibre auto-detects its worker script URL from its own bundled
// import.meta.url, which only works if that's a real http(s) URL — once
// Next.js (webpack or Turbopack) bundles it, that check fails and it
// silently falls back to loading no worker at all, so tiles never
// render. Pointing it at the static copy (see scripts/copy-maplibre-
// worker.mjs) sidesteps the broken auto-detection.
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

// Re-applies our custom sources/layers + current selection/label/feature
// state. Needed because MapLibre's setStyle() wipes any manually-added
// layers, so every style swap (including the very first load) has to
// rebuild them from the store's current state.
function syncMapState(map: MapLibreMap) {
  ensureCountryLayers(map);
  const { mapView } = useAppStore.getState();
  applyLabelVisibility(map, mapView.showLabels);
  applyFeatureToggles(map, mapView.featureToggles);
  void applySelectionState(map, mapView.selectedCountryId, mapView.showNeighbors);
}

export function MapCanvas({ interactive = true }: { interactive?: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);

  const style = useAppStore((s) => s.mapView.style);
  const showLabels = useAppStore((s) => s.mapView.showLabels);
  const showNeighbors = useAppStore((s) => s.mapView.showNeighbors);
  const featureToggles = useAppStore((s) => s.mapView.featureToggles);
  const selectedCountryId = useAppStore((s) => s.mapView.selectedCountryId);
  const setCenter = useAppStore((s) => s.setCenter);
  const setZoom = useAppStore((s) => s.setZoom);
  const { setMap } = useMapInstance();

  // Initialize the map once.
  useEffect(() => {
    if (!containerRef.current) return;
    let cancelled = false;

    (async () => {
      const initialStyle = await resolveStyle(useAppStore.getState().mapView.style);
      if (cancelled || !containerRef.current) return;

      const { center, zoom } = useAppStore.getState().mapView;
      const map = new MapLibreGlMap({
        container: containerRef.current,
        style: initialStyle as StyleSpecification | string,
        center,
        zoom,
        attributionControl: { compact: true },
        interactive,
        // Needed to read the canvas back out for image export (see
        // src/lib/map/exportImage.ts) — WebGL's drawing buffer is cleared
        // after compositing by default, so getCanvas() isn't reliably
        // readable without this. Small memory/perf cost, accepted for it.
        canvasContextAttributes: { preserveDrawingBuffer: true },
      });
      mapRef.current = map;
      setMap(map);

      if (interactive) map.addControl(new NavigationControl({ showCompass: false }), "bottom-right");
      map.on("error", (e) => console.error("MapLibre error:", e.error?.message));
      map.on("style.load", () => syncMapState(map));
      map.on("moveend", () => {
        if (!interactive) return;
        const c = map.getCenter();
        setCenter([c.lng, c.lat]);
        setZoom(map.getZoom());
      });
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      setMap(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-time init
  }, []);

  // Style changes.
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    let cancelled = false;
    (async () => {
      const next = await resolveStyle(style);
      if (!cancelled) map.setStyle(next as StyleSpecification | string);
    })();
    return () => {
      cancelled = true;
    };
  }, [style]);

  // Grayscale is applied as a CSS filter on the map container rather than
  // per-layer paint rewrites, since it needs to work uniformly across
  // every basemap layer (roads, water, labels, etc.) at once.
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.style.filter = styleUsesGrayscaleFilter(style)
        ? "grayscale(1)"
        : "";
    }
  }, [style]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyLabelVisibility(map, showLabels);
  }, [showLabels]);

  useEffect(() => {
    const map = mapRef.current;
    if (map?.isStyleLoaded()) applyFeatureToggles(map, featureToggles);
  }, [featureToggles]);

  // Selection changes: fly/fit to the country and (re)apply highlight state.
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    void applySelectionState(map, selectedCountryId, showNeighbors);
  }, [selectedCountryId, showNeighbors]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !selectedCountryId) return;
    let cancelled = false;
    (async () => {
      const bbox = await getCountryBbox(selectedCountryId);
      if (cancelled || !bbox) return;
      const [minX, minY, maxX, maxY] = bbox;
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        { padding: 80, duration: 900, maxZoom: 9 }
      );
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedCountryId]);

  // maplibre-gl.css ships unlayered, so its `.maplibregl-map { position:
  // relative }` always wins the cascade over Tailwind's layered `.absolute`
  // utility regardless of import order — collapsing this container to 0
  // height (no in-flow content, since the canvas itself is positioned
  // absolutely). Inline styles beat every stylesheet layer, so set
  // position/inset here instead of via className.
  return (
    <div
      ref={containerRef}
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
