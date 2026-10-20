"use server";

import { getCurrentUser } from "../auth/session";
import { setEconomicResult, setSavedPhilosophy, setSpecialistResult } from "../db/atlasProfiles";
import { allTraditions } from "../quiz/ideologies";
import type { EconomicProfileResult, SpecialistProfileResult } from "../atlas/profile";
import { economicProfileSchema, specialistProfileSchema } from "../atlas/profile-schema";
import type { ActionResult } from "./result";
import { actionFailure } from "./result";

const ideologyIds = new Set(allTraditions.map((x) => x.id));

export async function savePhilosophyAction(id: string, saved: boolean): Promise<ActionResult<string[]>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to sync saved philosophies across devices." };
  if (!ideologyIds.has(id)) return { ok: false, error: "Unknown philosophy." };
  try {
    return { ok: true, data: await setSavedPhilosophy(user.id, id, saved) };
  } catch (error) {
    return actionFailure("save-philosophy", error);
  }
}

export async function saveEconomicResultAction(input: EconomicProfileResult): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to sync this result across devices." };
  const parsed = economicProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That result could not be saved." };
  try {
    await setEconomicResult(user.id, parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure("save-economic-result", error);
  }
}

export async function saveSpecialistResultAction(input: SpecialistProfileResult): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in to sync this result across devices." };
  const parsed = specialistProfileSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "That result could not be saved." };
  try {
    await setSpecialistResult(user.id, parsed.data);
    return { ok: true, data: null };
  } catch (error) {
    return actionFailure("save-specialist-result", error);
  }
}
