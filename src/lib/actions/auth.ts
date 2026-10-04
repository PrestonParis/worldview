"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { deleteUserData, updateDisplayName } from "../db/profiles";
import { finalizeSignIn, getCurrentUser, safeNext } from "../auth/session";
import { grantRegistrationPass, isValidRegistrationCode } from "../auth/registration";
import { claimAfterSignIn } from "../quiz/access";
import type { ActionResult } from "./entities";

// Sign-in and registration (docs/auth-plan.md). Everything runs server side so
// the registration code is checked before Supabase creates an account.
// Email + password is the main path; the emailed code is the fallback for a
// forgotten password or an account that never set one.

export type AuthMode = "signin" | "register";

const BAD_CODE = "That registration code isn't right.";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

const sendSchema = z.object({
  mode: z.enum(["signin", "register"]),
  email: z.email("Enter a valid email address."),
  registrationCode: z.string().optional(),
  captchaToken: z.string().optional(),
});

export async function sendEmailCodeAction(input: {
  mode: AuthMode;
  email: string;
  registrationCode?: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  const parsed = sendSchema.safeParse({ ...input, email: input.email.trim().toLowerCase() });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const { mode, email, registrationCode, captchaToken } = parsed.data;

  if (mode === "register") {
    if (!isValidRegistrationCode(registrationCode ?? "")) return { ok: false, error: BAD_CODE };
    await grantRegistrationPass();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: mode === "register", captchaToken },
  });
  if (error) {
    if (mode === "signin" && /signups? not allowed/i.test(error.message)) {
      return { ok: false, error: "No account uses that email. Create one with a registration code." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, data: null };
}

const NOT_REGISTERED =
  "That account isn't registered yet. Choose “Create account” and enter the registration code.";

export async function verifyEmailCodeAction(input: {
  email: string;
  token: string;
  next?: string;
}): Promise<ActionResult<null>> {
  const email = input.email.trim().toLowerCase();
  const token = input.token.replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { ok: false, error: "Enter the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false, error: "That code is wrong or has expired. Request a new one." };
  return finishSignIn(input.next);
}

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters for your password.")
  .max(72, "Use at most 72 characters for your password.");

async function finishSignIn(next: string | undefined, registering = false): Promise<ActionResult<null>> {
  const result = await finalizeSignIn({ registering });
  if (result === "not_registered") return { ok: false, error: NOT_REGISTERED };
  if (result === "no_session") return { ok: false, error: "Sign-in didn't complete. Try again." };
  redirect(await claimAfterSignIn(safeNext(next)));
}

export async function passwordSignInAction(input: {
  email: string;
  password: string;
  next?: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  const email = input.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { ok: false, error: "Enter a valid email address." };
  if (!input.password) return { ok: false, error: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) return { ok: false, error: "Wrong email or password." };
    return { ok: false, error: error.message };
  }
  return finishSignIn(input.next);
}

export async function passwordRegisterAction(input: {
  email: string;
  password: string;
  registrationCode: string;
  next?: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  if (!isValidRegistrationCode(input.registrationCode)) return { ok: false, error: BAD_CODE };
  const email = input.email.trim().toLowerCase();
  if (!z.email().safeParse(email).success) return { ok: false, error: "Enter a valid email address." };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? "Invalid password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: password.data,
    options: { captchaToken: input.captchaToken },
  });

  if (error || !data.session) {
    // Already has an auth account (e.g. an earlier sign-in that never got a
    // profile): the right password still gets them in and registered.
    const retry = await supabase.auth.signInWithPassword({ email, password: password.data });
    if (!retry.error) return finishSignIn(input.next, true);
    if (error && !/already registered|already exists/i.test(error.message)) return { ok: false, error: error.message };
    if (!error && !data.session && data.user?.identities?.length) {
      return {
        ok: false,
        error: "Supabase is set to require email confirmation. Turn off “Confirm email” in the Supabase Auth settings.",
      };
    }
    return { ok: false, error: "An account with that email already exists. Sign in instead." };
  }
  return finishSignIn(input.next, true);
}

export async function setPasswordAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const password = passwordSchema.safeParse(String(formData.get("password") ?? ""));
  if (!password.success) redirect("/account?error=password");
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  redirect(error ? "/account?error=password" : "/account?saved=password");
}

export async function googleSignInAction(input: {
  mode: AuthMode;
  registrationCode?: string;
  next?: string;
}): Promise<ActionResult<null>> {
  if (input.mode === "register") {
    if (!isValidRegistrationCode(input.registrationCode ?? "")) return { ok: false, error: BAD_CODE };
    await grantRegistrationPass();
  }

  const supabase = await createClient();
  const callback = `${await requestOrigin()}/auth/callback?next=${encodeURIComponent(safeNext(input.next))}`;
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: callback },
  });
  if (error || !data.url) return { ok: false, error: error?.message ?? "Couldn't reach Google." };
  redirect(data.url);
}

export async function updateDisplayNameAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  const name = String(formData.get("displayName") ?? "").trim().slice(0, 80);
  await updateDisplayName(user.id, name || null);
  revalidatePath("/account");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (String(formData.get("confirm") ?? "").trim().toLowerCase() !== "delete") {
    redirect("/account?error=confirm");
  }
  await deleteUserData(user.id);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) console.error("deleteAccountAction: auth user not removed", user.id, error.message);
  redirect("/");
}
