import { datasetDownloads } from "@/lib/db/lake";
import { datasetCoverage, getDataset } from "@/lib/db/stats";
import { enforceRateLimits, rateLimitResponse } from "@/lib/security/rate-limit";

// One published dataset: metadata, metric definitions, coverage, and Parquet downloads.
export async function GET(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const limited = await enforceRateLimits([{ scope: "data-dataset-minute", limit: 40, windowSeconds: 60 }], {
    request,
  });
  if (limited) return rateLimitResponse(limited);
  const { slug } = await params;
  if (slug.length > 100) return Response.json({ error: "Dataset slug is too long." }, { status: 400 });
  const dataset = await getDataset(slug);
  if (!dataset) return Response.json({ error: `No published dataset "${slug}".` }, { status: 404 });
  const [coverages, downloads] = await Promise.all([datasetCoverage([slug]), datasetDownloads(slug).catch(() => [])]);
  return Response.json(
    { dataset: { ...dataset, coverage: coverages[slug] ?? null, downloads } },
    { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
  );
}
