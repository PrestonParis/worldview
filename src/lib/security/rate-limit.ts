import "server-only";

import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { sql } from "drizzle-orm";
import { db } from "@/lib/db/client";

export interface RateLimitRule {
  scope: string;
  limit: number;
  windowSeconds: number;
  cost?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfter: number;
}

function firstHeader(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

export function clientAddressFromHeaders(h: Headers): string {
  return (
    firstHeader(h.get("x-forwarded-for")) ??
    firstHeader(h.get("x-real-ip")) ??
    firstHeader(h.get("cf-connecting-ip")) ??
    "unknown"
  );
}

export function hashRateLimitIdentity(value: string): string {
  const salt = process.env.RATE_LIMIT_SALT || process.env.TURNSTILE_SECRET_KEY || "worldview-rate-limit-v1";
  return createHash("sha256").update(`${salt}\0${value}`).digest("hex");
}

export async function requestIdentity(request?: Request): Promise<string> {
  const h = request?.headers ?? (await headers());
  return hashRateLimitIdentity(`ip:${clientAddressFromHeaders(h)}`);
}

export async function consumeRateLimit(
  rule: RateLimitRule,
  options: { request?: Request; identity?: string } = {},
): Promise<RateLimitResult> {
  const now = Date.now();
  const windowMs = rule.windowSeconds * 1000;
  const windowStart = new Date(Math.floor(now / windowMs) * windowMs);
  const expiresAt = new Date(windowStart.getTime() + windowMs * 2);
  const identityHash = options.identity
    ? hashRateLimitIdentity(options.identity)
    : await requestIdentity(options.request);
  const cost = Math.max(1, Math.floor(rule.cost ?? 1));

  const result = await db.execute(sql`
    insert into request_rate_limits (scope, identity_hash, window_start, count, expires_at)
    values (${rule.scope}, ${identityHash}, ${windowStart}, ${cost}, ${expiresAt})
    on conflict (scope, identity_hash, window_start)
    do update set count = request_rate_limits.count + ${cost}, expires_at = ${expiresAt}
    returning count
  `);
  const count = Number((result.rows[0] as { count?: number | string } | undefined)?.count ?? rule.limit + 1);
  const retryAfter = Math.max(1, Math.ceil((windowStart.getTime() + windowMs - now) / 1000));
  const allowed = count <= rule.limit;
  if (!allowed) {
    console.warn("[abuse:rate-limit]", JSON.stringify({ scope: rule.scope, retryAfter }));
  }
  return { allowed, limit: rule.limit, remaining: Math.max(0, rule.limit - count), retryAfter };
}

export function rateLimitResponse(result: RateLimitResult): Response {
  return Response.json(
    { error: "Too many requests. Wait a little and try again." },
    {
      status: 429,
      headers: {
        "Cache-Control": "private, no-store",
        "Retry-After": String(result.retryAfter),
        "X-RateLimit-Limit": String(result.limit),
        "X-RateLimit-Remaining": String(result.remaining),
      },
    },
  );
}

export async function enforceRateLimits(
  rules: RateLimitRule[],
  options: { request?: Request; identity?: string } = {},
): Promise<RateLimitResult | null> {
  for (const rule of rules) {
    const result = await consumeRateLimit(rule, options);
    if (!result.allowed) return result;
  }
  return null;
}
