import type { StateCreator } from "zustand";
import type { ArrowStyle, Layer, LayerBase, ShapeStyle, TextStyle } from "@/lib/types";

export interface LayersSlice {
  layers: Layer[];
  activeLayerId: string | null;
  addLayer: (layer: Layer) => void;
  removeLayer: (id: string) => void;
  updateLayer: (id: string, patch: Partial<Omit<LayerBase, "id">>) => void;
  // Geometry and style live on the type-specific branches of the Layer
  // union, not LayerBase — separate actions instead of fighting
  // Partial<union> typing for what's really just a targeted merge.
  // (updateLayerGeometry also doubles as the generic "patch any field on
  // this layer" escape hatch — e.g. text content isn't really "geometry"
  // but reuses it rather than adding a near-identical action.)
  updateLayerGeometry: (id: string, geometry: Partial<Layer>) => void;
  updateLayerStyle: (id: string, style: Partial<ShapeStyle | ArrowStyle | TextStyle>) => void;
  reorderLayers: (orderedIds: string[]) => void;
  // Swaps a layer with its immediate neighbor in stacking order ("forward"
  // = toward the front/rendered-last, "backward" = toward the back). A
  // no-op if the layer is already at that end, or if the swap would cross
  // the locked base "map" layer, which always stays furthest back.
  moveLayer: (id: string, direction: "forward" | "backward") => void;
  duplicateLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
  // Wholesale replace, for loading a saved graphic.
  setLayers: (layers: Layer[]) => void;
}

// A fresh array/object each call, for the same reason createDefaultMapView
// is a function and not a shared constant — see there.
export function createDefaultLayers(): Layer[] {
  return [
    {
      id: "map-base",
      name: "Map",
      type: "map",
      visible: true,
      locked: true,
      opacity: 1,
      order: 0,
      parentGroupId: null,
    },
  ];
}

export const createLayersSlice: StateCreator<LayersSlice> = (set, get) => ({
  layers: createDefaultLayers(),
  activeLayerId: null,
  addLayer: (layer) => set((s) => ({ layers: [...s.layers, layer] })),
  removeLayer: (id) =>
    set((s) => ({ layers: s.layers.filter((l) => l.id !== id) })),
  updateLayer: (id, patch) =>
    set((s) => ({
      layers: s.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    })),
  updateLayerGeometry: (id, geometry) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id ? ({ ...l, ...geometry } as Layer) : l
      ),
    })),
  updateLayerStyle: (id, style) =>
    set((s) => ({
      layers: s.layers.map((l) =>
        l.id === id && "style" in l
          ? ({ ...l, style: { ...l.style, ...style } } as Layer)
          : l
      ),
    })),
  reorderLayers: (orderedIds) =>
    set((s) => ({
      layers: orderedIds
        .map((id, index) => {
          const layer = s.layers.find((l) => l.id === id);
          return layer ? { ...layer, order: index } : null;
        })
        .filter((l): l is Layer => l !== null),
    })),
  moveLayer: (id, direction) =>
    set((s) => {
      // Ascending: index 0 = furthest back, last index = frontmost.
      const sorted = [...s.layers].sort((a, b) => a.order - b.order);
      const index = sorted.findIndex((l) => l.id === id);
      if (index === -1) return {};
      const targetIndex = direction === "forward" ? index + 1 : index - 1;
      if (targetIndex < 0 || targetIndex >= sorted.length) return {};
      const current = sorted[index];
      const target = sorted[targetIndex];
      if (current.type === "map" || target.type === "map") return {};
      const swapped = sorted.slice();
      swapped[index] = target;
      swapped[targetIndex] = current;
      // Renumber `order` to match array position — self-healing, so order
      // values never drift or collide across repeated moves.
      const orderById = new Map(swapped.map((l, i) => [l.id, i]));
      return {
        layers: s.layers.map((l) => ({ ...l, order: orderById.get(l.id) ?? l.order })),
      };
    }),
  duplicateLayer: (id) => {
    const layer = get().layers.find((l) => l.id === id);
    if (!layer) return;
    const copy: Layer = {
      ...layer,
      id: crypto.randomUUID(),
      name: `${layer.name} copy`,
      order: get().layers.length,
    };
    set((s) => ({ layers: [...s.layers, copy] }));
  },
  setActiveLayer: (id) => set({ activeLayerId: id }),
  setLayers: (layers) => set({ layers, activeLayerId: null }),
});
