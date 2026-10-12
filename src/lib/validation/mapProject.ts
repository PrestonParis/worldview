import { z } from "zod";
import type { MapViewState, Layer } from "@/lib/types";

// mapView/layers are the editor's own internal state (see
// src/lib/types.ts), serialized straight out of the zustand store — never
// hand-typed by a user into a form field the way an entity/claim/source is.
// Deep structural validation here would just duplicate those types for
// little real benefit, so this only checks each is an object and caps the
// layer count, keeping full TS type safety.
export const mapProjectSchema = z.object({
  id: z.uuid().optional(),
  name: z.string().min(1, "Name is required").max(200),
  mapView: z.custom<MapViewState>((value) => typeof value === "object" && value !== null),
  layers: z.array(z.custom<Layer>((value) => typeof value === "object" && value !== null)).max(2000, "Too many layers"),
});

export type MapProjectInput = z.infer<typeof mapProjectSchema>;

export interface MapProject {
  id: string;
  ownerId: string;
  name: string;
  mapView: MapViewState;
  layers: Layer[];
  createdAt: string;
  updatedAt: string;
}
