"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";
import type Konva from "konva";

interface MapContextValue {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
  // The annotation layer's Konva stage — exposed here (rather than a
  // separate context) so export tooling can read both the basemap and the
  // annotations from one place, the same way AnnotationCanvas already reads
  // `map` from here instead of prop-drilling it.
  stage: Konva.Stage | null;
  setStage: (stage: Konva.Stage | null) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const [stage, setStage] = useState<Konva.Stage | null>(null);
  return (
    <MapContext.Provider value={{ map, setMap, stage, setStage }}>
      {children}
    </MapContext.Provider>
  );
}

export function useMapInstance(): MapContextValue {
  const ctx = useContext(MapContext);
  if (!ctx) {
    throw new Error("useMapInstance must be used within a MapProvider");
  }
  return ctx;
}
