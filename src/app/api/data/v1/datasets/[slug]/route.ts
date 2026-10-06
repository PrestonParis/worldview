import { datasetCoverage, getDataset } from "@/lib/db/stats";

// One published dataset: metadata, metric definitions, and coverage.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const dataset = await getDataset(slug);
  if (!dataset) return Response.json({ error: `No published dataset "${slug}".` }, { status: 404 });
  const coverage = (await datasetCoverage([slug]))[slug] ?? null;
  return Response.json({ dataset: { ...dataset, coverage } });
}
