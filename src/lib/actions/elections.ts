"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { electionSchema, type ElectionInput } from "../validation/election";
import * as electionsDb from "../db/elections";
import type { ActionResult } from "./entities";

export async function createElectionAction(
  input: ElectionInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const election = await electionsDb.createElection(parsed.data);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: election.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateElectionAction(
  id: string,
  input: ElectionInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = electionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const election = await electionsDb.updateElection(id, parsed.data);
    if (!election) return { ok: false, error: "Election not found" };
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: { id: election.id } };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteElectionAction(
  id: string,
): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await electionsDb.deleteElection(id);
    revalidatePath("/data");
    revalidatePath("/elections");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
