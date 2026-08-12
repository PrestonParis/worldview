"use server";

import { revalidatePath } from "next/cache";
import { entitySchema, type EntityInput } from "../validation/entity";
import * as entitiesDb from "../neo4j/entities";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export async function createEntityAction(
  input: EntityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = entitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const entity = await entitiesDb.createEntity(parsed.data);
    revalidatePath("/data");
    return { ok: true, data: { id: entity.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateEntityAction(
  id: string,
  input: EntityInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = entitySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const entity = await entitiesDb.updateEntity(id, parsed.data);
    if (!entity) return { ok: false, error: "Entity not found" };
    revalidatePath("/data");
    return { ok: true, data: { id: entity.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteEntityAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await entitiesDb.deleteEntity(id);
    revalidatePath("/data");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
