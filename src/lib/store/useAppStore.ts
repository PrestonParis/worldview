import { create } from "zustand";
import { createMapViewSlice, type MapViewSlice } from "./mapViewSlice";
import { createLayersSlice, type LayersSlice } from "./layersSlice";
import { createToolSlice, type ToolSlice } from "./toolSlice";
import { createProjectSlice, type ProjectSlice } from "./projectSlice";

export type AppState = MapViewSlice & LayersSlice & ToolSlice & ProjectSlice;

// Undo/redo (zundo) will wrap the layers/annotation portion of this store
// once real annotation content lands in Phase 2 — see build plan Phase 5.
export const useAppStore = create<AppState>()((...a) => ({
  ...createMapViewSlice(...a),
  ...createLayersSlice(...a),
  ...createToolSlice(...a),
  ...createProjectSlice(...a),
}));
