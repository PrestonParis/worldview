import { revalidateTag } from "next/cache";
import { timingSafeEqual } from "node:crypto";
import { CLOSE_RACES_TAG } from "@/lib/db/closeRaces";

// Called by scripts/sync-ga-results.mjs after each write so the close-races
// report shows new numbers on the next request rather than after its 60 s
// cache. Bearer REVALIDATE_SECRET.
export async function POST(req: Request) {
  const secret = process.env.REVALIDATE_SECRET;
  const given = (req.headers.get("authorization") ?? "").replace(/^Bearer\s+/i, "");
  const ok = Boolean(secret) && given.length === secret!.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret!));
  if (!ok) return new Response(null, { status: 401 });
  revalidateTag(CLOSE_RACES_TAG, { expire: 0 });
  return Response.json({ ok: true, tag: CLOSE_RACES_TAG });
}
