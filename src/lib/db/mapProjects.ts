import { eq, and, desc, sql } from "drizzle-orm";
import { db } from "./client";
import { mapProjects } from "./schema";
import { CURRENT_MAP_PROJECT_VERSION, migrateMapProjectDocument, type MapProject, type MapProjectInput } from "../validation/mapProject";
import { toPublicMapProject, type PublicMapProject } from "@/lib/map/publicProject";

function toMapProject(row: typeof mapProjects.$inferSelect): MapProject {
  const migrated = migrateMapProjectDocument({
    documentVersion: row.documentVersion,
    mapView: row.mapView,
    layers: row.layers,
  });
  return {
    id: row.id,
    ownerId: row.ownerId,
    documentVersion: migrated.documentVersion,
    name: row.name,
    mapView: migrated.mapView,
    layers: migrated.layers,
    liveValues: (row.liveValues ?? {}) as Record<string, string>,
    isPublished: row.isPublished,
    shareToken: row.shareToken,
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

export async function createMapProject(
  ownerId: string,
  input: MapProjectInput,
): Promise<MapProject> {
  const [row] = await db
    .insert(mapProjects)
    .values({
      ownerId,
      name: input.name,
      documentVersion: input.documentVersion ?? CURRENT_MAP_PROJECT_VERSION,
      mapView: input.mapView,
      layers: input.layers,
      liveValues: input.liveValues ?? {},
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
      documentVersion: CURRENT_MAP_PROJECT_VERSION,
      ...(patch.mapView !== undefined ? { mapView: patch.mapView } : {}),
      ...(patch.layers !== undefined ? { layers: patch.layers } : {}),
      ...(patch.liveValues !== undefined ? { liveValues: patch.liveValues } : {}),
      updatedAt: new Date(),
    })
    .where(and(eq(mapProjects.id, id), eq(mapProjects.ownerId, ownerId)))
    .returning();
  return row ? toMapProject(row) : null;
}

export async function getPublicMapProject(shareToken: string): Promise<PublicMapProject | null> {
  const row = await db.query.mapProjects.findFirst({
    where: and(eq(mapProjects.shareToken, shareToken), eq(mapProjects.isPublished, true)),
  });
  if (!row) return null;
  const project = toMapProject(row);
  return toPublicMapProject(project);
}

export async function setMapProjectPublished(id: string, ownerId: string, isPublished: boolean): Promise<MapProject | null> {
  const [row] = await db.update(mapProjects)
    .set({
      isPublished,
      // Disabling is a real revocation, not just a temporary visibility
      // toggle: rotate the capability so every previously copied URL dies.
      ...(!isPublished ? { shareToken: sql`gen_random_uuid()` } : {}),
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
