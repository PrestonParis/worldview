"use client";

import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/lib/store/useAppStore";

export function DataLegends() {
  const [collapsed, setCollapsed] = useState(false);
  const layers = useAppStore((s) => s.layers);
  const visible = layers.filter((layer) => layer.type === "data" && layer.visible && layer.data.legend.visible);
  if (!visible.length) return null;
  return (
    <div className="absolute bottom-16 right-3 z-10 max-w-56 rounded-lg border border-neutral-700 bg-neutral-950/90 text-xs text-neutral-200 shadow-lg backdrop-blur">
      <button type="button" onClick={() => setCollapsed((value) => !value)} className="flex w-full items-center justify-between gap-3 px-2.5 py-1.5 text-neutral-400 hover:text-neutral-100" aria-expanded={!collapsed}>
        <span>Legend · {visible.length}</span>
        {collapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
      </button>
      {!collapsed ? <div className="max-h-40 space-y-1.5 overflow-y-auto border-t border-neutral-800 p-2">
        {visible.map((layer) => layer.type === "data" && (
          <div key={layer.id} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.data.style.color, opacity: layer.data.style.opacity }} />
            <strong className="truncate font-medium" title={`${layer.data.legend.title} · ${layer.data.metadata.freshnessLabel}`}>{layer.data.legend.title}</strong>
          </div>
        ))}
      </div> : null}
    </div>
  );
}
