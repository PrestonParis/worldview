"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreGlMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type Map as MapLibreMap,
  type MapGeoJSONFeature,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import {
  addChoroplethLayers,
  addChoroplethSource,
  applyChoropleth,
  type AreaStyle,
} from "@/lib/map/choroplethLayer";

// Same MapLibre worker-URL fix the geography studio needs (see
// src/components/map/MapCanvas.tsx).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const SOURCE_ID = "election-areas";
const FILL_LAYER = "election-areas-fill";
const LINE_LAYER = "election-areas-line";
// Continental US — Alaska/Hawaii/territories fall outside, which is fine for
// a county choropleth (Alaska reports by house district, not county, anyway).
const US_BOUNDS: [number, number, number, number] = [-125, 24, -66.5, 49.5];

export interface AreaDatum extends AreaStyle {
  label: string; // shown on hover
}

export function ResultsMap({
  areas,
  dataUrl = "/data/us-counties.geojson",
  onSelectArea,
  className = "h-[440px]",
}: {
  areas: Record<string, AreaDatum>;
  dataUrl?: string;
  onSelectArea?: (areaId: string | null) => void;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const styledRef = useRef<Set<string>>(new Set());
  const areasRef = useRef(areas);

  const repaint = () => {
    const map = mapRef.current;
    if (!map || !map.getSource(SOURCE_ID)) return;
    const styles = new Map<string, AreaStyle>(
      Object.entries(areasRef.current).map(([id, d]) => [
        id,
        { color: d.color, opacity: d.opacity },
      ]),
    );
    void applyChoropleth(map, SOURCE_ID, styles, styledRef.current).then(() => {
      styledRef.current = new Set(styles.keys());
    });
  };

  // Init once.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreGlMap({
      container: containerRef.current,
      style: STYLE_URL,
      bounds: US_BOUNDS,
      fitBoundsOptions: { padding: 16 },
      attributionControl: { compact: true },
      dragRotate: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (e) => console.error("ResultsMap:", e.error?.message));

    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 8 });

    map.on("load", () => {
      addChoroplethSource(map, SOURCE_ID, dataUrl);
      // Insert below the basemap's first symbol (label) layer so town names
      // stay readable over the fill.
      const firstSymbol = map
        .getStyle()
        .layers.find((l) => l.type === "symbol")?.id;
      addChoroplethLayers(
        map,
        { sourceId: SOURCE_ID, fillLayerId: FILL_LAYER, lineLayerId: LINE_LAYER },
        { beforeId: firstSymbol },
      );
      repaint();
    });

    const featureId = (f: MapGeoJSONFeature) => String(f.id ?? f.properties?.id ?? "");

    map.on("mousemove", FILL_LAYER, (e) => {
      const f = e.features?.[0];
      if (!f) return;
      map.getCanvas().style.cursor = "pointer";
      const datum = areasRef.current[featureId(f)];
      if (datum) {
        popup.setLngLat(e.lngLat).setText(datum.label).addTo(map);
      }
    });
    map.on("mouseleave", FILL_LAYER, () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("click", FILL_LAYER, (e) => {
      const f = e.features?.[0];
      onSelectArea?.(f ? featureId(f) : null);
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      styledRef.current = new Set();
    };
    // dataUrl / onSelectArea are effectively static for a given mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep the latest data in a ref (read by the async `load` handler) and
  // re-paint whenever it changes after mount.
  useEffect(() => {
    areasRef.current = areas;
    repaint();
  }, [areas]);

  return <div ref={containerRef} className={`w-full overflow-hidden rounded-lg border border-slate-200 dark:border-slate-800 ${className}`} />;
}
