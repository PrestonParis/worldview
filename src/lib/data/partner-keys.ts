// API keys for data partners (docs/data-hosting.md). Server-only.
//
// Keys look like `wvp_<40 base62 chars>`. Only the SHA-256 is stored; the
// first 12 characters are kept as a display prefix so a partner can tell
// their keys apart. scripts/partner.mjs issues keys with the same format.

import { createHash, timingSafeEqual } from "crypto";
import { and, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db/client";
import { dataPartners, partnerKeys } from "@/lib/db/schema";

export const KEY_PREFIX = "wvp_";

export function hashPartnerKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export interface AuthenticatedPartner {
  id: string;
  slug: string;
  name: string;
  keyId: string;
}

// Resolves `Authorization: Bearer wvp_...` to an approved partner, or
// returns the error message to send back.
export async function authenticatePartner(
  request: Request,
): Promise<{ partner: AuthenticatedPartner } | { error: string; status: 401 | 403 }> {
  const [scheme, token] = (request.headers.get("authorization") ?? "").split(" ");
  if (scheme !== "Bearer" || !token?.startsWith(KEY_PREFIX)) {
    return { error: "Missing or malformed Authorization header. Use: Authorization: Bearer wvp_...", status: 401 };
  }
  const hash = hashPartnerKey(token);
  const [row] = await db
    .select({
      keyId: partnerKeys.id,
      keyHash: partnerKeys.keyHash,
      partnerId: dataPartners.id,
      slug: dataPartners.slug,
      name: dataPartners.name,
      status: dataPartners.status,
    })
    .from(partnerKeys)
    .innerJoin(dataPartners, eq(partnerKeys.partnerId, dataPartners.id))
    .where(and(eq(partnerKeys.keyHash, hash), isNull(partnerKeys.revokedAt)))
    .limit(1);
  // The lookup is by hash already; the constant-time compare guards
  // against a future change to a prefix lookup.
  if (!row || !timingSafeEqual(Buffer.from(row.keyHash), Buffer.from(hash))) {
    return { error: "Invalid or revoked API key.", status: 401 };
  }
  if (row.status !== "approved") {
    return { error: `Partner "${row.slug}" is ${row.status}; publishing requires an approved partner.`, status: 403 };
  }
  await db.update(partnerKeys).set({ lastUsedAt: new Date() }).where(eq(partnerKeys.id, row.keyId));
  return { partner: { id: row.partnerId, slug: row.slug, name: row.name, keyId: row.keyId } };
}
