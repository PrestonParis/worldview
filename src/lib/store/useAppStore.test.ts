import { beforeEach, describe, expect, it } from "vitest";
import { createDefaultLayers } from "./layersSlice";
import {
  beginLayerHistoryTransaction,
  endLayerHistoryTransaction,
  useAppStore,
} from "./useAppStore";

describe("layer history transactions", () => {
  beforeEach(() => {
    useAppStore.getState().setLayers(createDefaultLayers());
    useAppStore.temporal.getState().clear();
  });

  it("groups a continuous range gesture into one undo step", () => {
    beginLayerHistoryTransaction();
    useAppStore.getState().updateLayer("map-base", { opacity: 0.8 });
    useAppStore.getState().updateLayer("map-base", { opacity: 0.4 });
    endLayerHistoryTransaction();

    expect(useAppStore.temporal.getState().pastStates).toHaveLength(1);
    expect(useAppStore.getState().layers[0].opacity).toBe(0.4);

    useAppStore.temporal.getState().undo();
    expect(useAppStore.getState().layers[0].opacity).toBe(1);
  });
});
