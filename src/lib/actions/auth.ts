"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "../supabase/server";
import { createAdminClient } from "../supabase/admin";
import { deleteUserData, updateDisplayName } from "../db/profiles";
import { finalizeSignIn, getCurrentUser, safeNext } from "../auth/session";
import { claimAfterSignIn } from "../quiz/access";
import type { ActionResult } from "./entities";

// Sign-in and registration (docs/auth-plan.md). Email + password is the main
// path. New accounts confirm their email with a 6-digit code when Supabase's
// "Confirm email" is on; a forgotten password is reset with an emailed code.

export type AuthMode = "signin" | "register";

// What the form shows next when an action doesn't redirect.
export type AuthStep = "verify" | "new_password";

async function requestOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

// Supabase's own wording for mail failures ("Error sending magic link email")
// means nothing to users; everything else it returns reads fine as-is.
function authErrorMessage(error: { message: string }): string {
  if (/error sending .*email/i.test(error.message)) {
    return "We couldn't send the email just now. Try again in a few minutes.";
  }
  if (/email rate limit exceeded/i.test(error.message)) {
    return "Too many emails sent recently. Wait a bit and try again.";
  }
  return error.message;
}

function normalizeEmail(email: string): string | null {
  const value = email.trim().toLowerCase();
  return z.email().safeParse(value).success ? value : null;
}

const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters for your password.")
  .max(72, "Use at most 72 characters for your password.");

async function finishSignIn(next: string | undefined): Promise<ActionResult<never>> {
  if ((await finalizeSignIn()) === "no_session") return { ok: false, error: "Sign-in didn't complete. Try again." };
  redirect(await claimAfterSignIn(safeNext(next)));
}

export async function passwordSignInAction(input: {
  email: string;
  password: string;
  next?: string;
  captchaToken?: string;
}): Promise<ActionResult<AuthStep>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  if (!input.password) return { ok: false, error: "Enter your password." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: input.password,
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    if (/invalid login credentials/i.test(error.message)) return { ok: false, error: "Wrong email or password." };
    // Registered but never entered the confirmation code: send a fresh one
    // (best effort; the first code may still be valid) and ask for it.
    if (/email not confirmed/i.test(error.message)) {
      await supabase.auth.resend({ type: "signup", email });
      return { ok: true, data: "verify" };
    }
    return { ok: false, error: authErrorMessage(error) };
  }
  return finishSignIn(input.next);
}

export async function passwordRegisterAction(input: {
  email: string;
  password: string;
  next?: string;
  captchaToken?: string;
}): Promise<ActionResult<AuthStep>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? "Invalid password." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password: password.data,
    options: { captchaToken: input.captchaToken },
  });
  if (error) {
    if (/already registered|already exists/i.test(error.message)) {
      return { ok: false, error: "An account with that email already exists. Sign in instead." };
    }
    return { ok: false, error: authErrorMessage(error) };
  }
  // "Confirm email" off: signed in already.
  if (data.session) return finishSignIn(input.next);
  // "Confirm email" on: Supabase emailed a code. An existing email comes back
  // with no identities and no email sent; the right password still signs in.
  if (data.user?.identities?.length) return { ok: true, data: "verify" };
  const retry = await supabase.auth.signInWithPassword({ email, password: password.data });
  if (!retry.error) return finishSignIn(input.next);
  return { ok: false, error: "An account with that email already exists. Sign in instead." };
}

export async function resendSignupCodeAction(input: { email: string }): Promise<ActionResult<null>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resend({ type: "signup", email });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true, data: null };
}

// Forgot password: email a code that signs the account in, then ask for a
// new password (setNewPasswordAction).
export async function sendResetCodeAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: false, captchaToken: input.captchaToken },
  });
  if (error) {
    if (/signups? not allowed/i.test(error.message)) return { ok: false, error: "No account uses that email." };
    return { ok: false, error: authErrorMessage(error) };
  }
  return { ok: true, data: null };
}

// Checks an emailed code: a sign-up confirmation finishes signing in; a reset
// code moves on to choosing a new password.
export async function verifyEmailCodeAction(input: {
  email: string;
  token: string;
  purpose: "confirm" | "reset";
  next?: string;
}): Promise<ActionResult<AuthStep>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const token = input.token.replace(/\s/g, "");
  if (!/^\d{6,10}$/.test(token)) return { ok: false, error: "Enter the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) return { ok: false, error: "That code is wrong or has expired. Request a new one." };
  if (input.purpose === "reset") return { ok: true, data: "new_password" };
  return finishSignIn(input.next);
}

export async function setNewPasswordAction(input: { password: string; next?: string }): Promise<ActionResult<never>> {
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? "Invalid password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (/session/i.test(error.message)) return { ok: false, error: "The reset code expired. Start over." };
    return { ok: false, error: authErrorMessage(error) };
  }
  return finishSignIn(input.next);
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

export async function googleSignInAction(input: { next?: string }): Promise<ActionResult<null>> {
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
