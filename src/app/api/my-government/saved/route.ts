import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getSavedGovernment } from "@/lib/db/savedGovernments";

// The signed-in member's saved My Government result, for
// src/components/my-government/use-my-government.ts.
export async function GET() {
  const user = await getCurrentUser().catch(() => null);
  const saved = user ? await getSavedGovernment(user.id).catch(() => null) : null;
  return NextResponse.json(
    { signedIn: Boolean(user), saved },
    { headers: { "Cache-Control": "private, no-store" } },
  );
}
