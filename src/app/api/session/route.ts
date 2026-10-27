import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { isEditor, isOwner } from "@/lib/auth/guard";

// The signed-in state for the client header (src/components/auth/can-edit.tsx).
export async function GET() {
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
