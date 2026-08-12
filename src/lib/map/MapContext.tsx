"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Map as MapLibreMap } from "maplibre-gl";

interface MapContextValue {
  map: MapLibreMap | null;
  setMap: (map: MapLibreMap | null) => void;
}

const MapContext = createContext<MapContextValue | null>(null);

export function MapProvider({ children }: { children: ReactNode }) {
  const [map, setMap] = useState<MapLibreMap | null>(null);
  return (
    <MapContext.Provider value={{ map, setMap }}>
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
