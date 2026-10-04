"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { claimSchema, type ClaimInput } from "../validation/claim";
import * as claimsDb from "../db/claims";
import type { ActionResult } from "./entities";

export async function createClaimAction(
  input: ClaimInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const claim = await claimsDb.createClaim(parsed.data);
    revalidatePath("/data");
    return { ok: true, data: { id: claim.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateClaimAction(
  id: string,
  input: ClaimInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = claimSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const claim = await claimsDb.updateClaim(id, parsed.data);
    if (!claim) return { ok: false, error: "Claim not found" };
    revalidatePath("/data");
    return { ok: true, data: { id: claim.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteClaimAction(
  id: string,
): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await claimsDb.deleteClaim(id);
    revalidatePath("/data");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
