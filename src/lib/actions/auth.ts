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
import type { ActionResult } from "./result";

// Sign-in and registration (docs/auth-plan.md): Google, email + password, or
// a code emailed to the address (which also creates new accounts). New
// password accounts confirm their email with a code when Supabase's "Confirm
// email" is on; a forgotten password is reset with an emailed code.

export type AuthMode = "signin" | "register";

// What the form shows next when an action doesn't redirect.
export type AuthStep = "verify";

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
  const wait = error.message.match(/only request this after (\d+) seconds?/i);
  if (wait) return `Wait ${wait[1]} seconds before asking for another code.`;
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

// Email sign-in without a password ("Magic Link" template). An address with no
// account gets one, confirmed by the same code ("Confirm signup" template).
export async function sendSignInCodeAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, captchaToken: input.captchaToken },
  });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true, data: null };
}

// Forgot password: email a recovery code ("Reset Password" template) that
// signs the account in, then ask for a new password on /reset-password
// (setNewPasswordAction). Supabase answers the same whether or not an account
// uses the address, so the form doesn't say either.
export async function sendResetCodeAction(input: {
  email: string;
  captchaToken?: string;
}): Promise<ActionResult<null>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { captchaToken: input.captchaToken });
  return error ? { ok: false, error: authErrorMessage(error) } : { ok: true, data: null };
}

function codeFrom(input: string): string | null {
  const token = input.replace(/\s/g, "");
  return /^\d{6,10}$/.test(token) ? token : null;
}

const WRONG_CODE = "That code is wrong or has expired. Request a new one.";

// Checks an emailed code: a sign-up confirmation or sign-in code finishes
// signing in; a reset code goes to /reset-password. That step needs its own
// page: the code signs the account in, and /login sends signed-in visitors on
// to `next`.
export async function verifyEmailCodeAction(input: {
  email: string;
  token: string;
  purpose: "confirm" | "signin" | "reset";
  next?: string;
}): Promise<ActionResult<AuthStep>> {
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const token = codeFrom(input.token);
  if (!token) return { ok: false, error: "Enter the code from the email." };

  const supabase = await createClient();
  const type = input.purpose === "reset" ? "recovery" : "email";
  const { error } = await supabase.auth.verifyOtp({ email, token, type });
  if (error) return { ok: false, error: WRONG_CODE };
  if (input.purpose === "reset") {
    if ((await finalizeSignIn()) === "no_session") return { ok: false, error: "Sign-in didn't complete. Try again." };
    redirect(`/reset-password?next=${encodeURIComponent(safeNext(input.next))}`);
  }
  return finishSignIn(input.next);
}

export async function setNewPasswordAction(input: { password: string; next?: string }): Promise<ActionResult<never>> {
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? "Invalid password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (/session/i.test(error.message)) return { ok: false, error: "The reset code expired. Start over." };
    if (/different from the old/i.test(error.message))
      return { ok: false, error: "Choose a password you haven't used here before." };
    return { ok: false, error: authErrorMessage(error) };
  }
  return finishSignIn(input.next);
}

// Account page: set a password (accounts made with Google or an emailed code
// have none) or change it.
export async function changePasswordAction(input: { password: string }): Promise<ActionResult<null>> {
  if (!(await getCurrentUser())) return { ok: false, error: "Sign in again to change your password." };
  const password = passwordSchema.safeParse(input.password);
  if (!password.success) return { ok: false, error: password.error.issues[0]?.message ?? "Invalid password." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: password.data });
  if (error) {
    if (/different from the old/i.test(error.message)) return { ok: false, error: "That's already your password." };
    return { ok: false, error: authErrorMessage(error) };
  }
  return { ok: true, data: null };
}

// Account page: move sign-in to another address. Supabase emails a code to
// the new address and, with "Secure email change" on, another to the current
// one; the change applies once every code is entered.
export async function requestEmailChangeAction(input: { email: string }): Promise<ActionResult<null>> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Sign in again to change your email." };
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  if (email === user.email) return { ok: false, error: "That's already your email." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ email });
  if (error) {
    if (/already been registered|already exists/i.test(error.message)) {
      return { ok: false, error: "Another account already uses that email." };
    }
    return { ok: false, error: authErrorMessage(error) };
  }
  return { ok: true, data: null };
}

// "done" once the account is on the new address; "current" when the code
// sent to the current address is still needed.
export async function verifyEmailChangeAction(input: {
  email: string;
  token: string;
  address: "new" | "current";
}): Promise<ActionResult<"done" | "current">> {
  const user = await getCurrentUser();
  if (!user?.email) return { ok: false, error: "Sign in again to change your email." };
  const email = normalizeEmail(input.email);
  if (!email) return { ok: false, error: "Enter a valid email address." };
  const token = codeFrom(input.token);
  if (!token) return { ok: false, error: "Enter the code from the email." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email: input.address === "new" ? email : user.email,
    token,
    type: "email_change",
  });
  if (error) return { ok: false, error: WRONG_CODE };
  const { data } = await supabase.auth.getUser();
  if (data.user?.email?.toLowerCase() !== email) return { ok: true, data: "current" };
  revalidatePath("/account");
  return { ok: true, data: "done" };
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
  const name = String(formData.get("displayName") ?? "")
    .trim()
    .slice(0, 80);
  await updateDisplayName(user.id, name || null);
  revalidatePath("/account");
}

export async function deleteAccountAction(formData: FormData): Promise<void> {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/account");
  if (
    String(formData.get("confirm") ?? "")
      .trim()
      .toLowerCase() !== "delete"
  ) {
    redirect("/account?error=confirm");
  }
  await deleteUserData(user.id);
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { error } = await createAdminClient().auth.admin.deleteUser(user.id);
  if (error) console.error("deleteAccountAction: auth user not removed", user.id, error.message);
  redirect("/");
}
