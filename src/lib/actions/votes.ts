"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { voteSchema, type VoteInput } from "../validation/vote";
import * as votesDb from "../db/votes";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createVoteAction(input: VoteInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const vote = await votesDb.createVote(parsed.data);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: vote.id } };
  } catch (err) {
    return actionFailure("votes.create", err);
  }
}

export async function deleteVoteAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await votesDb.deleteVote(id);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("votes.delete", err);
  }
}
