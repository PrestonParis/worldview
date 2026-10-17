import { unstable_cache } from "next/cache";
import { loadStateDetail } from "@/lib/crime/sources";
import { AREA_STATS_TAG } from "@/lib/db/stats";

// Building one state's detail ranks every police department in the country,
// so each state/year is cached on its own and the response held at the CDN.
const cachedDetail = unstable_cache(loadStateDetail, ["crime-state-detail"], { tags: [AREA_STATS_TAG], revalidate: 86400 });

// A state's large-city police departments and county homicide rates, for
// the /crime state profile. ?year= is the latest complete FBI year shown.
export async function GET(request: Request, { params }: { params: Promise<{ abbr: string }> }) {
  const { abbr } = await params;
  const q = new URL(request.url).searchParams;
  const year = /^\d{4}$/.test(q.get("year") ?? "") ? q.get("year")! : null;
  const detail = await cachedDetail(abbr.toUpperCase(), year, year ? String(Number(year) - 1) : null);
  if (!detail) return Response.json({ error: `Unknown state "${abbr}".` }, { status: 404 });
  return Response.json(detail, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" } });
}
