import { eq, and, desc } from "drizzle-orm";
import { db } from "./client";
import { mapProjects } from "./schema";
import type { MapProject, MapProjectInput } from "../validation/mapProject";
import type { MapViewState, Layer } from "../types";

function toMapProject(row: typeof mapProjects.$inferSelect): MapProject {
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    mapView: row.mapView as MapViewState,
    layers: row.layers as Layer[],
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMapProjects(ownerId: string): Promise<MapProject[]> {
  const rows = await db.query.mapProjects.findMany({
    where: eq(mapProjects.ownerId, ownerId),
    orderBy: desc(mapProjects.updatedAt),
  });
  return rows.map(toMapProject);
}

export async function getMapProject(
  id: string,
  ownerId: string,
): Promise<MapProject | null> {
  const row = await db.query.mapProjects.findFirst({
    where: and(eq(mapProjects.id, id), eq(mapProjects.ownerId, ownerId)),
  });
  return row ? toMapProject(row) : null;
}

export async function createMapProject(
  ownerId: string,
  input: MapProjectInput,
): Promise<MapProject> {
  const [row] = await db
    .insert(mapProjects)
    .values({
      ownerId,
      name: input.name,
      mapView: input.mapView,
      layers: input.layers,
    })
    .returning();
  return toMapProject(row);
}

export async function updateMapProject(
  id: string,
  ownerId: string,
  patch: Partial<MapProjectInput>,
): Promise<MapProject | null> {
  const [row] = await db
    .update(mapProjects)
    .set({
      ...(patch.name !== undefined ? { name: patch.name } : {}),
      ...(patch.mapView !== undefined ? { mapView: patch.mapView } : {}),
      ...(patch.layers !== undefined ? { layers: patch.layers } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(mapProjects.id, id), eq(mapProjects.ownerId, ownerId)))
    .returning();
  return row ? toMapProject(row) : null;
}

export async function deleteMapProject(id: string, ownerId: string): Promise<void> {
  await db
    .delete(mapProjects)
    .where(and(eq(mapProjects.id, id), eq(mapProjects.ownerId, ownerId)));
}
