// Who is signed in (docs/auth.md). Server-only.
//
// A session counts once its Supabase user has a profiles row, which
// finalizeSignIn creates after the email is verified. What the account may
// change is its role's business (src/lib/auth/guard.ts).

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { createProfile, getProfile, type Profile } from "../db/profiles";

export interface CurrentUser {
  id: string;
  email: string | null;
  displayName: string | null;
  providers: string[];
  profile: Profile;
}

function providersOf(user: User): string[] {
  const ids = user.identities?.map((i) => i.provider) ?? [];
  return [...new Set(ids.length ? ids : [user.app_metadata?.provider ?? "email"])];
}

export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const profile = await getProfile(user.id);
  if (!profile) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    displayName: profile.displayName,
    providers: providersOf(user),
    profile,
  };
});

export async function getCurrentUserId(): Promise<string | null> {
  return (await getCurrentUser())?.id ?? null;
}

// Runs right after a session is established (password, emailed code, or the
// OAuth callback). First sign-in creates the profile; an unverified email —
// possible only while Supabase's "Confirm email" is off — still signs in, as
// Supabase itself allowed it.
export async function finalizeSignIn(): Promise<"ok" | "no_session"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "no_session";

  if (!(await getProfile(user.id))) {
    const meta = user.user_metadata ?? {};
    const name = (meta.full_name ?? meta.name ?? null) as string | null;
    await createProfile(user.id, name?.trim() || null);
  }
  return "ok";
}

// Only same-site relative paths, so ?next= can't bounce users off-site.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
