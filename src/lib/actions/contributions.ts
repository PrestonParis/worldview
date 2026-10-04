"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { contributionSchema, type ContributionInput } from "../validation/contribution";
import * as contributionsDb from "../db/contributions";
import type { ActionResult } from "./entities";

export async function createContributionAction(
  input: ContributionInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = contributionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const contribution = await contributionsDb.createContribution(parsed.data);
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: { id: contribution.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
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
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const contribution = await contributionsDb.updateContribution(id, parsed.data);
    if (!contribution) return { ok: false, error: "Contribution not found" };
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: { id: contribution.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteContributionAction(
  id: string,
): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await contributionsDb.deleteContribution(id);
    revalidatePath("/data");
    revalidatePath("/money");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
