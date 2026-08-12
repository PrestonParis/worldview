import type { StateCreator } from "zustand";
import type { GeoFeatureKey, MapStyleId, MapViewState } from "@/lib/types";

export interface MapViewSlice {
  mapView: MapViewState;
  setCenter: (center: [number, number]) => void;
  setZoom: (zoom: number) => void;
  flyTo: (center: [number, number], zoom: number) => void;
  setStyle: (style: MapStyleId) => void;
  toggleLabels: () => void;
  toggleNeighbors: () => void;
  toggleFeature: (key: GeoFeatureKey) => void;
  selectCountry: (countryId: string | null) => void;
}

const defaultFeatureToggles: Record<GeoFeatureKey, boolean> = {
  seas: true,
  mountains: false,
  rivers: false,
  lakes: false,
  deserts: false,
  islands: false,
  forests: false,
  cities: true,
};

export const createMapViewSlice: StateCreator<MapViewSlice> = (set) => ({
  mapView: {
    center: [0, 20],
    zoom: 2,
    bearing: 0,
    pitch: 0,
    style: "political",
    showLabels: true,
    showNeighbors: true,
    featureToggles: defaultFeatureToggles,
    selectedCountryId: null,
  },
  setCenter: (center) =>
    set((s) => ({ mapView: { ...s.mapView, center } })),
  setZoom: (zoom) => set((s) => ({ mapView: { ...s.mapView, zoom } })),
  flyTo: (center, zoom) =>
    set((s) => ({ mapView: { ...s.mapView, center, zoom } })),
  setStyle: (style) => set((s) => ({ mapView: { ...s.mapView, style } })),
  toggleLabels: () =>
    set((s) => ({
      mapView: { ...s.mapView, showLabels: !s.mapView.showLabels },
    })),
  toggleNeighbors: () =>
    set((s) => ({
      mapView: { ...s.mapView, showNeighbors: !s.mapView.showNeighbors },
    })),
  toggleFeature: (key) =>
    set((s) => ({
      mapView: {
        ...s.mapView,
        featureToggles: {
          ...s.mapView.featureToggles,
          [key]: !s.mapView.featureToggles[key],
        },
      },
    })),
  selectCountry: (countryId) =>
    set((s) => ({ mapView: { ...s.mapView, selectedCountryId: countryId } })),
});
