"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { sourceSchema, type SourceInput } from "../validation/source";
import * as sourcesDb from "../db/sources";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createSourceAction(input: SourceInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const source = await sourcesDb.createSource(parsed.data);
    revalidatePath("/data");
    return { ok: true, data: { id: source.id } };
  } catch (err) {
    return actionFailure("sources.create", err);
  }
}

export async function updateSourceAction(id: string, input: SourceInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const source = await sourcesDb.updateSource(id, parsed.data);
    if (!source) return { ok: false, error: "Source not found" };
    revalidatePath("/data");
    return { ok: true, data: { id: source.id } };
  } catch (err) {
    return actionFailure("sources.update", err);
  }
}

export async function deleteSourceAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await sourcesDb.deleteSource(id);
    revalidatePath("/data");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("sources.delete", err);
  }
}
