"use server";

import { revalidatePath } from "next/cache";
import { edgeSchema, type EdgeInput } from "../validation/edge";
import * as edgesDb from "../neo4j/edges";
import type { ActionResult } from "./entities";

export async function createEdgeAction(
  input: EdgeInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = edgeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const edge = await edgesDb.createEdge(parsed.data);
    revalidatePath("/data");
    return { ok: true, data: { id: edge.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteEdgeAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await edgesDb.deleteEdge(id);
    revalidatePath("/data");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
