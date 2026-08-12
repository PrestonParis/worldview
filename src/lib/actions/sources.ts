"use server";

import { revalidatePath } from "next/cache";
import { sourceSchema, type SourceInput } from "../validation/source";
import * as sourcesDb from "../db/sources";
import type { ActionResult } from "./entities";

export async function createSourceAction(
  input: SourceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const source = await sourcesDb.createSource(parsed.data);
    revalidatePath("/data");
    return { ok: true, data: { id: source.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateSourceAction(
  id: string,
  input: SourceInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = sourceSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const source = await sourcesDb.updateSource(id, parsed.data);
    if (!source) return { ok: false, error: "Source not found" };
    revalidatePath("/data");
    return { ok: true, data: { id: source.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteSourceAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await sourcesDb.deleteSource(id);
    revalidatePath("/data");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
