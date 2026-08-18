"use server";

import { revalidatePath } from "next/cache";
import { voteSchema, type VoteInput } from "../validation/vote";
import * as votesDb from "../db/votes";
import type { ActionResult } from "./entities";

export async function createVoteAction(
  input: VoteInput,
): Promise<ActionResult<{ id: string }>> {
  const parsed = voteSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const vote = await votesDb.createVote(parsed.data);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: { id: vote.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteVoteAction(
  id: string,
): Promise<ActionResult<null>> {
  try {
    await votesDb.deleteVote(id);
    revalidatePath("/data");
    revalidatePath("/legislation");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
