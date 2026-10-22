"use server";

import { getCurrentUser } from "../auth/session";
import { deleteSavedGovernment, setSavedGovernment } from "../db/savedGovernments";
import { savedGovernmentSchema, type SavedGovernment } from "../my-government/saved";
import type { ActionResult } from "./result";
import { actionFailure } from "./result";

export async function saveGovernmentAction(input: SavedGovernment): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to keep your government across devices." };
  const parsed = savedGovernmentSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That result could not be saved." };
  try {
    await setSavedGovernment(user.id, parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure("save-government", error);
  }
}

export async function clearGovernmentAction(): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to change your saved government." };
  try {
    await deleteSavedGovernment(user.id);
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure("clear-government", error);
  }
}
