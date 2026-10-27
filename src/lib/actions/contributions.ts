"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { contributionSchema, type ContributionInput } from "../validation/contribution";
import * as contributionsDb from "../db/contributions";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createContributionAction(input: ContributionInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const contribution = await contributionsDb.createContribution(parsed.data);
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: { id: contribution.id } };
  } catch (err) {
    return actionFailure("contributions.create", err);
  }
}

export async function updateContributionAction(
  id: string,
  input: ContributionInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const contribution = await contributionsDb.updateContribution(id, parsed.data);
    if (!contribution) return { ok: false, error: "Contribution not found" };
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: { id: contribution.id } };
  } catch (err) {
    return actionFailure("contributions.update", err);
  }
}

export async function deleteContributionAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await contributionsDb.deleteContribution(id);
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("contributions.delete", err);
  }
}
