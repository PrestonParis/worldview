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
  duplicateLayer: (id: string) => void;
  setActiveLayer: (id: string | null) => void;
}

export const createLayersSlice: StateCreator<LayersSlice> = (set, get) => ({
  layers: [
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
  ],
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
});
