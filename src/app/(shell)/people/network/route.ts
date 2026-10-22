import { NextResponse } from "next/server";
import { getEntity } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";

// The network view was retired; old /people?view=network&root= links (sent
// here by next.config.ts) land on the subject's profile.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const root = url.searchParams.get("root");
  const entity = root ? await getEntity(root).catch(() => null) : null;
  const target = entity ? `${publicEntityPath(entity)}` : "/people";
  return NextResponse.redirect(new URL(target, url), 308);
}
