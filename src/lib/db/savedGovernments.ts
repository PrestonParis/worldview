import { eq } from "drizzle-orm";
import { db } from "./client";
import { savedGovernments } from "./schema";
import { parseSavedGovernment, type SavedGovernment } from "../my-government/saved";

export async function getSavedGovernment(ownerId: string): Promise<SavedGovernment | null> {
  const row = await db.query.savedGovernments.findFirst({ where: eq(savedGovernments.ownerId, ownerId) });
  return row ? parseSavedGovernment(row.data) : null;
}

export async function setSavedGovernment(ownerId: string, data: SavedGovernment): Promise<void> {
  await db
    .insert(savedGovernments)
    .values({ ownerId, data })
    .onConflictDoUpdate({ target: savedGovernments.ownerId, set: { data, updatedAt: new Date() } });
}

export async function deleteSavedGovernment(ownerId: string): Promise<void> {
  await db.delete(savedGovernments).where(eq(savedGovernments.ownerId, ownerId));
}
