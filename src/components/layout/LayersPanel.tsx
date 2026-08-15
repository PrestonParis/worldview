"use client";

import { useState } from "react";
import { ChevronUp, ChevronDown, Eye, EyeOff, Lock, Redo2, Undo2, Unlock } from "lucide-react";
import { useAppStore, useTemporalStore } from "@/lib/store/useAppStore";

export function LayersPanel() {
  const layers = useAppStore((s) => s.layers);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);
  const moveLayer = useAppStore((s) => s.moveLayer);
  const [renamingId, setRenamingId] = useState<string | null>(null);

  const { undo, redo, canUndo, canRedo } = useTemporalStore();

  const sorted = [...layers].sort((a, b) => b.order - a.order);

  function commitRename(id: string, name: string) {
    const trimmed = name.trim();
    if (trimmed) updateLayer(id, { name: trimmed });
    setRenamingId(null);
  }

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
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
        </div>
      </div>
      <ul className="flex-1 overflow-y-auto">
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
              >
                {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
              </button>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
