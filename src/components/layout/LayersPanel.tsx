"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Copy, Eye, EyeOff, Lock, PanelRightClose, PanelRightOpen, Redo2, Snowflake, Trash2, Undo2, Unlock } from "lucide-react";
import { layerHistoryTransactionProps, useAppStore, useTemporalStore } from "@/lib/store/useAppStore";
import { dataLayerEndpoint } from "@/lib/map/dataLayers";
import type { DataLayerConfig, Layer, TextStyle } from "@/lib/types";

export function LayersPanel() {
  const layers = useAppStore((s) => s.layers);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);
  const moveLayer = useAppStore((s) => s.moveLayer);
  const removeLayer = useAppStore((s) => s.removeLayer);
  const duplicateLayer = useAppStore((s) => s.duplicateLayer);
  const updateDataLayer = useAppStore((s) => s.updateDataLayer);
  const updateLayerGeometry = useAppStore((s) => s.updateLayerGeometry);
  const updateLayerStyle = useAppStore((s) => s.updateLayerStyle);
  const dataLayerStatuses = useAppStore((s) => s.dataLayerStatuses);
  const liveValues = useAppStore((s) => s.liveValues);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  const { undo, redo, canUndo, canRedo } = useTemporalStore();

  const sorted = [...layers].sort((a, b) => b.order - a.order);
  const activeLayer = layers.find((layer) => layer.id === activeLayerId) ?? null;

  function commitRename(id: string, name: string) {
    const trimmed = name.trim();
    if (trimmed) updateLayer(id, { name: trimmed });
    setRenamingId(null);
  }

  if (collapsed) {
    return (
      <aside className="hidden w-10 shrink-0 flex-col items-center border-l border-neutral-800 bg-neutral-950 py-2 lg:flex">
        <button type="button" onClick={() => setCollapsed(false)} title="Show layers" aria-label="Show layers" className="rounded p-1.5 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
          <PanelRightOpen size={15} />
        </button>
      </aside>
    );
  }

  return (
    <aside className="hidden w-60 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950 lg:flex">
      <div className="flex items-center justify-between border-b border-neutral-800 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Layers
        </h2>
        <div className="flex items-center gap-1">
          <button
            type="button"
            title="Undo (Ctrl/Cmd+Z)"
            aria-label="Undo"
            disabled={!canUndo}
            onClick={() => undo()}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <Undo2 size={14} />
          </button>
          <button
            type="button"
            title="Redo (Ctrl/Cmd+Shift+Z)"
            aria-label="Redo"
            disabled={!canRedo}
            onClick={() => redo()}
            className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-30"
          >
            <Redo2 size={14} />
          </button>
          <button type="button" onClick={() => setCollapsed(true)} title="Hide layers" aria-label="Hide layers" className="rounded p-1 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100">
            <PanelRightClose size={14} />
          </button>
        </div>
      </div>
      <ul className="min-h-0 flex-1 overflow-y-auto">
        {sorted.map((layer, index) => {
          const isMap = layer.type === "map";
          return (
            <li
              key={layer.id}
              onClick={() => setActiveLayer(layer.id)}
              className={`flex cursor-pointer items-center gap-1.5 border-b border-neutral-900 px-3 py-2 text-sm ${
                activeLayerId === layer.id
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-300 hover:bg-neutral-900"
              }`}
            >
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { visible: !layer.visible });
                }}
                className="text-neutral-500 hover:text-neutral-100"
                aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>

              {renamingId === layer.id ? (
                <input
                  autoFocus
                  defaultValue={layer.name}
                  onClick={(e) => e.stopPropagation()}
                  onBlur={(e) => commitRename(layer.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename(layer.id, e.currentTarget.value);
                    if (e.key === "Escape") setRenamingId(null);
                  }}
                  className="min-w-0 flex-1 rounded bg-neutral-900 px-1 py-0.5 text-neutral-100 focus:outline-none"
                />
              ) : (
                <span
                  className="min-w-0 flex-1 truncate"
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    setRenamingId(layer.id);
                  }}
                >
                  {layer.name}
                </span>
              )}

              {!isMap && (
                <div className="flex shrink-0 flex-col">
                  <button
                    type="button"
                    title="Bring forward"
                    aria-label="Bring forward"
                    disabled={index === 0}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, "forward");
                    }}
                    className="text-neutral-500 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-20"
                  >
                    <ChevronUp size={12} />
                  </button>
                  <button
                    type="button"
                    title="Send backward"
                    aria-label="Send backward"
                    disabled={sorted[index + 1]?.type === "map" || index === sorted.length - 1}
                    onClick={(e) => {
                      e.stopPropagation();
                      moveLayer(layer.id, "backward");
                    }}
                    className="text-neutral-500 hover:text-neutral-100 disabled:pointer-events-none disabled:opacity-20"
                  >
                    <ChevronDown size={12} />
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  updateLayer(layer.id, { locked: !layer.locked });
                }}
                className="shrink-0 text-neutral-500 hover:text-neutral-100"
                aria-label={`${layer.locked ? "Unlock" : "Lock"} ${layer.name}`}
              >
                {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </li>
          );
        })}
      </ul>
      {activeLayer && activeLayer.type !== "map" && (
        <div className="flex items-center gap-1 border-t border-neutral-800 px-3 py-2">
          <button type="button" onClick={() => duplicateLayer(activeLayer.id)} className="flex flex-1 items-center justify-center gap-1 rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-400 hover:text-neutral-100"><Copy size={12} /> Duplicate</button>
          <button type="button" onClick={() => removeLayer(activeLayer.id)} className="rounded border border-neutral-800 p-1.5 text-neutral-500 hover:text-red-400" aria-label={`Delete ${activeLayer.name}`}><Trash2 size={13} /></button>
        </div>
      )}
      {activeLayer?.type === "data" && (
        <DataLayerProperties
          layer={activeLayer}
          status={dataLayerStatuses[activeLayer.id]}
          update={(patch) => updateDataLayer(activeLayer.id, patch)}
        />
      )}
      {activeLayer?.type === "composition" && (
        <CompositionProperties
          layer={activeLayer}
          update={(patch) => updateLayerGeometry(activeLayer.id, patch as Partial<Layer>)}
          updateStyle={(patch) => updateLayerStyle(activeLayer.id, patch)}
        />
      )}
      {activeLayer?.type === "image" && (
        <ImageProperties layer={activeLayer} update={(patch) => updateLayerGeometry(activeLayer.id, patch as Partial<Layer>)} />
      )}
      {activeLayer && activeLayer.type !== "map" && activeLayer.type !== "group" && activeLayer.type !== "data" && activeLayer.type !== "image" && (
        <LiveBindingProperties
          layer={activeLayer}
          keys={Object.keys(liveValues).sort()}
          update={(bindings) => updateLayerGeometry(activeLayer.id, { bindings } as Partial<Layer>)}
        />
      )}
    </aside>
  );
}

function LiveBindingProperties({ layer, keys, update }: {
  layer: Exclude<Layer, { type: "map" | "group" | "data" | "image" }>;
  keys: string[];
  update: (bindings: NonNullable<Layer["bindings"]> | undefined) => void;
}) {
  const supportsText = layer.type === "text" || layer.type === "composition";
  const supportsColor = "style" in layer && "color" in layer.style;
  const setBinding = (field: "text" | "color", value: string) => {
    const next = { ...(layer.bindings ?? {}), [field]: value.trim() || undefined };
    if (!next.text && !next.color) update(undefined);
    else update(next);
  };
  if (!supportsText && !supportsColor) return null;
  return (
    <div className="space-y-2 border-t border-neutral-800 p-3 text-xs text-neutral-300">
      <div><p className="font-medium text-neutral-100">Live bindings</p><p className="text-[11px] leading-4 text-neutral-500">Use a key from Live values. Static styling remains the fallback.</p></div>
      <datalist id={`live-value-keys-${layer.id}`}>{keys.map((key) => <option key={key} value={key} />)}</datalist>
      {supportsText && <label className="block"><span className="mb-1 block text-neutral-500">Text key</span><input list={`live-value-keys-${layer.id}`} value={layer.bindings?.text ?? ""} onChange={(event) => setBinding("text", event.target.value)} placeholder="e.g. headline" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" /></label>}
      {supportsColor && <label className="block"><span className="mb-1 block text-neutral-500">Color key</span><input list={`live-value-keys-${layer.id}`} value={layer.bindings?.color ?? ""} onChange={(event) => setBinding("color", event.target.value)} placeholder="e.g. alert_color" className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" /></label>}
    </div>
  );
}

function CompositionProperties({ layer, update, updateStyle }: {
  layer: Extract<Layer, { type: "composition" }>;
  update: (patch: Partial<Extract<Layer, { type: "composition" }>>) => void;
  updateStyle: (patch: Partial<TextStyle>) => void;
}) {
  return (
    <div className="max-h-[45vh] space-y-3 overflow-y-auto border-t border-neutral-800 p-3 text-xs text-neutral-300">
      <p className="font-medium text-neutral-100">Composition element</p>
      <label className="block"><span className="mb-1 block text-neutral-500">Text</span><textarea value={layer.text} onChange={(event) => update({ text: event.target.value })} rows={3} className="w-full resize-y rounded border border-neutral-700 bg-neutral-900 p-2" /></label>
      <label className="block"><span className="flex justify-between"><span>Font size</span><span>{layer.style.fontSize}px</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="12" max="96" value={layer.style.fontSize} onChange={(event) => updateStyle({ fontSize: Number(event.target.value) })} /></label>
      <label className="flex items-center justify-between"><span>Text color</span><input type="color" value={layer.style.color} onChange={(event) => updateStyle({ color: event.target.value })} /></label>
      <label className="flex items-center justify-between"><span>Bold</span><input type="checkbox" checked={layer.style.bold} onChange={(event) => updateStyle({ bold: event.target.checked })} /></label>
      <label className="block"><span className="flex justify-between"><span>Width</span><span>{Math.round(layer.width * 100)}%</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0.1" max="1" step="0.01" value={layer.width} onChange={(event) => update({ width: Number(event.target.value) })} /></label>
      <label className="flex items-center justify-between"><span>Background</span><input type="color" value={layer.backgroundColor} onChange={(event) => update({ backgroundColor: event.target.value })} /></label>
      <label className="block"><span className="flex justify-between"><span>Background opacity</span><span>{Math.round(layer.backgroundOpacity * 100)}%</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0" max="1" step="0.05" value={layer.backgroundOpacity} onChange={(event) => update({ backgroundOpacity: Number(event.target.value) })} /></label>
      <p className="text-[11px] leading-4 text-neutral-500">Drag the element on the canvas to reposition it.</p>
    </div>
  );
}

function ImageProperties({ layer, update }: {
  layer: Extract<Layer, { type: "image" }>;
  update: (patch: Partial<Extract<Layer, { type: "image" }>>) => void;
}) {
  const aspect = layer.height / layer.width;
  return (
    <div className="space-y-3 border-t border-neutral-800 p-3 text-xs text-neutral-300">
      <p className="font-medium text-neutral-100">Image</p>
      <label className="block"><span className="flex justify-between"><span>Width</span><span>{Math.round(layer.width * 100)}%</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0.03" max="0.8" step="0.01" value={layer.width} onChange={(event) => { const width = Number(event.target.value); update({ width, height: width * aspect }); }} /></label>
      <label className="block"><span className="flex justify-between"><span>Opacity</span><span>{Math.round(layer.opacity * 100)}%</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0" max="1" step="0.05" value={layer.opacity} onChange={(event) => update({ opacity: Number(event.target.value) })} /></label>
      <p className="text-[11px] leading-4 text-neutral-500">Drag the image on the canvas to reposition it.</p>
    </div>
  );
}

function DataLayerProperties({
  layer,
  status,
  update,
}: {
  layer: Extract<Layer, { type: "data" }>;
  status?: { state: "loading" | "ready" | "error"; lastUpdated: string | null; count: number; error: string | null };
  update: (patch: Partial<DataLayerConfig>) => void;
}) {
  const data = layer.data;

  async function freeze() {
    if (data.refreshMode === "frozen") {
      update({ refreshMode: "manual", frozenData: undefined });
      return;
    }
    const response = await fetch(dataLayerEndpoint(layer), { cache: "no-store" });
    const body = await response.json() as { data?: GeoJSON.FeatureCollection; error?: string };
    if (!response.ok || !body.data) return;
    update({ refreshMode: "frozen", frozenData: body.data });
  }

  return (
    <div className="max-h-[45vh] space-y-3 overflow-y-auto border-t border-neutral-800 p-3 text-xs text-neutral-300">
      <div>
        <p className="font-medium text-neutral-100">Data layer</p>
        <p className="mt-0.5 text-[11px] leading-4 text-neutral-500">{data.metadata.freshnessLabel}</p>
        {status ? <p className={`mt-1 text-[11px] ${status.state === "error" ? "text-red-400" : "text-neutral-500"}`}>{status.state === "ready" ? `${status.count.toLocaleString()} features · updated ${new Date(status.lastUpdated!).toLocaleTimeString()}` : status.state === "loading" ? "Refreshing…" : status.error}</p> : null}
      </div>
      <label className="block">
        <span className="mb-1 block text-neutral-500">Visualization</span>
        <select value={data.visualization} onChange={(event) => update({ visualization: event.target.value as typeof data.visualization })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1.5">
          <option value="circle">Points</option><option value="heatmap">Heatmap</option><option value="line">Lines</option><option value="fill">Fill</option><option value="choropleth">Choropleth</option>
        </select>
      </label>
      <label className="flex items-center justify-between gap-2"><span>Color</span><input type="color" value={data.style.color} onChange={(event) => update({ style: { ...data.style, color: event.target.value } })} className="h-6 w-10" /></label>
      <label className="block"><span className="flex justify-between"><span>Opacity</span><span>{Math.round(data.style.opacity * 100)}%</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0" max="1" step="0.05" value={data.style.opacity} onChange={(event) => update({ style: { ...data.style, opacity: Number(event.target.value) } })} /></label>
      {(data.visualization === "circle" || data.visualization === "heatmap") && <label className="block"><span className="flex justify-between"><span>Size</span><span>{data.style.radius}px</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="2" max="30" value={data.style.radius} onChange={(event) => update({ style: { ...data.style, radius: Number(event.target.value) } })} /></label>}
      {data.source.providerId === "ais-ships" && (
        <>
          <label className="block"><span className="flex justify-between"><span>Minimum speed</span><span>{Number(data.source.query.minimumSpeed ?? 0)} kn</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0" max="40" step="1" value={Number(data.source.query.minimumSpeed ?? 0)} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, minimumSpeed: Number(event.target.value) } } })} /></label>
          <label className="block"><span className="mb-1 block text-neutral-500">Updated within</span><select value={String(data.source.query.updatedWithinMinutes ?? 30)} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, updatedWithinMinutes: Number(event.target.value) } } })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"><option value="5">5 minutes</option><option value="15">15 minutes</option><option value="30">30 minutes</option><option value="60">1 hour</option></select></label>
        </>
      )}
      {data.source.providerId === "usgs-earthquakes" && (
        <>
          <label className="block"><span className="mb-1 block text-neutral-500">Time window</span><select value={String(data.source.query.window ?? "day")} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, window: event.target.value } } })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1"><option value="hour">Past hour</option><option value="day">Past day</option><option value="week">Past week</option></select></label>
          <label className="block"><span className="flex justify-between"><span>Minimum magnitude</span><span>{Number(data.source.query.minMagnitude ?? 0).toFixed(1)}</span></span><input {...layerHistoryTransactionProps} className="w-full" type="range" min="0" max="8" step="0.5" value={Number(data.source.query.minMagnitude ?? 0)} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, minMagnitude: Number(event.target.value) } } })} /></label>
        </>
      )}
      {data.source.providerId === "gdacs" && <label className="block"><span className="mb-1 block text-neutral-500">Past days</span><input type="number" min="1" max="31" value={Number(data.source.query.days ?? 7)} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, days: Number(event.target.value) } } })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" /></label>}
      {data.source.providerId === "nasa-firms" && <label className="block"><span className="mb-1 block text-neutral-500">Past days</span><input type="number" min="1" max="5" value={Number(data.source.query.days ?? 1)} onChange={(event) => update({ source: { ...data.source, query: { ...data.source.query, days: Number(event.target.value) } } })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" /></label>}
      <label className="flex items-center justify-between"><span>Legend</span><input type="checkbox" checked={data.legend.visible} onChange={(event) => update({ legend: { ...data.legend, visible: event.target.checked } })} /></label>
      {data.refreshMode !== "manual" && data.refreshMode !== "frozen" && <label className="block"><span className="mb-1 block text-neutral-500">Refresh seconds</span><input type="number" min={data.source.providerId === "ais-ships" ? 2 : 30} max="86400" value={data.refreshSeconds} onChange={(event) => update({ refreshSeconds: Number(event.target.value) })} className="w-full rounded border border-neutral-700 bg-neutral-900 px-2 py-1" /></label>}
      <button type="button" onClick={freeze} className="flex w-full items-center justify-center gap-1.5 rounded border border-neutral-700 px-2 py-1.5 hover:bg-neutral-900"><Snowflake size={12} /> {data.refreshMode === "frozen" ? "Resume live data" : "Freeze current data"}</button>
      <a href={data.metadata.sourceUrl} target="_blank" rel="noreferrer" className="block truncate text-[11px] text-blue-400 hover:underline">Source: {data.metadata.attribution}</a>
    </div>
  );
}
