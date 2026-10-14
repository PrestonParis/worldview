"use client";

import { useAppStore } from "@/lib/store/useAppStore";

export function DataLegends() {
  const layers = useAppStore((s) => s.layers);
  const visible = layers.filter((layer) => layer.type === "data" && layer.visible && layer.data.legend.visible);
  if (!visible.length) return null;
  return (
    <div className="absolute bottom-14 right-3 z-10 max-w-64 space-y-1.5 rounded-md border border-neutral-700 bg-neutral-950/90 p-2 text-xs text-neutral-200 shadow-lg backdrop-blur">
      {visible.map((layer) => layer.type === "data" && (
        <div key={layer.id} className="flex items-start gap-2">
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: layer.data.style.color, opacity: layer.data.style.opacity }} />
          <span><strong className="font-medium">{layer.data.legend.title}</strong><br /><span className="text-neutral-500">{layer.data.metadata.freshnessLabel}</span></span>
        </div>
      ))}
    </div>
  );
}
