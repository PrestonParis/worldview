import { datasetDownloads } from "@/lib/db/lake";
import { datasetCoverage, getDataset } from "@/lib/db/stats";

// One published dataset: metadata, metric definitions, coverage, and Parquet downloads.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataset = await getDataset(slug);
  if (!dataset) return Response.json({ error: `No published dataset "${slug}".` }, { status: 404 });
  const [coverages, downloads] = await Promise.all([datasetCoverage([slug]), datasetDownloads(slug).catch(() => [])]);
  return Response.json({ dataset: { ...dataset, coverage: coverages[slug] ?? null, downloads } });
}
