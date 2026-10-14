import type { MapProject } from "@/lib/validation/mapProject";

export type PublicMapProject = Pick<
  MapProject,
  "documentVersion" | "name" | "mapView" | "layers" | "liveValues" | "updatedAt"
>;

export function toPublicMapProject(project: MapProject): PublicMapProject {
  return {
    documentVersion: project.documentVersion,
    name: project.name,
    mapView: project.mapView,
    layers: project.layers,
    liveValues: project.liveValues,
    updatedAt: project.updatedAt,
  };
}
