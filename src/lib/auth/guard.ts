// Write access to shared data (docs/auth-plan.md). Server-only.
//
// Browsing is open, but every create/update/delete of shared records requires
// a registered account (a profiles row, i.e. someone who signed up with the
// registration code). Server actions are public POST endpoints, so hiding the
// edit UI is not enough: each action must check this itself.

import { redirect } from "next/navigation";
import { getCurrentUserId } from "./session";

export const NOT_SIGNED_IN = "Sign in with a registered account to change data.";

// For server actions: null when allowed, otherwise a failed ActionResult.
export async function requireContributor(): Promise<{ ok: false; error: string } | null> {
  return (await getCurrentUserId()) ? null : { ok: false, error: NOT_SIGNED_IN };
}

// For edit pages: sends signed-out visitors to sign in, then back.
export async function requireContributorPage(next: string): Promise<void> {
  if (!(await getCurrentUserId())) redirect(`/login?next=${encodeURIComponent(next)}`);
}
