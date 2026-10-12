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
  type StyleSpecification,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { INSETS, insetPosition } from "@/lib/geo/insets";
import { isDark, onThemeChange } from "@/lib/theme";

// Same MapLibre worker-URL fix the geography studio needs (see
// src/components/map/MapCanvas.tsx).
if (typeof window !== "undefined") {
  setWorkerUrl("/maplibre/maplibre-gl-worker.mjs");
}

// No basemap: the map is the states alone on the card's own background.
// Glyphs are only for the state / city labels drawn here.
const BLANK_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {},
  layers: [],
};
const LABEL_FONT = ["Noto Sans Regular"];
const STATES_URL = "/data/us-states.geojson";
// Lower 48 plus the Alaska / Hawaii insets.
const US_BOUNDS: LngLatBoundsLike = [-125, 21.5, -66.5, 49.5];
const PAN_LIMIT: LngLatBoundsLike = [-150, 5, -45, 62];
const NO_DATA = "#cbd5e1";
// Decreases in the diverging (change) scale.
export const NEGATIVE_COLOR = "#475569";
const CITY_LABELS = 8;

function mapCoordinates(coords: unknown, move: (lon: number, lat: number) => [number, number]): unknown {
  if (typeof (coords as number[])[0] === "number") {
    const [lon, lat] = coords as number[];
    return move(lon, lat);
  }
  return (coords as unknown[]).map((item) => mapCoordinates(item, move));
}

function placeInsets(collection: StatesCollection): StatesCollection {
  return {
    ...collection,
    features: collection.features.map((feature) => {
      const id = feature.properties.GEOID;
      if (!INSETS[id] || !("coordinates" in feature.geometry)) return feature;
      return {
        ...feature,
        geometry: {
          ...feature.geometry,
          coordinates: mapCoordinates(feature.geometry.coordinates, (lon, lat) => insetPosition(id, lon, lat)),
        } as GeoJSON.Geometry,
      };
    }),
  };
}

// Label anchor: centroid of the state's largest polygon.
function labelPoint(geometry: GeoJSON.Geometry): [number, number] {
  const polygons =
    geometry.type === "Polygon" ? [geometry.coordinates] : geometry.type === "MultiPolygon" ? geometry.coordinates : [];
  let best: [number, number] = [0, 0];
  let bestArea = 0;
  for (const [ring] of polygons) {
    let area = 0;
    let cx = 0;
    let cy = 0;
    for (let i = 0; i < ring.length - 1; i += 1) {
      const [x0, y0] = ring[i];
      const [x1, y1] = ring[i + 1];
      const cross = x0 * y1 - x1 * y0;
      area += cross;
      cx += (x0 + x1) * cross;
      cy += (y0 + y1) * cross;
    }
    if (Math.abs(area) > bestArea) {
      bestArea = Math.abs(area);
      best = [cx / (3 * area), cy / (3 * area)];
    }
  }
  return best;
}

const prefersDark = isDark;

function applyInk(map: MapLibreMap, dark: boolean) {
  const ink = dark ? "#e2e8f0" : "#0f172a";
  const text = dark ? "#cbd5e1" : "#334155";
  const halo = dark ? "#020617" : "#ffffff";
  map.setPaintProperty("demo-states-line", "line-color", ["case", ["get", "selected"], ink, "#64748b"]);
  map.setPaintProperty("demo-cities-circle", "circle-stroke-color", ["case", ["get", "selected"], ink, halo]);
  for (const layer of ["demo-state-labels", "demo-city-labels"]) {
    map.setPaintProperty(layer, "text-color", text);
    map.setPaintProperty(layer, "text-halo-color", halo);
  }
}

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

type StatesCollection = GeoJSON.FeatureCollection<
  GeoJSON.Geometry,
  { GEOID: string; NAME: string; STUSPS: string }
>;

// Position of a value within the visible range, 0..1.
function rampPosition(value: number, min: number, max: number): number {
  return max > min ? Math.min(1, Math.max(0, (value - min) / (max - min))) : 0.5;
}

// Symmetric extent around zero for the diverging scale.
export function divergingExtent(values: Array<number | null>): number {
  return Math.max(0.1, ...values.filter((value): value is number => value !== null).map(Math.abs));
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
  cityLevel,
  color,
  scale,
  formatValue,
  onSelectState,
  onSelectCity,
  onBack,
  onNational,
}: {
  states: MapArea[];
  cities: MapCity[];
  selectedStateId: string | null;
  selectedCityId: string | null;
  // Whether cities carry the data inside an open state. When not, the open
  // state stays on the state map, outlined.
  cityLevel: boolean;
  color: string;
  scale: "sequential" | "diverging";
  formatValue: (value: number | null) => string;
  onSelectState: (id: string) => void;
  onSelectCity: (id: string) => void;
  onBack: () => void; // one level up (city -> state -> nation)
  onNational: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const geometryRef = useRef<StatesCollection | null>(null);
  const readyRef = useRef(false);
  // Latest props for the map's event handlers, which are bound once.
  const latest = useRef({
    states, cities, selectedStateId, selectedCityId, cityLevel, color, scale, formatValue,
    onSelectState, onSelectCity, onBack, onNational,
  });

  const paint = () => {
    const map = mapRef.current;
    const geometry = geometryRef.current;
    if (!map || !geometry || !readyRef.current) return;
    const { states, cities, selectedStateId, selectedCityId, cityLevel, color, scale } = latest.current;
    const byId = new Map(states.map((area) => [area.id, area]));
    const focusingState = selectedStateId !== null && cityLevel;
    const diverging = scale === "diverging";
    // Fill color and opacity for one value on the active scale.
    const ink = (value: number | null) => (value === null ? NO_DATA : diverging && value < 0 ? NEGATIVE_COLOR : color);
    const strength = (value: number, extent: [number, number], reach: number) =>
      diverging ? Math.min(1, Math.abs(value) / reach) : rampPosition(value, ...extent);

    const stateExtent = valueExtent(states.map((area) => area.value));
    const stateReach = divergingExtent(states.map((area) => area.value));
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
            color: ink(value),
            // Inside a state the cities carry the data; the state itself
            // becomes a quiet backdrop.
            opacity: focusingState
              ? selected ? 0.08 : 0.03
              : value === null ? 0.25 : 0.12 + 0.78 * strength(value, stateExtent, stateReach),
          },
        };
      }),
    });

    map.setLayoutProperty("demo-state-labels", "visibility", focusingState ? "none" : "visible");

    const cityExtent = valueExtent(cities.map((city) => city.value));
    const cityReach = divergingExtent(cities.map((city) => city.value));
    const largest = Math.max(1, ...cities.map((city) => city.population));
    // Cities arrive sorted by population; name the largest few.
    (map.getSource("demo-cities") as GeoJSONSource | undefined)?.setData({
      type: "FeatureCollection",
      features: cities.map((city, rank) => ({
        type: "Feature",
        geometry: { type: "Point", coordinates: insetPosition(city.id.slice(0, 2), city.lon, city.lat) },
        properties: {
          id: city.id,
          name: city.name,
          label: rank < CITY_LABELS || city.id === selectedCityId,
          selected: city.id === selectedCityId,
          color: ink(city.value),
          // Circles sit on a pale backdrop, so their ramp starts darker.
          opacity: city.value === null ? 0.6 : 0.35 + 0.65 * strength(city.value, cityExtent, cityReach),
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
      // Alaska's inset is drawn at a third of its size, so zoom in less.
      const zoom = city.id.startsWith("02") ? 7 : 8.5;
      map.flyTo({
        center: insetPosition(city.id.slice(0, 2), city.lon, city.lat),
        zoom: Math.max(map.getZoom(), zoom),
        duration: 900,
      });
      return;
    }
    if (selectedStateId) {
      const feature = geometry.features.find((item) => item.properties.GEOID === selectedStateId);
      if (feature) map.fitBounds(geometryBounds(feature.geometry), { padding: 32, duration: 900 });
      return;
    }
    map.fitBounds(US_BOUNDS, { padding: 16, duration: 900 });
  };

  useEffect(() => {
    if (!containerRef.current) return;
    const map = new MapLibreGlMap({
      container: containerRef.current,
      style: BLANK_STYLE,
      bounds: US_BOUNDS,
      maxBounds: PAN_LIMIT,
      fitBoundsOptions: { padding: 16 },
      attributionControl: false,
      dragRotate: false,
      renderWorldCopies: false,
    });
    mapRef.current = map;
    map.addControl(new NavigationControl({ showCompass: false }), "top-right");
    map.on("error", (event) => console.error("DemographicsMap:", event.error?.message));
    const popup = new Popup({ closeButton: false, closeOnClick: false, offset: 10 });

    const geometryLoad = fetch(STATES_URL)
      .then((res) => res.json() as Promise<StatesCollection>)
      .then(placeInsets);

    map.on("load", async () => {
      geometryRef.current = await geometryLoad;
      map.addSource("demo-states", { type: "geojson", data: geometryRef.current });
      map.addSource("demo-state-labels", {
        type: "geojson",
        data: {
          type: "FeatureCollection",
          features: geometryRef.current.features.map((feature) => ({
            type: "Feature",
            geometry: { type: "Point", coordinates: labelPoint(feature.geometry) },
            properties: { abbr: feature.properties.STUSPS },
          })),
        },
      });
      map.addSource("demo-cities", { type: "geojson", data: { type: "FeatureCollection", features: [] } });
      map.addLayer({
        id: "demo-states-fill",
        type: "fill",
        source: "demo-states",
        paint: { "fill-color": ["get", "color"], "fill-opacity": ["get", "opacity"] },
      });
      map.addLayer({
        id: "demo-states-line",
        type: "line",
        source: "demo-states",
        paint: {
          "line-width": ["case", ["get", "selected"], 2, 0.6],
          "line-opacity": ["case", ["get", "selected"], 0.9, 0.55],
        },
      });
      map.addLayer({
        id: "demo-state-labels",
        type: "symbol",
        source: "demo-state-labels",
        layout: { "text-field": ["get", "abbr"], "text-font": LABEL_FONT, "text-size": 10 },
        paint: { "text-halo-width": 1.2 },
      });
      map.addLayer({
        id: "demo-cities-circle",
        type: "circle",
        source: "demo-cities",
        paint: {
          "circle-color": ["get", "color"],
          "circle-opacity": ["get", "opacity"],
          "circle-radius": ["get", "radius"],
          "circle-stroke-width": ["case", ["get", "selected"], 3, 1.5],
        },
      });
      map.addLayer({
        id: "demo-city-labels",
        type: "symbol",
        source: "demo-cities",
        filter: ["get", "label"],
        layout: {
          "text-field": ["get", "name"],
          "text-font": LABEL_FONT,
          "text-size": 11,
          "text-anchor": "top",
          "text-offset": [0, 1],
          "text-optional": true,
        },
        paint: { "text-halo-width": 1.4 },
      });
      applyInk(map, prefersDark());
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
      const { selectedStateId, cityLevel, formatValue } = latest.current;
      show(
        selectedStateId === id && cityLevel ? area.name : `${area.name} · ${formatValue(area.value)}`,
        event.lngLat,
      );
    });
    map.on("mouseleave", "demo-states-fill", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("mousemove", "demo-cities-circle", (event) => {
      const id = event.features?.[0]?.properties?.id as string | undefined;
      const city = latest.current.cities.find((item) => item.id === id);
      if (!city) return;
      map.getCanvas().style.cursor = city.value === null ? "not-allowed" : "pointer";
      show(`${city.name} · ${latest.current.formatValue(city.value)}`, event.lngLat);
    });
    map.on("mouseleave", "demo-cities-circle", () => {
      map.getCanvas().style.cursor = "";
      popup.remove();
    });
    map.on("click", (event) => {
      const city = map.queryRenderedFeatures(event.point, { layers: ["demo-cities-circle"] })[0];
      if (city) {
        // A city with no figure for the active dimension can't be opened.
        const id = String(city.properties.id);
        if (latest.current.cities.find((item) => item.id === id)?.value != null) latest.current.onSelectCity(id);
        return;
      }
      const state = map.queryRenderedFeatures(event.point, { layers: ["demo-states-fill"] })[0];
      const { selectedStateId, selectedCityId } = latest.current;
      if (!state) {
        // Empty space (ocean, beyond the border) goes back to the nation.
        if (selectedStateId) latest.current.onNational();
      } else if (state.properties.GEOID !== selectedStateId) {
        latest.current.onSelectState(String(state.properties.GEOID));
      } else if (selectedCityId) {
        // Clicking the open state away from any city closes the city.
        latest.current.onBack();
      }
    });

    const offTheme = onThemeChange((dark) => {
      if (readyRef.current) applyInk(map, dark);
    });

    return () => {
      offTheme();
      popup.remove();
      map.remove();
      mapRef.current = null;
      readyRef.current = false;
    };
  }, []);

  useEffect(() => {
    latest.current = {
      states, cities, selectedStateId, selectedCityId, cityLevel, color, scale, formatValue,
      onSelectState, onSelectCity, onBack, onNational,
    };
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
      // Inline, not a utility class: MapLibre draws nothing in a container
      // with no height, so the height must not depend on a stylesheet.
      style={{ height: "clamp(380px, 60vw, 440px)" }}
      className="w-full overflow-hidden"
      role="region"
      aria-label="Map of demographic shares; select a state or city to drill in"
    />
  );
}
