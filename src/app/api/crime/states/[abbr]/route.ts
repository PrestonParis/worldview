import { unstable_cache } from "next/cache";
import { loadCrimeDetailYears, loadStateDetail } from "@/lib/crime/sources";
import { AREA_STATS_TAG } from "@/lib/db/stats";
import { STATE_FIPS } from "@/lib/geo/states";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

// Building one state's detail ranks every police department in the country,
// so each state/year is cached on its own and the response held at the CDN.
const cachedDetail = unstable_cache(loadStateDetail, ["crime-state-detail"], {
  tags: [AREA_STATS_TAG],
  revalidate: 86400,
});
const cachedDetailYears = unstable_cache(loadCrimeDetailYears, ["crime-state-detail-years"], {
  tags: [AREA_STATS_TAG],
  revalidate: 86400,
});

// A state's large-city police departments and county homicide rates, for
// the /crime state profile. ?year= is the latest complete FBI year shown.
export async function GET(request: Request, { params }: { params: Promise<{ abbr: string }> }) {
  const limited = await enforceRateLimits([{ scope: "crime-state-minute", limit: 30, windowSeconds: 60 }], { request });
  if (limited) return rateLimitResponse(limited);
  const { abbr: rawAbbr } = await params;
  const abbr = rawAbbr.toUpperCase();
  if (!(abbr in STATE_FIPS)) return Response.json({ error: `Unknown state "${rawAbbr}".` }, { status: 404 });
  const q = new URL(request.url).searchParams;
  const rawYear = q.get("year");
  if (rawYear && !/^\d{4}$/.test(rawYear)) {
    return Response.json({ error: "year must be a four-digit covered year." }, { status: 400 });
  }
  const coveredYears = await cachedDetailYears();
  if (rawYear && !coveredYears.includes(rawYear)) {
    return Response.json(
      { error: `No complete FBI coverage is available for ${rawYear}.`, availableYears: coveredYears },
      { status: 400 },
    );
  }
  const year = rawYear || coveredYears.at(-1) || null;
  const detail = await cachedDetail(abbr, year, year ? String(Number(year) - 1) : null);
  if (!detail) return Response.json({ error: `Unknown state "${abbr}".` }, { status: 404 });
  return Response.json(detail, {
    headers: { "Cache-Control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=86400" },
  });
}
