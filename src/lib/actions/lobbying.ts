"use server";

import { requireContributor } from "../auth/guard";
import { revalidatePath } from "next/cache";
import { lobbyingRegistrationSchema, type LobbyingRegistrationInput } from "../validation/lobbying";
import * as lobbyingDb from "../db/lobbying";
import { actionFailure, validationFailure, type ActionResult } from "./result";

function revalidate() {
  revalidatePath("/data");
  revalidatePath("/money");
  revalidatePath("/money/lobbying");
}

export async function createLobbyingRegistrationAction(
  input: LobbyingRegistrationInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = lobbyingRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const reg = await lobbyingDb.createLobbyingRegistration(parsed.data);
    revalidate();
    return { ok: true, data: { id: reg.id } };
  } catch (err) {
    return actionFailure("lobbying.create", err);
  }
}

export async function updateLobbyingRegistrationAction(
  id: string,
  input: LobbyingRegistrationInput,
): Promise<ActionResult<{ id: string }>> {
  const denied = await requireContributor();
  if (denied) return denied;
  const parsed = lobbyingRegistrationSchema.safeParse(input);
  if (!parsed.success) {
    return validationFailure(parsed.error);
  }
  try {
    const reg = await lobbyingDb.updateLobbyingRegistration(id, parsed.data);
    if (!reg) return { ok: false, error: "Registration not found" };
    revalidate();
    return { ok: true, data: { id: reg.id } };
  } catch (err) {
    return actionFailure("lobbying.update", err);
  }
}

export async function deleteLobbyingRegistrationAction(id: string): Promise<ActionResult<null>> {
  const denied = await requireContributor();
  if (denied) return denied;
  try {
    await lobbyingDb.deleteLobbyingRegistration(id);
    revalidate();
    return { ok: true, data: null };
  } catch (err) {
    return actionFailure("lobbying.delete", err);
  }
}
