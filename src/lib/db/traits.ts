import { eq } from "drizzle-orm";
import { db } from "./client";
import { entityTraits } from "./schema";
import { groupTraits, type PersonTraits, type TraitRow } from "../people/traits";

// Every person's traits, grouped for the People page's attribute filters.
export async function listPersonTraits(): Promise<Map<string, PersonTraits>> {
  const rows = await db
    .select({ entityId: entityTraits.entityId, trait: entityTraits.trait, value: entityTraits.value })
    .from(entityTraits);
  return groupTraits(rows);
}

export async function listEntityTraits(entityId: string): Promise<TraitRow[]> {
  return db
    .select({
      entityId: entityTraits.entityId,
      trait: entityTraits.trait,
      value: entityTraits.value,
      detail: entityTraits.detail,
      source: entityTraits.source,
      sourceUrl: entityTraits.sourceUrl,
    })
    .from(entityTraits)
    .where(eq(entityTraits.entityId, entityId));
}
