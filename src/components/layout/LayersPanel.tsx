"use client";

import { Eye, EyeOff, Lock, Unlock } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";

export function LayersPanel() {
  const layers = useAppStore((s) => s.layers);
  const activeLayerId = useAppStore((s) => s.activeLayerId);
  const setActiveLayer = useAppStore((s) => s.setActiveLayer);
  const updateLayer = useAppStore((s) => s.updateLayer);

  const sorted = [...layers].sort((a, b) => b.order - a.order);

  return (
    <aside className="flex w-64 shrink-0 flex-col border-l border-neutral-800 bg-neutral-950">
      <div className="border-b border-neutral-800 px-3 py-2">
        <h2 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
          Layers
        </h2>
      </div>
      <ul className="flex-1 overflow-y-auto">
        {sorted.map((layer) => (
          <li
            key={layer.id}
            onClick={() => setActiveLayer(layer.id)}
            className={`flex cursor-pointer items-center gap-2 border-b border-neutral-900 px-3 py-2 text-sm ${
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
            <span className="flex-1 truncate">{layer.name}</span>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                updateLayer(layer.id, { locked: !layer.locked });
              }}
              className="text-neutral-500 hover:text-neutral-100"
            >
              {layer.locked ? <Lock size={13} /> : <Unlock size={13} />}
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
