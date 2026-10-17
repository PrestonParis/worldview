"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { edgeSchema, type EdgeInput } from "../validation/edge";
import * as edgesDb from "../db/edges";
import type { ActionResult } from "./entities";

export async function createEdgeAction(
  input: EdgeInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = edgeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const edge = await edgesDb.createEdge(parsed.data);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: { id: edge.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteEdgeAction(
  id: string,
): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await edgesDb.deleteEdge(id);
    revalidatePath("/data");
    revalidatePath("/people", "layout");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
