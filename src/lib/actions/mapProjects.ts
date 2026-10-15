"use server";

import { revalidatePath } from "next/cache";
import { mapProjectPatchSchema, mapProjectSchema, type MapProjectInput, type MapProject } from "../validation/mapProject";
import * as mapProjectsDb from "../db/mapProjects";
import { getCurrentUser } from "../auth/session";
import { isOwner } from "../auth/guard";
import type { ActionResult } from "./entities";

// Every action re-derives the owner from the authenticated session server
// side rather than trusting a client-supplied id — the client can't spoof
// whose graphics it's reading or writing. The studio is owner-only, so any
// other account is treated as signed out.
async function requireUserId(): Promise<string | null> {
  const user = await getCurrentUser();
  return isOwner(user) ? user!.id : null;
}

export async function listMapProjectsAction(): Promise<ActionResult<MapProject[]>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  try {
    const projects = await mapProjectsDb.listMapProjects(userId);
    return { ok: true, data: projects };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function createMapProjectAction(
  input: MapProjectInput,
): Promise<ActionResult<MapProject>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const parsed = mapProjectSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    const project = await mapProjectsDb.createMapProject(userId, parsed.data);
    revalidatePath("/geography");
    return { ok: true, data: project };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function updateMapProjectAction(
  id: string,
  patch: Partial<MapProjectInput>,
): Promise<ActionResult<MapProject>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  const parsed = mapProjectPatchSchema.safeParse(patch);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    // No revalidatePath: the studio is client state, and this runs on every autosave.
    const project = await mapProjectsDb.updateMapProject(id, userId, parsed.data);
    if (!project) return { ok: false, error: "Graphic not found." };
    return { ok: true, data: project };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function deleteMapProjectAction(id: string): Promise<ActionResult<null>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  try {
    await mapProjectsDb.deleteMapProject(id, userId);
    revalidatePath("/geography");
    return { ok: true, data: null };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function setMapProjectPublishedAction(
  id: string,
  isPublished: boolean,
): Promise<ActionResult<MapProject>> {
  const userId = await requireUserId();
  if (!userId) return { ok: false, error: "Not signed in." };
  try {
    const project = await mapProjectsDb.setMapProjectPublished(id, userId, isPublished);
    if (!project) return { ok: false, error: "Graphic not found." };
    return { ok: true, data: project };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}
