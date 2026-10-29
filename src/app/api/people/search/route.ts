import { NextResponse } from "next/server";
import { searchEntities } from "@/lib/db/entities";
import { publicEntityPath } from "@/lib/people/public";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

const RESULT_LIMIT = 8;

export async function GET(request: Request) {
  const limited = await enforceRateLimits([{ scope: "people-search-minute", limit: 60, windowSeconds: 60 }], {
    request,
  });
  if (limited) return rateLimitResponse(limited);
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (!query) return NextResponse.json({ matches: [] });
  if (query.length > 100) {
    return NextResponse.json({ error: "Query too long" }, { status: 400 });
  }

  const entities = await searchEntities(query, RESULT_LIMIT);
  return NextResponse.json(
    {
      matches: entities.map((entity) => ({
        id: entity.id,
        name: entity.name,
        type: entity.type,
        href: publicEntityPath(entity),
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
