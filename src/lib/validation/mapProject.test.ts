import { describe, expect, it } from "vitest";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import { createDataLayer, DATA_PROVIDERS } from "@/lib/map/dataLayers";
import { createCompositionLayer, createImageLayer } from "@/lib/map/composition";
import { CURRENT_MAP_PROJECT_VERSION, mapProjectPatchSchema, mapProjectSchema, migrateMapProjectDocument } from "./mapProject";

describe("map project documents", () => {
  it("migrates an unversioned project to the current version", () => {
    const migrated = migrateMapProjectDocument({ mapView: createDefaultMapView(), layers: createDefaultLayers() });
    expect(migrated.documentVersion).toBe(CURRENT_MAP_PROJECT_VERSION);
    expect(migrated.layers[0].type).toBe("map");
  });

  it("validates persisted data-layer configuration", () => {
    const provider = DATA_PROVIDERS.find((item) => item.id === "usgs-earthquakes")!;
    const parsed = mapProjectSchema.safeParse({
      name: "Live earthquakes",
      mapView: createDefaultMapView(),
      layers: [...createDefaultLayers(), createDataLayer(provider, 1, { window: "day", minMagnitude: 4 })],
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.documentVersion).toBe(CURRENT_MAP_PROJECT_VERSION);
  });

  it("validates live AIS, composition text, and embedded image layers", () => {
    const ais = DATA_PROVIDERS.find((item) => item.id === "ais-ships")!;
    const parsed = mapProjectSchema.safeParse({
      name: "Shipping explainer",
      mapView: createDefaultMapView(),
      layers: [
        ...createDefaultLayers(),
        createDataLayer(ais, 1, { updatedWithinMinutes: 15, minimumSpeed: 2 }),
        createCompositionLayer("title", 2),
        createImageLayer("data:image/png;base64,iVBORw0KGgo=", { width: 100, height: 50 }, 3),
      ],
    });
    expect(parsed.success).toBe(true);
  });

  it("validates bounded live values and layer bindings", () => {
    const title = createCompositionLayer("title", 1);
    title.bindings = { text: "headline", color: "alert_color" };
    const parsed = mapProjectSchema.safeParse({
      name: "Live lower third",
      mapView: createDefaultMapView(),
      layers: [...createDefaultLayers(), title],
      liveValues: { headline: "Election called", alert_color: "#dc2626" },
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.liveValues.headline).toBe("Election called");
  });

  it("does not inject live-value defaults into partial updates", () => {
    const patch = mapProjectPatchSchema.parse({ name: "Renamed" });
    expect(patch.liveValues).toBeUndefined();
  });

  it("rejects malformed geometry instead of trusting arbitrary objects", () => {
    const invalid = { ...createDefaultLayers()[0], type: "circle", center: [999, 0], radiusMeters: -1, style: {} };
    expect(mapProjectSchema.safeParse({ name: "Broken", mapView: createDefaultMapView(), layers: [invalid] }).success).toBe(false);
  });
});
