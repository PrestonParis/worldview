"use client";

import { useAppStore } from "@/lib/store/useAppStore";
import type { GeoFeatureKey, MapStyleId } from "@/lib/types";

const STYLES: { id: MapStyleId; label: string }[] = [
  { id: "political", label: "Political" },
  { id: "satellite", label: "Satellite" },
  { id: "terrain", label: "Terrain" },
  { id: "minimalist", label: "Minimalist" },
  { id: "dark", label: "Dark" },
  { id: "grayscale", label: "Grayscale" },
];

const FEATURES: { id: GeoFeatureKey; label: string; supported: boolean }[] = [
  { id: "seas", label: "Seas & oceans", supported: true },
  { id: "rivers", label: "Rivers", supported: true },
  { id: "mountains", label: "Mountains (terrain style)", supported: true },
  { id: "forests", label: "Forests", supported: true },
  { id: "deserts", label: "Deserts", supported: true },
  { id: "cities", label: "Major cities", supported: true },
  { id: "lakes", label: "Lakes", supported: false },
  { id: "islands", label: "Islands", supported: false },
];

export function MapControlPanel() {
  const mapView = useAppStore((s) => s.mapView);
  const setStyle = useAppStore((s) => s.setStyle);
  const toggleLabels = useAppStore((s) => s.toggleLabels);
  const toggleNeighbors = useAppStore((s) => s.toggleNeighbors);
  const toggleFeature = useAppStore((s) => s.toggleFeature);

  return (
    <div className="space-y-4 text-sm text-neutral-200">
          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-500">
              Style
            </p>
            <div className="grid grid-cols-2 gap-1">
              {STYLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => setStyle(s.id)}
                  className={`rounded px-2 py-1.5 text-left text-xs transition ${
                    mapView.style === s.id
                      ? "bg-neutral-100 text-neutral-900"
                      : "bg-neutral-900 text-neutral-300 hover:bg-neutral-800"
                  }`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="flex cursor-pointer items-center justify-between">
              <span>Labels</span>
              <input
                type="checkbox"
                checked={mapView.showLabels}
                onChange={toggleLabels}
                className="accent-neutral-100"
              />
            </label>
            <label className="flex cursor-pointer items-center justify-between">
              <span>Show neighbors</span>
              <input
                type="checkbox"
                checked={mapView.showNeighbors}
                onChange={toggleNeighbors}
                className="accent-neutral-100"
              />
            </label>
          </div>

          <div>
            <p className="mb-1.5 text-xs uppercase tracking-wide text-neutral-500">
              Geographic features
            </p>
            <div className="space-y-1.5">
              {FEATURES.map((f) => (
                <label
                  key={f.id}
                  className={`flex cursor-pointer items-center justify-between ${
                    f.supported ? "" : "opacity-50"
                  }`}
                  title={f.supported ? undefined : "Coming in a later phase"}
                >
                  <span>{f.label}</span>
                  <input
                    type="checkbox"
                    checked={mapView.featureToggles[f.id]}
                    onChange={() => toggleFeature(f.id)}
                    className="accent-neutral-100"
                  />
                </label>
              ))}
            </div>
          </div>
    </div>
  );
}
