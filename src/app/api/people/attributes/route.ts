import { NextResponse } from "next/server";
import { queryAttributes } from "@/lib/db/attributes";
import { parseAttributeParams } from "@/lib/people/attributes";

// Facets and matches for the People page's attribute explorer. The client
// sends filters in a fixed order, so the CDN caches each combination once.
export async function GET(request: Request) {
  const params = parseAttributeParams(new URL(request.url).searchParams);
  if (params.q && params.q.length > 100) return NextResponse.json({ error: "Query too long" }, { status: 400 });
  const result = await queryAttributes(params);
  return NextResponse.json(result, {
    headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" },
  });
}
