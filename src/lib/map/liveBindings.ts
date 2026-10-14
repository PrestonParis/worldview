import type { Layer } from "@/lib/types";

export function resolveLayerBindings(layer: Layer, liveValues: Record<string, string>): Layer {
  const bindings = layer.bindings;
  if (!bindings) return layer;
  let resolved = layer;
  const text = bindings.text ? liveValues[bindings.text] : undefined;
  if (text !== undefined && (layer.type === "text" || layer.type === "composition")) {
    resolved = { ...resolved, text } as Layer;
  }
  const color = bindings.color ? liveValues[bindings.color] : undefined;
  if (color && "style" in resolved && "color" in resolved.style) {
    resolved = { ...resolved, style: { ...resolved.style, color } } as Layer;
  }
  return resolved;
}
