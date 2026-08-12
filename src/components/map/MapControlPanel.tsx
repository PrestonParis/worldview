"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp, Layers } from "lucide-react";
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
  const [open, setOpen] = useState(true);
  const mapView = useAppStore((s) => s.mapView);
  const setStyle = useAppStore((s) => s.setStyle);
  const toggleLabels = useAppStore((s) => s.toggleLabels);
  const toggleNeighbors = useAppStore((s) => s.toggleNeighbors);
  const toggleFeature = useAppStore((s) => s.toggleFeature);

  return (
    <div className="absolute left-3 top-3 z-10 w-56 rounded-md border border-neutral-700 bg-neutral-950/90 text-sm text-neutral-200 shadow-lg backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-3 py-2"
      >
        <span className="flex items-center gap-2 font-medium text-neutral-100">
          <Layers size={14} /> Map
        </span>
        {open ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
      </button>

      {open && (
        <div className="max-h-[calc(100vh-8rem)] space-y-4 overflow-y-auto border-t border-neutral-800 px-3 py-3">
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
      )}
    </div>
  );
}
