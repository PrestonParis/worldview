"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { candidacySchema, type CandidacyInput } from "../validation/candidacy";
import * as candidaciesDb from "../db/candidacies";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createCandidacyAction(input: CandidacyInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = candidacySchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const candidacy = await candidaciesDb.createCandidacy(parsed.data);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: candidacy.id } };
  } catch (err) {
    return actionFailure("candidacies.create", err);
  }
}

export async function deleteCandidacyAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await candidaciesDb.deleteCandidacy(id);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("candidacies.delete", err);
  }
}
