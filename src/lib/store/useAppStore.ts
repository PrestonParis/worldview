import { create, useStore } from "zustand";
import { temporal } from "zundo";
import { createMapViewSlice, type MapViewSlice } from "./mapViewSlice";
import { createLayersSlice, type LayersSlice } from "./layersSlice";
import { createToolSlice, type ToolSlice } from "./toolSlice";
import { createProjectSlice, type ProjectSlice } from "./projectSlice";

export type AppState = MapViewSlice & LayersSlice & ToolSlice & ProjectSlice;

// Undo/redo tracks only `layers` — map view (pan/zoom), the active tool,
// and project bookkeeping aren't things a broadcast graphic editor's
// undo history should step back through.
export const useAppStore = create<AppState>()(
  temporal(
    (...a) => ({
      ...createMapViewSlice(...a),
      ...createLayersSlice(...a),
      ...createToolSlice(...a),
      ...createProjectSlice(...a),
    }),
    {
      partialize: (state) => ({ layers: state.layers }),
      limit: 100,
    }
  )
);

type LayerHistoryState = { layers: AppState["layers"] };
let layerTransactionStart: LayerHistoryState | null = null;

// Range inputs can emit dozens of changes during one pointer gesture. Pause
// zundo while the pointer is down and commit the pre-gesture snapshot once on
// release so a slider drag is one useful undo step.
export function beginLayerHistoryTransaction() {
  if (layerTransactionStart) return;
  layerTransactionStart = { layers: structuredClone(useAppStore.getState().layers) };
  useAppStore.temporal.getState().pause();
}

export function endLayerHistoryTransaction() {
  if (!layerTransactionStart) return;
  const start = layerTransactionStart;
  layerTransactionStart = null;
  useAppStore.temporal.getState().resume();
  if (JSON.stringify(start.layers) === JSON.stringify(useAppStore.getState().layers)) return;
  useAppStore.temporal.setState((history) => ({
    pastStates: [...history.pastStates, start].slice(-100),
    futureStates: [],
  }));
}

export const layerHistoryTransactionProps = {
  onPointerDown: beginLayerHistoryTransaction,
  onPointerUp: endLayerHistoryTransaction,
  onPointerCancel: endLayerHistoryTransaction,
};

// A thin React-facing wrapper around zundo's vanilla `.temporal` store —
// undo/redo actions plus derived canUndo/canRedo booleans (subscribing to
// pastStates/futureStates directly would re-render on every array identity
// change, which is fine here since these are only read by small toolbar
// buttons).
export function useTemporalStore() {
  const pastStates = useStore(useAppStore.temporal, (s) => s.pastStates);
  const futureStates = useStore(useAppStore.temporal, (s) => s.futureStates);
  return {
    undo: () => useAppStore.temporal.getState().undo(),
    redo: () => useAppStore.temporal.getState().redo(),
    canUndo: pastStates.length > 0,
    canRedo: futureStates.length > 0,
  };
}
