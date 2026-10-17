import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coverageLabel } from "@/components/data/dataset-list";
import { SortableTable } from "@/components/data/sortable-table";
import { datasetDownloads } from "@/lib/db/lake";
import { RECORD_DATASETS, recordPreview } from "@/lib/db/records";
import { datasetCoverage, getDataset } from "@/lib/db/stats";

// Rebuilt at most daily; crawlers and visitors share the cached render.
export const revalidate = 86400;

// Nothing prebuilt; each page is rendered on first request, then cached.
export async function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const dataset = await getDataset((await params).slug);
  return { title: dataset ? `${dataset.title} | Worldview` : "Dataset | Worldview", description: dataset?.description ?? undefined };
}

const UNITS: Record<string, string> = {
  people: "People", encounters: "Encounters", offenses: "Offenses", clearances: "Clearances", per_100k: "Per 100,000 residents",
  per_1000: "Per 1,000 residents", percent: "Percent", usd: "U.S. dollars", days: "Days", applications: "Applications",
  facilities: "Facilities", count: "Count", years: "Years",
};

function formatBytes(bytes: number): string {
  return bytes >= 1_048_576 ? `${(bytes / 1_048_576).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export default async function DatasetPage({ params }: Props) {
  const { slug } = await params;
  const dataset = await getDataset(slug);
  if (!dataset) notFound();
  const coverage = (await datasetCoverage([slug]))[slug] ?? null;
  const metrics = Object.entries(dataset.metrics);
  const example = metrics[0]?.[0];
  const record = RECORD_DATASETS[slug];
  const preview = record ? await recordPreview(slug) : null;
  const downloads = await datasetDownloads(slug).catch(() => []);

  const facts = [
    ["Publisher", dataset.publisher],
    ["Update cadence", dataset.cadence],
    ["Coverage", coverageLabel(coverage)],
    ["Geographies", coverage?.geoLevels.join(", ")],
    ["License", dataset.license],
    ["Last refreshed", coverage?.lastUpdated ? new Date(coverage.lastUpdated).toLocaleDateString("en-US", { dateStyle: "medium" }) : null],
  ].filter(([, v]) => v) as [string, string][];

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <header>
        <Link href="/datasets" className="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white">
          ← Datasets
        </Link>
        <p className="mt-6 text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">
          {dataset.partner ? `Published by ${dataset.partner.name}` : dataset.topic}
        </p>
        <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950 dark:text-white">{dataset.title}</h1>
        {dataset.description && <p className="mt-3 max-w-3xl text-base leading-7 text-slate-500 dark:text-slate-400">{dataset.description}</p>}
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium">
          {record?.explore && (
            <Link href={record.explore.href} className="text-slate-900 underline underline-offset-2 dark:text-white">
              {record.explore.label} →
            </Link>
          )}
          {dataset.sourceUrl && (
            <a href={dataset.sourceUrl} className="text-slate-900 underline underline-offset-2 dark:text-white">
              Original source ↗
            </a>
          )}
        </p>
      </header>

      <dl className="grid gap-x-8 gap-y-4 rounded-2xl border border-slate-200 p-5 sm:grid-cols-2 lg:grid-cols-3 dark:border-slate-800">
        {facts.map(([k, v]) => (
          <div key={k}>
            <dt className="text-xs text-slate-500 dark:text-slate-400">{k}</dt>
            <dd className="mt-0.5 text-sm text-slate-900 dark:text-white">{v}</dd>
          </div>
        ))}
      </dl>

      {dataset.methodology && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Method</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{dataset.methodology}</p>
        </section>
      )}

      {metrics.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Measures</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <SortableTable
              className="w-full min-w-[36rem] text-sm"
              columns={[{ label: "Measure" }, { label: "Unit" }, { label: "API name" }]}
              rows={metrics.map(([key, m]) => ({
                key,
                cells: [
                  {
                    content: (
                      <>
                        {m.label}
                        {m.description && <span className="block text-xs text-slate-500 dark:text-slate-400">{m.description}</span>}
                      </>
                    ),
                    sort: m.label.toLowerCase(),
                    className: "px-3 py-2 text-slate-900 dark:text-white",
                  },
                  { content: UNITS[m.unit] ?? m.unit, className: "px-3 py-2 text-slate-600 dark:text-slate-300" },
                  { content: key, className: "px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400" },
                ],
              }))}
            />
          </div>
        </section>
      )}

      {coverage?.tables && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Records</h2>
          <dl className="mt-3 flex flex-wrap gap-x-10 gap-y-3">
            {coverage.tables.map((t) => (
              <div key={t.label}>
                <dt className="text-xs text-slate-500 dark:text-slate-400">{t.label}</dt>
                <dd className="mt-0.5 text-lg font-semibold text-slate-950 tabular-nums dark:text-white">{t.rows.toLocaleString("en-US")}</dd>
              </div>
            ))}
          </dl>
        </section>
      )}

      {preview && preview.rows.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{preview.title}</h2>
          <div className="mt-3 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <SortableTable
              className="w-full min-w-xl text-sm"
              columns={preview.columns.map((c) => ({ label: c }))}
              rows={preview.rows.map((row, i) => ({
                key: String(i),
                cells: row.map((v, j) => ({
                  content: v,
                  className: `px-3 py-2 ${j === 1 ? "text-slate-900 dark:text-white" : "text-slate-600 dark:text-slate-300"}`,
                })),
              }))}
            />
          </div>
        </section>
      )}

      {downloads.length > 0 && (
        <section>
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Bulk download</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Every row as Parquet, rebuilt weekly. DuckDB, pandas, R, and Polars read it directly from the link.
          </p>
          <ul className="mt-3 divide-y divide-slate-200 rounded-xl border border-slate-200 text-sm dark:divide-slate-800 dark:border-slate-800">
            {downloads.map((d) => (
              <li key={d.url} className="flex flex-wrap items-baseline justify-between gap-2 px-4 py-3">
                <a href={d.url} className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
                  {d.label}
                </a>
                <span className="text-slate-500 tabular-nums dark:text-slate-400">
                  {d.rows.toLocaleString()} rows · {formatBytes(d.bytes)} · Parquet
                </span>
              </li>
            ))}
          </ul>
          <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
            {`-- DuckDB\nSELECT * FROM '${downloads[0].url}' LIMIT 10;`}
          </pre>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">API</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {record ? (
            "Open, no key required. Returns the dataset's description and coverage."
          ) : (
            <>Open, no key required. Up to 10,000 values per request; follow <code>next</code> to page.</>
          )}
        </p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {record
            ? `GET /api/data/v1/datasets/${slug}`
            : `GET /api/data/v1/datasets/${slug}\nGET /api/data/v1/datasets/${slug}/observations?metric=${example ?? "<metric>"}&geoLevel=nation&from=2015`}
        </pre>
      </section>
    </div>
  );
}
