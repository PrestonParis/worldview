import type { RecordTableCoverage } from "../records";

export interface MetricDefinition {
  label: string;
  unit: string;
  description?: string;
}

export interface Dataset {
  slug: string;
  title: string;
  topic: string;
  publisher: string;
  partner: { slug: string; name: string } | null;
  description: string | null;
  methodology: string | null;
  sourceUrl: string | null;
  license: string | null;
  cadence: string | null;
  metrics: Record<string, MetricDefinition>;
  status: string;
  updatedAt: string;
}

export interface DatasetCoverage {
  kind: "values" | "records";
  rows: number;
  metrics: number;
  geoLevels: string[];
  firstPeriod: string | null;
  lastPeriod: string | null;
  lastUpdated: string | null;
  tables?: RecordTableCoverage[];
}

export interface GeographicMetricCoverage {
  dataset: string;
  metric: string;
  geoLevel: string;
  firstPeriod: string;
  lastPeriod: string;
  rows: number;
}

export interface Point {
  period: string;
  periodStart: string | null;
  value: number;
  metadata?: Record<string, unknown> | null;
}

export interface AreaValue {
  geoid: string;
  geoName: string | null;
  value: number;
  metadata?: Record<string, unknown> | null;
}

export interface YearlyValue {
  metric: string;
  geoid: string;
  year: string;
  value: number;
  months: number;
  reportedMonths: number;
  coverage: number | null;
  minCoverage: number | null;
}

export interface ObservationQuery {
  dataset: string;
  metric?: string;
  geoLevel?: string;
  geoid?: string;
  from?: string;
  to?: string;
  limit: number;
  offset: number;
}

export interface SeriesKey {
  source: string;
  metric: string;
}

export interface LatestValue extends SeriesKey {
  geoid: string;
  geoName: string | null;
  period: string;
  value: number;
}

export interface CompareSeries {
  source: string;
  metric: string;
  period?: string;
}

export interface CompareResult {
  level: string;
  series: { source: string; metric: string; period: string | null; label: string; unit: string | null }[];
  rows: { geoid: string; name: string; state: string | null; values: (number | null)[] }[];
}
