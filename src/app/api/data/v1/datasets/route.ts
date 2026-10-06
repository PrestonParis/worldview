import { datasetCoverage, listDatasets } from "@/lib/db/stats";

// Public catalog of published datasets (docs/data-hosting.md).
export async function GET(request: Request) {
  const topic = new URL(request.url).searchParams.get("topic") ?? undefined;
  const list = await listDatasets({ topic });
  const coverage = await datasetCoverage(list.map((d) => d.slug));
  return Response.json({
    datasets: list.map(({ metrics, ...d }) => ({
      ...d,
      metrics: Object.keys(metrics),
      coverage: coverage[d.slug] ?? null,
    })),
  });
}
