import { datasetCoverage, listDatasets } from "@/lib/db/stats";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

// Public catalog of published datasets (docs/data-hosting.md).
export async function GET(request: Request) {
  const limited = await enforceRateLimits([{ scope: "data-catalog-minute", limit: 20, windowSeconds: 60 }], {
    request,
  });
  if (limited) return rateLimitResponse(limited);
  const topic = new URL(request.url).searchParams.get("topic") ?? undefined;
  if ((topic?.length ?? 0) > 64) return Response.json({ error: "Topic is too long." }, { status: 400 });
  const list = await listDatasets({ topic });
  const coverage = await datasetCoverage(list.map((d) => d.slug));
  return Response.json(
    {
      datasets: list.map(({ metrics, ...d }) => ({
        ...d,
        metrics: Object.keys(metrics),
        coverage: coverage[d.slug] ?? null,
      })),
    },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
