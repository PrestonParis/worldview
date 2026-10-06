// Reads and writes for the statistical layer: `area_stats` (every series,
// public import or partner-published) and the `datasets` catalog that
// describes them. Pages, the public data API, and the partner API all go
// through here.

import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql } from "drizzle-orm";
import { db } from "./client";
import { areaStats, dataPartners, datasets, syncRuns } from "./schema";
import { periodEnd, periodStart, type ObservationInput } from "@/lib/validation/observation";

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
  rows: number;
  metrics: number;
  geoLevels: string[];
  firstPeriod: string | null;
  lastPeriod: string | null;
  lastUpdated: string | null;
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

const datasetColumns = {
  slug: datasets.slug,
  title: datasets.title,
  topic: datasets.topic,
  publisher: datasets.publisher,
  description: datasets.description,
  methodology: datasets.methodology,
  sourceUrl: datasets.sourceUrl,
  license: datasets.license,
  cadence: datasets.cadence,
  metrics: datasets.metrics,
  status: datasets.status,
  updatedAt: datasets.updatedAt,
  partnerSlug: dataPartners.slug,
  partnerName: dataPartners.name,
};

const selectDatasets = () =>
  db.select(datasetColumns).from(datasets).leftJoin(dataPartners, eq(datasets.partnerId, dataPartners.id));

function toDataset(row: Awaited<ReturnType<typeof selectDatasets>>[number]): Dataset {
  return {
    slug: row.slug,
    title: row.title,
    topic: row.topic,
    publisher: row.publisher,
    partner: row.partnerSlug ? { slug: row.partnerSlug, name: row.partnerName ?? row.partnerSlug } : null,
    description: row.description,
    methodology: row.methodology,
    sourceUrl: row.sourceUrl,
    license: row.license,
    cadence: row.cadence,
    metrics: (row.metrics ?? {}) as Record<string, MetricDefinition>,
    status: row.status,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listDatasets({ topic, includeUnpublished = false }: { topic?: string; includeUnpublished?: boolean } = {}) {
  const rows = await selectDatasets()
    .where(
      and(
        includeUnpublished ? undefined : eq(datasets.status, "published"),
        topic ? eq(datasets.topic, topic) : undefined,
      ),
    )
    .orderBy(asc(datasets.topic), asc(datasets.title));
  return rows.map(toDataset);
}

export async function getDataset(slug: string, { includeUnpublished = false } = {}): Promise<Dataset | null> {
  const [row] = await selectDatasets()
    .where(and(eq(datasets.slug, slug), includeUnpublished ? undefined : eq(datasets.status, "published")))
    .limit(1);
  return row ? toDataset(row) : null;
}

// Coverage per dataset slug, from area_stats plus the latest successful
// import or partner push.
export async function datasetCoverage(slugs: string[]): Promise<Record<string, DatasetCoverage>> {
  if (!slugs.length) return {};
  const rows = await db
    .select({
      source: areaStats.source,
      rows: sql<number>`count(*)::int`,
      metrics: sql<number>`count(distinct ${areaStats.metric})::int`,
      geoLevels: sql<string[]>`array_agg(distinct ${areaStats.geoLevel})`,
      firstPeriod: sql<string | null>`min(${areaStats.period})`,
      lastPeriod: sql<string | null>`max(${areaStats.period})`,
      lastUpdated: sql<string | null>`max(${areaStats.updatedAt})::text`,
    })
    .from(areaStats)
    .where(and(inArray(areaStats.source, slugs), isNotNull(areaStats.value)))
    .groupBy(areaStats.source);
  return Object.fromEntries(
    rows.map((r) => [
      r.source,
      {
        rows: r.rows,
        metrics: r.metrics,
        geoLevels: r.geoLevels,
        firstPeriod: r.firstPeriod,
        lastPeriod: r.lastPeriod,
        lastUpdated: r.lastUpdated ? new Date(r.lastUpdated).toISOString() : null,
      },
    ]),
  );
}

// One metric for one place over time, oldest first.
export async function getSeries(source: string, metric: string, geoLevel = "nation", geoid = "US"): Promise<Point[]> {
  const rows = await db
    .select({
      period: areaStats.period,
      periodStart: areaStats.periodStart,
      value: areaStats.value,
      metadata: areaStats.metadata,
    })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, source),
        eq(areaStats.metric, metric),
        eq(areaStats.geoLevel, geoLevel),
        eq(areaStats.geoid, geoid),
        isNotNull(areaStats.value),
      ),
    )
    .orderBy(asc(areaStats.periodStart), asc(areaStats.period));
  return rows.map((r) => ({
    period: r.period,
    periodStart: r.periodStart,
    value: r.value!,
    metadata: r.metadata as Record<string, unknown> | null,
  }));
}

// Several metrics for one place, keyed by metric.
export async function getSeriesMany(source: string, metrics: string[], geoLevel = "nation", geoid = "US") {
  const rows = await db
    .select({
      metric: areaStats.metric,
      period: areaStats.period,
      periodStart: areaStats.periodStart,
      value: areaStats.value,
    })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, source),
        inArray(areaStats.metric, metrics),
        eq(areaStats.geoLevel, geoLevel),
        eq(areaStats.geoid, geoid),
        isNotNull(areaStats.value),
      ),
    )
    .orderBy(asc(areaStats.periodStart), asc(areaStats.period));
  const out: Record<string, Point[]> = Object.fromEntries(metrics.map((m) => [m, []]));
  for (const r of rows) out[r.metric].push({ period: r.period, periodStart: r.periodStart, value: r.value! });
  return out;
}

export async function latestPeriod(source: string, metric: string, geoLevel: string): Promise<string | null> {
  const [row] = await db
    .select({ period: areaStats.period })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, source),
        eq(areaStats.metric, metric),
        eq(areaStats.geoLevel, geoLevel),
        isNotNull(areaStats.value),
      ),
    )
    .orderBy(desc(areaStats.periodStart), desc(areaStats.period))
    .limit(1);
  return row?.period ?? null;
}

// Every place at one geography level for one period (the latest, unless
// given), largest value first. `geoidPrefix` narrows scoped breakdowns
// (e.g. "US:" for national country-of-birth rows).
export async function getCrossSection(
  source: string,
  metric: string,
  geoLevel: string,
  { period, geoidPrefix }: { period?: string; geoidPrefix?: string } = {},
): Promise<{ period: string | null; values: AreaValue[] }> {
  const at = period ?? (await latestPeriod(source, metric, geoLevel));
  if (!at) return { period: null, values: [] };
  const rows = await db
    .select({ geoid: areaStats.geoid, geoName: areaStats.geoName, value: areaStats.value, metadata: areaStats.metadata })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, source),
        eq(areaStats.metric, metric),
        eq(areaStats.geoLevel, geoLevel),
        eq(areaStats.period, at),
        isNotNull(areaStats.value),
        geoidPrefix ? sql`${areaStats.geoid} like ${geoidPrefix + "%"}` : undefined,
      ),
    )
    .orderBy(desc(areaStats.value));
  return {
    period: at,
    values: rows.map((r) => ({
      geoid: r.geoid,
      geoName: r.geoName,
      value: r.value!,
      metadata: r.metadata as Record<string, unknown> | null,
    })),
  };
}

// Each place's total over a window of periods (inclusive period_start
// bounds) — e.g. the trailing 12 months of monthly encounters.
export async function sumByGeo(
  source: string,
  metric: string,
  geoLevel: string,
  fromStart: string,
  toStart: string,
): Promise<AreaValue[]> {
  const rows = await db
    .select({
      geoid: areaStats.geoid,
      geoName: sql<string | null>`max(${areaStats.geoName})`,
      value: sql<number>`sum(${areaStats.value})::float8`,
    })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, source),
        eq(areaStats.metric, metric),
        eq(areaStats.geoLevel, geoLevel),
        gte(areaStats.periodStart, fromStart),
        lte(areaStats.periodStart, toStart),
        isNotNull(areaStats.value),
      ),
    )
    .groupBy(areaStats.geoid)
    .orderBy(desc(sql`sum(${areaStats.value})`));
  return rows.map((r) => ({ geoid: r.geoid, geoName: r.geoName, value: r.value }));
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

export async function queryObservations(q: ObservationQuery) {
  const rows = await db
    .select({
      metric: areaStats.metric,
      geoLevel: areaStats.geoLevel,
      geoid: areaStats.geoid,
      geoName: areaStats.geoName,
      period: areaStats.period,
      periodStart: areaStats.periodStart,
      value: areaStats.value,
      unit: areaStats.unit,
      metadata: areaStats.metadata,
    })
    .from(areaStats)
    .where(
      and(
        eq(areaStats.source, q.dataset),
        q.metric ? eq(areaStats.metric, q.metric) : undefined,
        q.geoLevel ? eq(areaStats.geoLevel, q.geoLevel) : undefined,
        q.geoid ? eq(areaStats.geoid, q.geoid) : undefined,
        q.from ? gte(areaStats.periodStart, periodStart(q.from)) : undefined,
        // Periods that start within [from, to].
        q.to ? lte(areaStats.periodStart, periodEnd(q.to)) : undefined,
      ),
    )
    .orderBy(asc(areaStats.metric), asc(areaStats.geoLevel), asc(areaStats.geoid), asc(areaStats.periodStart))
    .limit(q.limit)
    .offset(q.offset);
  return rows;
}

// --- Partner publishing

export async function getPartnerDataset(slug: string) {
  const [row] = await db
    .select({ id: datasets.id, partnerId: datasets.partnerId, status: datasets.status, metrics: datasets.metrics })
    .from(datasets)
    .where(eq(datasets.slug, slug))
    .limit(1);
  return row ?? null;
}

export async function upsertObservations(
  dataset: { id: string; slug: string },
  observations: ObservationInput[],
  metricDefinitions: Record<string, MetricDefinition> | undefined,
) {
  const rows = [
    ...new Map(
      observations.map((o) => [
        [o.metric, o.geoLevel, o.geoid, o.period].join("\u0000"),
        {
          source: dataset.slug,
          metric: o.metric,
          geoLevel: o.geoLevel,
          geoid: o.geoid,
          geoName: o.geoName ?? null,
          period: o.period,
          periodStart: periodStart(o.period),
          value: o.value,
          unit: o.unit ?? metricDefinitions?.[o.metric]?.unit ?? null,
          metadata: o.metadata ?? null,
        },
      ]),
    ).values(),
  ];
  return db.transaction(async (tx) => {
    for (let i = 0; i < rows.length; i += 1000) {
      await tx
        .insert(areaStats)
        .values(rows.slice(i, i + 1000))
        .onConflictDoUpdate({
          target: [areaStats.source, areaStats.metric, areaStats.geoLevel, areaStats.geoid, areaStats.period],
          set: {
            geoName: sql`excluded.geo_name`,
            periodStart: sql`excluded.period_start`,
            value: sql`excluded.value`,
            unit: sql`excluded.unit`,
            metadata: sql`excluded.metadata`,
            updatedAt: sql`now()`,
          },
        });
    }
    if (metricDefinitions && Object.keys(metricDefinitions).length) {
      await tx
        .update(datasets)
        .set({ metrics: sql`${datasets.metrics} || ${JSON.stringify(metricDefinitions)}::jsonb`, updatedAt: new Date() })
        .where(eq(datasets.id, dataset.id));
    } else {
      await tx.update(datasets).set({ updatedAt: new Date() }).where(eq(datasets.id, dataset.id));
    }
    await tx.insert(syncRuns).values({
      source: `partner:${dataset.slug}`,
      finishedAt: new Date(),
      status: "ok",
      rowsInserted: rows.length,
      rowsSkipped: observations.length - rows.length,
    });
    return { written: rows.length, duplicates: observations.length - rows.length };
  });
}
