"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreGlMap,
  NavigationControl,
  Popup,
  setWorkerUrl,
  type GeoJSONSource,
  type LngLatBoundsLike,
  type Map as MapLibreMap,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

// Same MapLibre worker-URL fix the geography studio needs (see
// src/components/map/MapCanvas.tsx).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const STATES_URL = "/data/us-states.geojson";
const US_BOUNDS: LngLatBoundsLike = [-125, 24, -66.5, 49.5];
// Alaska's Aleutians cross the antimeridian, so its geometric bbox spans the
// globe; frame the mainland instead.
const FIXED_BOUNDS: Record<string, LngLatBoundsLike> = { "02": [-170, 51, -129, 71.5] };
const NO_DATA = "#cbd5e1";

export interface MapArea {
  id: string;
  name: string;
  value: number | null; // focus category share, percent
}

export interface MapCity extends MapArea {
  lat: number;
  lon: number;
  population: number;
}

type StatesCollection = GeoJSON.FeatureCollection<GeoJSON.Geometry, { GEOID: string; NAME: string }>;

// Position of a value within the visible range, 0..1.
function rampPosition(value: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
}

// Opacity ramp of one hue, light (low share) to dark (high share).
export function rampOpacity(value: number, min: number, max: number): number {
  return 0.12 + 0.78 * rampPosition(value, min, max);
}

export function valueExtent(values: Array<number | null>): [number, number] {
  const present = values.filter((value): value is number => value !== null);
  return present.length ? [Math.min(...present), Math.max(...present)] : [0, 0];
}

function geometryBounds(geometry: GeoJSON.Geometry): LngLatBoundsLike {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  const visit = (coords: unknown): void => {
    if (typeof (coords as number[])[0] === "number") {
      const [x, y] = coords as number[];
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      minY = Math.min(minY, y);
      maxY = Math.max(maxY, y);
      return;
    }
    (coords as unknown[]).forEach(visit);
  };
  if ("coordinates" in geometry) visit(geometry.coordinates);
  return [minX, minY, maxX, maxY];
}

export function DemographicsMap({
  states,
  cities,
  selectedStateId,
  selectedCityId,
  color,
  formatValue,
  onSelectState,
  onSelectCity,
}: {
  states: MapArea[];
  cities: MapCity[];
  selectedStateId: string | null;
  selectedCityId: string | null;
  color: string;
  formatValue: (value: number | null) => string;
  onSelectState: (id: string) => void;
  onSelectCity: (id: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geometryRef = useRef<StatesCollection | null>(null);
  const readyRef = useRef(false);
  // Latest props for the map's event handlers, which are bound once.
  const latest = useRef({ states, cities, selectedStateId, selectedCityId, color, formatValue, onSelectState, onSelectCity });

  const paint = () => {
    const map = mapRef.current;
    const geometry = geometryRef.current;
    if (!map || !geometry || !readyRef.current) return;
    const { states, cities, selectedStateId, selectedCityId, color } = latest.current;
    const byId = new Map(states.map((area) => [area.id, area]));
    const focusingState = selectedStateId !== null;

    const stateExtent = valueExtent(states.map((area) => area.value));
    (map.getSource("demo-states") as GeoJSONSource | undefined)?.setData({
      ...geometry,
      features: geometry.features.map((feature) => {
        const id = feature.properties.GEOID;
        const value = byId.get(id)?.value ?? null;
        const selected = id === selectedStateId;
        return {
          ...feature,
          properties: {
            ...feature.properties,
            selected,
            color: value === null ? NO_DATA : color,
            // Inside a state the cities carry the data; the state itself
            // becomes a quiet backdrop.
            opacity: focusingState
              ? selected ? 0.08 : 0.03
              : value === null ? 0.25 : rampOpacity(value, ...stateExtent),
          },
        };
      }),
    });

    const cityExtent = valueExtent(cities.map((city) => city.value));
    const largest = Math.max(1, ...cities.map((city) => city.population));
    (map.getSource("demo-cities") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: cities.map((city) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: [city.lon, city.lat] },
        properties: {
          id: city.id,
          selected: city.id === selectedCityId,
          color: city.value === null ? NO_DATA : color,
          // Circles sit on a pale backdrop, so their ramp starts darker.
          opacity: city.value === null ? 0.6 : 0.35 + 0.65 * rampPosition(city.value, ...cityExtent),
          radius: 4 + 14 * Math.sqrt(city.population / largest),
        },
      })),
    });
  };

  const frame = () => {
    const map = mapRef.current;
    const geometry = geometryRef.current;
    if (!map || !geometry) return;
    const { selectedStateId, selectedCityId, cities } = latest.current;
    const city = selectedCityId ? cities.find((item) => item.id === selectedCityId) : null;
    if (city) {
      map.flyTo({ center: [city.lon, city.lat], zoom: Math.max(map.getZoom(), 8.5), duration: 900 });
      return;
    }
    if (selectedStateId) {
      const feature = geometry.features.find((item) => item.properties.GEOID === selectedStateId);
      if (feature) {
        map.fitBounds(FIXED_BOUNDS[selectedStateId] ?? geometryBounds(feature.geometry), {
          padding: 32,
          duration: 900,
        });
      }
      return;
    }
    map.fitBounds(US_BOUNDS, { padding: 16, duration: 900 });
  };

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
    map.on("error", (event) => console.error("DemographicsMap:", event.error?.message));
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    const geometryLoad = fetch(STATES_URL).then((res) => res.json() as Promise<StatesCollection>);

    map.on("load", async () => {
      geometryRef.current = await geometryLoad;
      const firstSymbol = map.getStyle().layers.find((layer) => layer.type === "symbol")?.id;
      map.addSource("demo-states", { type: "geojson", data: geometryRef.current });
      map.addSource("demo-cities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer(
        {
          id: "demo-states-fill",
          type: "fill",
          source: "demo-states",
          paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
        },
        firstSymbol,
      );
      map.addLayer(
        {
          id: "demo-states-line",
          type: "line",
          source: "demo-states",
          paint: {
            "line-color": ["case", ["get", "selected"], "#0f172a", "#64748b"],
            "line-width": ["case", ["get", "selected"], 2, 0.6],
            "line-opacity": ["case", ["get", "selected"], 0.9, 0.55],
          },
        },
        firstSymbol,
      );
      map.addLayer({
        id: "demo-cities-circle",
        type: "circle",
        source: "demo-cities",
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-radius": ["get", "radius"],
          "circle-stroke-color": ["case", ["get", "selected"], "#0f172a", "#ffffff"],
          "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
        },
      });
      readyRef.current = true;
      paint();
      frame();
    });

    const show = (text: string, lngLat: { lng: number; lat: number }) =>
      popup.setLngLat(lngLat).setText(text).addTo(map);

    map.on("mousemove", "demo-states-fill", (event) => {
      if (map.queryRenderedFeatures(event.point, { layers: ["demo-cities-circle"] }).length) return;
      const id = event.features?.[0]?.properties?.GEOID as string | undefined;
      const area = latest.current.states.find((item) => item.id === id);
      if (!area) return;
      map.getCanvas().style.cursor = "pointer";
      const { selectedStateId, formatValue } = latest.current;
      show(selectedStateId === id ? area.name : `${area.name} · ${formatValue(area.value)}`, event.lngLat);
    });
    map.on("mouseleave", "demo-states-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("mousemove", "demo-cities-circle", (event) => {
      const id = event.features?.[0]?.properties?.id as string | undefined;
      const city = latest.current.cities.find((item) => item.id === id);
      if (!city) return;
      map.getCanvas().style.cursor = "pointer";
      show(`${city.name} · ${latest.current.formatValue(city.value)}`, event.lngLat);
    });
    map.on("mouseleave", "demo-cities-circle", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("click", (event) => {
      const city = map.queryRenderedFeatures(event.point, { layers: ["demo-cities-circle"] })[0];
      if (city) {
        latest.current.onSelectCity(String(city.properties.id));
        return;
      }
      const state = map.queryRenderedFeatures(event.point, { layers: ["demo-states-fill"] })[0];
      if (state && state.properties.GEOID !== latest.current.selectedStateId) {
        latest.current.onSelectState(String(state.properties.GEOID));
      }
    });

    return () => {
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    latest.current = { states, cities, selectedStateId, selectedCityId, color, formatValue, onSelectState, onSelectCity };
    paint();
  });

  // Re-frame only when the selection (or the loaded city list) changes, not
  // on every repaint while the year slider moves.
  const hasCities = cities.length > 0;
  useEffect(() => {
    if (readyRef.current) frame();
  }, [selectedStateId, selectedCityId, hasCities]);

  return (
    <div
      ref={containerRef}
      className="h-[380px] w-full overflow-hidden sm:h-[440px]"
      role="region"
      aria-label="Map of demographic shares; select a state or city to drill in"
    />
  );
}
