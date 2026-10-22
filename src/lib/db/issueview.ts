import { compareByGeo, geographicMetricCoverage, listDatasets, type CompareResult, type CompareSeries } from "./stats";
import type { MetricDefinition } from "./stats/types";

export interface MetricOption {
  source: string;
  sourceTitle: string;
  topic: string;
  metric: string;
  label: string;
  unit: string | null;
  levels: ("state" | "county")[];
}

export interface IssueViewCatalog {
  topics: Record<string, MetricOption[]>;
  allMetrics: MetricOption[];
}

export async function getIssueViewCatalog(): Promise<IssueViewCatalog> {
  const datasets = await listDatasets();
  const coverage = await geographicMetricCoverage(datasets.map((dataset) => dataset.slug));
  const levels = new Map<string, Set<"state" | "county">>();
  for (const row of coverage) {
    if (row.geoLevel !== "state" && row.geoLevel !== "county") continue;
    const key = `${row.dataset}:${row.metric}`;
    const available = levels.get(key) ?? new Set<"state" | "county">();
    available.add(row.geoLevel);
    levels.set(key, available);
  }
  const topics: Record<string, MetricOption[]> = {};
  const allMetrics: MetricOption[] = [];

  for (const ds of datasets) {
    const topic = ds.topic || "Other";
    if (!topics[topic]) topics[topic] = [];

    const metricEntries = Object.entries(ds.metrics || {}) as [string, MetricDefinition][];
    for (const [metricKey, metricDef] of metricEntries) {
      const availableLevels = [...(levels.get(`${ds.slug}:${metricKey}`) ?? [])];
      if (!availableLevels.length) continue;
      const option: MetricOption = {
        source: ds.slug,
        sourceTitle: ds.title,
        topic,
        metric: metricKey,
        label: metricDef.label || metricKey,
        unit: metricDef.unit ?? null,
        levels: availableLevels,
      };
      topics[topic].push(option);
      allMetrics.push(option);
    }
  }

  return { topics, allMetrics };
}

export async function loadIssueViewComparison(
  level: string = "state",
  series: CompareSeries[] = [],
): Promise<CompareResult | null> {
  if (series.length === 0) return null;
  try {
    const result = await compareByGeo(level, series);
    const rows = result.rows
      .map((row) => ({
        ...row,
        // Several federal releases use large negative sentinels for
        // suppressed or unavailable values. They are not measurements.
        values: row.values.map((value) => (value !== null && value > -900 ? value : null)),
      }))
      .filter((row) => row.values.some((value) => value !== null));
    return { ...result, rows };
  } catch (error) {
    console.error("[issueview:loadComparison]", error);
    return null;
  }
}
