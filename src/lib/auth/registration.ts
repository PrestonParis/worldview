// The registration-code gate (docs/auth-plan.md). Server-only.
//
// New accounts need REGISTRATION_CODE. Entering it sets a short-lived signed
// "registration pass" cookie; whichever sign-in method finishes next (email
// code or Google) turns the pass into a profiles row. The pass is an HMAC
// keyed on the code itself, so rotating the code invalidates outstanding
// passes and no extra secret is needed.

import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const PASS_COOKIE = "wv_registration";
const PASS_TTL_SECONDS = 30 * 60;

function registrationCode(): string | null {
  const code = process.env.REGISTRATION_CODE?.trim();
  return code ? code : null;
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

// Fails closed: with no REGISTRATION_CODE configured, nobody can register.
export function isValidRegistrationCode(input: string): boolean {
  const code = registrationCode();
  return !!code && safeEqual(input.trim(), code);
}

function sign(expires: number, code: string): string {
  return createHmac("sha256", code).update(`registration:${expires}`).digest("base64url");
}

export async function grantRegistrationPass(): Promise<void> {
  const code = registrationCode();
  if (!code) return;
  const expires = Math.floor(Date.now() / 1000) + PASS_TTL_SECONDS;
  (await cookies()).set(PASS_COOKIE, `${expires}.${sign(expires, code)}`, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: PASS_TTL_SECONDS,
  });
}

export async function hasRegistrationPass(): Promise<boolean> {
  const code = registrationCode();
  const value = (await cookies()).get(PASS_COOKIE)?.value;
  if (!code || !value) return false;
  const [expiresRaw, mac] = value.split(".");
  const expires = Number(expiresRaw);
  if (!Number.isInteger(expires) || expires < Date.now() / 1000 || !mac) return false;
  return safeEqual(mac, sign(expires, code));
}

export async function clearRegistrationPass(): Promise<void> {
  (await cookies()).delete(PASS_COOKIE);
}
