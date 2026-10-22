"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { electionSchema, type ElectionInput } from "../validation/election";
import * as electionsDb from "../db/elections";
import { actionFailure, validationFailure, type ActionResult } from "./result";

export async function createElectionAction(input: ElectionInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const election = await electionsDb.createElection(parsed.data);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: election.id } };
  } catch (err) {
    return actionFailure("elections.create", err);
  }
}

export async function updateElectionAction(id: string, input: ElectionInput): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const election = await electionsDb.updateElection(id, parsed.data);
    if (!election) return { ok: false, error: "Election not found" };
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: election.id } };
  } catch (err) {
    return actionFailure("elections.update", err);
  }
}

export async function deleteElectionAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await electionsDb.deleteElection(id);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("elections.delete", err);
  }
}
