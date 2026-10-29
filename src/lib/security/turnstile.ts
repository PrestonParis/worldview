import "server-only";

import { clientAddressFromHeaders } from "./rate-limit";

const VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

export function productionCaptchaConfigured(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && process.env.TURNSTILE_SECRET_KEY);
}

export async function verifyTurnstileToken(token: string | undefined, h: Headers): Promise<boolean> {
  if (process.env.NODE_ENV !== "production") return true;
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || !token) return false;
  const body = new URLSearchParams({ secret, response: token });
  const remoteip = clientAddressFromHeaders(h);
  if (remoteip !== "unknown") body.set("remoteip", remoteip);
  try {
    const response = await fetch(VERIFY_URL, {
      method: "POST",
      body,
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) return false;
    const result = (await response.json()) as { success?: boolean };
    return result.success === true;
  } catch {
    return false;
  }
}
