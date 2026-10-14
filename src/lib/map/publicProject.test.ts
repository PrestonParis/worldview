import { describe, expect, it } from "vitest";
import { createDefaultLayers } from "@/lib/store/layersSlice";
import { createDefaultMapView } from "@/lib/store/mapViewSlice";
import type { MapProject } from "@/lib/validation/mapProject";
import { toPublicMapProject } from "./publicProject";

describe("public map projects", () => {
  it("never exposes owner or publication credentials", () => {
    const project: MapProject = {
      id: "project-id", ownerId: "owner-id", documentVersion: 3, name: "Live",
      mapView: createDefaultMapView(), layers: createDefaultLayers(), liveValues: {},
      isPublished: true, shareToken: "secret-token", createdAt: "created", updatedAt: "updated",
    };
    const publicProject = toPublicMapProject(project);
    expect(publicProject).not.toHaveProperty("ownerId");
    expect(publicProject).not.toHaveProperty("shareToken");
    expect(publicProject).not.toHaveProperty("isPublished");
    expect(publicProject.name).toBe("Live");
  });
});
