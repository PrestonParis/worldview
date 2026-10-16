import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  // Anonymous visitors (and crawlers) have no session to refresh, so skip
  // the Supabase round-trip entirely.
  const hasSession = request.cookies.getAll().some(({ name }) => name.startsWith("sb-"));
  if (!hasSession) return NextResponse.next();
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|mjs|geojson)$).*)",
  ],
};
