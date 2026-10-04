import { eq } from "drizzle-orm";
import { db } from "./client";
import { mapProjects, profiles, quizSessions } from "./schema";

export interface Profile {
  id: string;
  displayName: string | null;
  registeredAt: string;
}

function toProfile(row: typeof profiles.$inferSelect): Profile {
  return {
    id: row.id,
    displayName: row.displayName,
    registeredAt: row.registeredAt.toISOString(),
  };
}

export async function getProfile(id: string): Promise<Profile | null> {
  const row = await db.query.profiles.findFirst({ where: eq(profiles.id, id) });
  return row ? toProfile(row) : null;
}

export async function createProfile(id: string, displayName: string | null): Promise<void> {
  await db.insert(profiles).values({ id, displayName }).onConflictDoNothing();
}

export async function updateDisplayName(id: string, displayName: string | null): Promise<void> {
  await db.update(profiles).set({ displayName }).where(eq(profiles.id, id));
}

// Everything a user owns, for account deletion. The auth.users row itself is
// removed separately through the Supabase admin API.
export async function deleteUserData(id: string): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(mapProjects).where(eq(mapProjects.ownerId, id));
    await tx.delete(quizSessions).where(eq(quizSessions.ownerId, id));
    await tx.delete(profiles).where(eq(profiles.id, id));
  });
}
