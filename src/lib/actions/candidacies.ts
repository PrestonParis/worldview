"use server";

import { revalidatePath } from "next/cache";
import { candidacySchema, type CandidacyInput } from "../validation/candidacy";
import * as candidaciesDb from "../db/candidacies";
import type { ActionResult } from "./entities";

export async function createCandidacyAction(
  input: CandidacyInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = candidacySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const candidacy = await candidaciesDb.createCandidacy(parsed.data);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: candidacy.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateCandidacyAction(
  id: string,
  input: CandidacyInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = candidacySchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const candidacy = await candidaciesDb.updateCandidacy(id, parsed.data);
    if (!candidacy) return { ok: false, error: "Candidacy not found" };
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: candidacy.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteCandidacyAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await candidaciesDb.deleteCandidacy(id);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
