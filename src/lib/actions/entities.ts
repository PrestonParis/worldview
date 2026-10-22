"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { entitySchema, type EntityInput } from "../validation/entity";
import * as entitiesDb from "../db/entities";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createEntityAction(input: EntityInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = entitySchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const entity = await entitiesDb.createEntity(parsed.data);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: { id: entity.id } };
  } catch (err) {
    return actionFailure("entities.create", err);
  }
}

export async function updateEntityAction(id: string, input: EntityInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = entitySchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const entity = await entitiesDb.updateEntity(id, parsed.data);
    if (!entity) return { ok: false, error: "Entity not found" };
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: { id: entity.id } };
  } catch (err) {
    return actionFailure("entities.update", err);
  }
}

export async function deleteEntityAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await entitiesDb.deleteEntity(id);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("entities.delete", err);
  }
}
