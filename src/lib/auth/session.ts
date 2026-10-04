// Who is signed in (docs/auth-plan.md). Server-only.
//
// A Supabase session alone isn't enough: anyone can create an auth user with
// the public anon key, so only users with a profiles row (i.e. who registered
// with the registration code) count as signed in.

import { cache } from "react";
import type { User } from "@supabase/supabase-js";
import { createClient } from "../supabase/server";
import { createProfile, getProfile, type Profile } from "../db/profiles";
import { clearRegistrationPass, hasRegistrationPass } from "./registration";

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

// Runs right after a session is established (password, email code, or the
// OAuth callback). Existing accounts pass; new ones need the registration
// code — checked in this same request (`registering`) or carried across the
// OAuth redirect by the registration pass — otherwise the session is dropped.
export async function finalizeSignIn(
  { registering = false }: { registering?: boolean } = {},
): Promise<"ok" | "not_registered" | "no_session"> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return "no_session";

  if (await getProfile(user.id)) return "ok";

  if (registering || (await hasRegistrationPass())) {
    const meta = user.user_metadata ?? {};
    const name = (meta.full_name ?? meta.name ?? null) as string | null;
    await createProfile(user.id, name?.trim() || null);
    await clearRegistrationPass();
    return "ok";
  }

  await supabase.auth.signOut();
  return "not_registered";
}

// Only same-site relative paths, so ?next= can't bounce users off-site.
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}
