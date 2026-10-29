import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isEditor, isOwner } from "@/lib/auth/guard";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

// The signed-in state for the client header (src/components/auth/can-edit.tsx).
export async function GET(request: Request) {
  const limited = await enforceRateLimits([{ scope: "session-minute", limit: 60, windowSeconds: 60 }], { request });
  if (limited) return rateLimitResponse(limited);
  // A failed profile lookup shouldn't break the header; treat it as signed out.
  const user = await getCurrentUser().catch(() => null);
  return NextResponse.json(
    {
      accountLabel: user ? (user.displayName ?? user.email ?? "Account") : null,
      canEdit: isEditor(user),
      isOwner: isOwner(user),
    },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
