import { currentUserIsOwner } from "@/lib/auth/guard";
import { geographicMetricCoverage, listDatasets } from "@/lib/db/stats";

export async function GET() {
  if (!(await currentUserIsOwner())) return Response.json({ error: "Not found." }, { status: 404 });
  const datasets = await listDatasets();
  const coverage = await geographicMetricCoverage(datasets.map((dataset) => dataset.slug));
  const byDataset = new Map<string, typeof coverage>();
  for (const item of coverage) {
    const current = byDataset.get(item.dataset) ?? [];
    current.push(item);
    byDataset.set(item.dataset, current);
  }
  return Response.json({
    datasets: datasets
      .map((dataset) => ({
        slug: dataset.slug,
        title: dataset.title,
        publisher: dataset.publisher,
        cadence: dataset.cadence,
        metrics: (byDataset.get(dataset.slug) ?? []).map((item) => ({
          ...item,
          label: dataset.metrics[item.metric]?.label ?? item.metric,
          unit: dataset.metrics[item.metric]?.unit ?? "value",
        })),
      }))
      .filter((dataset) => dataset.metrics.length > 0),
  });
}
