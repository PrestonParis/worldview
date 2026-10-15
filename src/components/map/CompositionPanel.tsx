"use client";

import { useRef, useState } from "react";
import { ImagePlus, Plus } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import { createCompositionLayer, createImageLayer, type CompositionRole } from "@/lib/map/composition";
import { createDataLayer, DATA_PROVIDERS } from "@/lib/map/dataLayers";
import type { Layer } from "@/lib/types";

const ROLES: Array<{ id: CompositionRole; label: string }> = [
  { id: "title", label: "Title" }, { id: "subtitle", label: "Subtitle" },
  { id: "caption", label: "Caption" }, { id: "source", label: "Source note" },
  { id: "timestamp", label: "Timestamp" },
];

export function CompositionPanel() {
  const [showSafeArea, setShowSafeArea] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const layers = useAppStore((s) => s.layers);
  const addLayer = useAppStore((s) => s.addLayer);
  const setLayers = useAppStore((s) => s.setLayers);
  const setMapView = useAppStore((s) => s.setMapView);
  const setProject = useAppStore((s) => s.setProject);
  const setLiveValues = useAppStore((s) => s.setLiveValues);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const nextOrder = () => Math.max(0, ...useAppStore.getState().layers.map((layer) => layer.order)) + 1;

  function addComposition(role: CompositionRole) {
    const layer = createCompositionLayer(role, nextOrder());
    addLayer(layer);
    setActiveLayer(layer.id);
  }

  function loadImage(file: File | undefined) {
    setError(null);
    if (!file) return;
    if (!file.type.startsWith("image/")) { setError("Choose an image file."); return; }
    if (file.size > 4_000_000) { setError("Images must be smaller than 4 MB."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result ?? "");
      const image = new Image();
      image.onload = () => {
        const layer = createImageLayer(dataUrl, { width: image.naturalWidth, height: image.naturalHeight }, nextOrder());
        addLayer(layer);
        setActiveLayer(layer.id);
      };
      image.onerror = () => setError("The image could not be decoded.");
      image.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }

  function applyTemplate(kind: "breaking" | "shipping" | "disaster") {
    if (layers.length > 1 && !window.confirm("Replace the current canvas with this template?")) return;
    const base = createDefaultLayers();
    const created: Layer[] = [...base];
    if (kind === "shipping") {
      const provider = DATA_PROVIDERS.find((item) => item.id === "ais-ships")!;
      created.push(createDataLayer(provider, created.length, { updatedWithinMinutes: 30, minimumSpeed: 0 }));
    }
    if (kind === "disaster") {
      const provider = DATA_PROVIDERS.find((item) => item.id === "gdacs")!;
      created.push(createDataLayer(provider, created.length, { days: 7 }));
    }
    const title = createCompositionLayer("title", created.length);
    title.text = kind === "breaking" ? "BREAKING NEWS" : kind === "shipping" ? "LIVE MARITIME TRAFFIC" : "GLOBAL DISASTER MONITOR";
    created.push(title);
    const subtitle = createCompositionLayer("subtitle", created.length);
    subtitle.text = kind === "breaking" ? "Add the location and essential context" : kind === "shipping" ? "AIS positions · continuously updating" : "Earthquakes, storms, floods, fires, and volcanoes";
    created.push(subtitle);
    const view = createDefaultMapView();
    setMapView(view);
    setLayers(created);
    setLiveValues({});
    setProject(null, `${title.text.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase())}`);
  }

  return (
    <>
      {showSafeArea && <div className="pointer-events-none fixed inset-[5%] z-10 hidden border border-dashed border-amber-300/80 lg:block"><div className="absolute inset-[5%] border border-dashed border-amber-300/40" /></div>}
          <div className="space-y-4 text-sm text-neutral-200">
            <section><p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Text elements</p><div className="grid grid-cols-2 gap-1.5">{ROLES.map((role) => <button key={role.id} type="button" onClick={() => addComposition(role.id)} className="flex items-center gap-1 rounded border border-neutral-800 px-2 py-1.5 text-xs hover:bg-neutral-900"><Plus size={11} /> {role.label}</button>)}</div></section>
            <section><p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Assets & guides</p><input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(event) => loadImage(event.target.files?.[0])} /><button type="button" onClick={() => fileRef.current?.click()} className="mb-1.5 flex w-full items-center gap-2 rounded border border-neutral-800 px-2 py-1.5 text-xs hover:bg-neutral-900"><ImagePlus size={13} /> Add image or logo</button><label className="flex items-center justify-between text-xs"><span>Broadcast safe area</span><input type="checkbox" checked={showSafeArea} onChange={(event) => setShowSafeArea(event.target.checked)} /></label>{error ? <p className="mt-1 text-xs text-red-400">{error}</p> : null}</section>
            <section><p className="mb-2 text-xs uppercase tracking-wide text-neutral-500">Templates</p><div className="space-y-1">{[["breaking", "Breaking-news locator"], ["shipping", "Live shipping"], ["disaster", "Disaster monitor"]].map(([id, label]) => <button key={id} type="button" onClick={() => applyTemplate(id as "breaking" | "shipping" | "disaster")} className="w-full rounded border border-neutral-800 px-2 py-1.5 text-left text-xs hover:bg-neutral-900">{label}</button>)}</div></section>
          </div>
    </>
  );
}
