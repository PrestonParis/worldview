"use client";

import { useEffect, useRef, useState } from "react";
import { useAppStore } from "@/lib/store/useAppStore";
import { useMapInstance } from "@/lib/map/MapContext";
import type { Layer, MapViewState } from "@/lib/types";

interface PresentationPayload {
  name: string;
  mapView: MapViewState;
  layers: Layer[];
  liveValues: Record<string, string>;
  updatedAt: string;
}

export function PresentationSync({ token }: { token: string }) {
  const { map } = useMapInstance();
  const setProject = useAppStore((state) => state.setProject);
  const setMapView = useAppStore((state) => state.setMapView);
  const setLayers = useAppStore((state) => state.setLayers);
  const setLiveValues = useAppStore((state) => state.setLiveValues);
  const [status, setStatus] = useState<"connecting" | "live" | "reconnecting" | "unavailable">("connecting");
  const etagRef = useRef<string | null>(null);
  const latestRef = useRef<PresentationPayload | null>(null);

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let failures = 0;
    const controller = new AbortController();

    if (map && latestRef.current) {
      const view = latestRef.current.mapView;
      map.jumpTo({ center: view.center, zoom: view.zoom, bearing: view.bearing, pitch: view.pitch });
    }

    const schedule = (milliseconds: number) => {
      if (!stopped) timer = setTimeout(load, milliseconds);
    };
    const load = async () => {
      try {
        const response = await fetch(`/api/geography/present/${encodeURIComponent(token)}`, {
          cache: "no-store",
          headers: etagRef.current ? { "If-None-Match": etagRef.current } : {},
          signal: controller.signal,
        });
        if (response.status === 404) {
          setStatus("unavailable");
          return;
        }
        if (response.status !== 304) {
          if (!response.ok) throw new Error(`Presentation request failed (${response.status}).`);
          const project = await response.json() as PresentationPayload;
          latestRef.current = project;
          etagRef.current = response.headers.get("etag");
          setProject(null, project.name);
          setMapView(project.mapView);
          setLayers(project.layers);
          setLiveValues(project.liveValues);
          map?.jumpTo({
            center: project.mapView.center,
            zoom: project.mapView.zoom,
            bearing: project.mapView.bearing,
            pitch: project.mapView.pitch,
          });
        }
        failures = 0;
        setStatus("live");
        schedule(document.hidden ? 5_000 : 1_000);
      } catch (error) {
        if (stopped || (error instanceof DOMException && error.name === "AbortError")) return;
        failures += 1;
        setStatus("reconnecting");
        schedule(Math.min(15_000, 1_000 * 2 ** Math.min(failures, 4)));
      }
    };
    void load();
    return () => {
      stopped = true;
      controller.abort();
      if (timer) clearTimeout(timer);
    };
  }, [map, setLayers, setLiveValues, setMapView, setProject, token]);

  if (status === "live") return <div className="sr-only" role="status">Live presentation connected</div>;
  return (
    <div className="absolute right-3 top-3 z-20 rounded bg-neutral-950/80 px-2 py-1 text-xs text-neutral-300" role="status">
      {status === "connecting" ? "Connecting…" : status === "reconnecting" ? "Reconnecting…" : "Presentation unavailable"}
    </div>
  );
}
