import { eq } from "drizzle-orm";
import { db } from "./client";
import { atlasProfiles } from "./schema";
import { EMPTY_ATLAS_PROFILE, type AtlasProfile, type EconomicProfileResult, type SpecialistProfileResult } from "../atlas/profile";

function cleanSaved(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((x): x is string => typeof x === "string"))].slice(0, 100);
}

export async function getAtlasProfile(ownerId: string): Promise<AtlasProfile> {
  const row = await db.query.atlasProfiles.findFirst({ where: eq(atlasProfiles.ownerId, ownerId) });
  if (!row) return EMPTY_ATLAS_PROFILE;
  return {
    savedPhilosophies: cleanSaved(row.savedPhilosophies),
    economicResult: (row.economicResult as EconomicProfileResult | null) ?? null,
    authorityResult: (row.authorityResult as SpecialistProfileResult | null) ?? null,
    foreignPolicyResult: (row.foreignPolicyResult as SpecialistProfileResult | null) ?? null,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function setSpecialistResult(ownerId: string, result: SpecialistProfileResult): Promise<void> {
  const field = result.assessment === "authority" ? "authorityResult" : "foreignPolicyResult";
  await db
    .insert(atlasProfiles)
    .values({ ownerId, [field]: result })
    .onConflictDoUpdate({ target: atlasProfiles.ownerId, set: { [field]: result, updatedAt: new Date() } });
}

export async function setSavedPhilosophy(ownerId: string, philosophyId: string, saved: boolean): Promise<string[]> {
  const current = await getAtlasProfile(ownerId);
  const next = saved
    ? [...new Set([...current.savedPhilosophies, philosophyId])]
    : current.savedPhilosophies.filter((id) => id !== philosophyId);
  await db
    .insert(atlasProfiles)
    .values({ ownerId, savedPhilosophies: next })
    .onConflictDoUpdate({ target: atlasProfiles.ownerId, set: { savedPhilosophies: next, updatedAt: new Date() } });
  return next;
}

export async function setEconomicResult(ownerId: string, result: EconomicProfileResult): Promise<void> {
  await db
    .insert(atlasProfiles)
    .values({ ownerId, economicResult: result })
    .onConflictDoUpdate({ target: atlasProfiles.ownerId, set: { economicResult: result, updatedAt: new Date() } });
}
