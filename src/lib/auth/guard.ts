// Write access to shared data (docs/auth-plan.md). Server-only.
//
// Browsing is open and anyone can create an account, but every
// create/update/delete of shared records requires an editor (profiles.role).
// Server actions are public POST endpoints, so hiding the edit UI is not
// enough: each action must check this itself.

import { notFound, redirect } from "next/navigation";
import { getCurrentUser, type CurrentUser } from "./session";

export const NOT_SIGNED_IN = "Sign in with an editor account to change data.";
export const NOT_EDITOR = "Your account can't change shared data. Ask an editor for access.";

export function isEditor(user: CurrentUser | null): boolean {
  return user?.profile.role === "editor";
}

// The site owner (OWNER_EMAIL), the only account that may use the Geography
// studio. Unset means nobody.
export function isOwner(user: CurrentUser | null): boolean {
  const owner = process.env.OWNER_EMAIL?.trim().toLowerCase();
  return Boolean(owner && user?.email?.toLowerCase() === owner);
}

export async function currentUserIsOwner(): Promise<boolean> {
  return isOwner(await getCurrentUser().catch(() => null));
}

// For owner-only pages: signed-out visitors go to sign in, everyone else gets a 404.
export async function requireOwnerPage(next: string): Promise<CurrentUser> {
  const user = await getCurrentUser().catch(() => null);
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isOwner(user)) notFound();
  return user;
}

// For server actions: null when allowed, otherwise a failed ActionResult.
export async function requireContributor(): Promise<{ ok: false; error: string } | null> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: NOT_SIGNED_IN };
  return isEditor(user) ? null : { ok: false, error: NOT_EDITOR };
}

// For edit pages: sends signed-out visitors to sign in, then back, and
// members to the read-only page the editor sits under.
export async function requireContributorPage(next: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(next)}`);
  if (!isEditor(user)) redirect(next.replace(/\/edit\/?$/, "") || "/");
}
