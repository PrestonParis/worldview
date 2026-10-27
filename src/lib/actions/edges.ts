"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { edgeSchema, type EdgeInput } from "../validation/edge";
import * as edgesDb from "../db/edges";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createEdgeAction(input: EdgeInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = edgeSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const edge = await edgesDb.createEdge(parsed.data);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: { id: edge.id } };
  } catch (err) {
    return actionFailure("edges.create", err);
  }
}

export async function deleteEdgeAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await edgesDb.deleteEdge(id);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("edges.delete", err);
  }
}
