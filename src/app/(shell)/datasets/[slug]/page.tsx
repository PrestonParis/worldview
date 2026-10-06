import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { coverageLabel } from "@/components/data/dataset-list";
import { datasetCoverage, getDataset } from "@/lib/db/stats";

export const dynamic = "force-dynamic";

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

export default async function DatasetPage({ params }: Props) {
  const { slug } = await params;
  const dataset = await getDataset(slug);
  if (!dataset) notFound();
  const coverage = (await datasetCoverage([slug]))[slug] ?? null;
  const metrics = Object.entries(dataset.metrics);
  const example = metrics[0]?.[0];

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
        {dataset.sourceUrl && (
          <a href={dataset.sourceUrl} className="mt-3 inline-block text-sm font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Original source ↗
          </a>
        )}
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
            <table className="w-full min-w-[36rem] text-sm">
              <thead className="bg-slate-50 text-left text-xs text-slate-500 dark:bg-slate-900 dark:text-slate-400">
                <tr>
                  <th className="px-3 py-2 font-medium">Measure</th>
                  <th className="px-3 py-2 font-medium">Unit</th>
                  <th className="px-3 py-2 font-medium">API name</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {metrics.map(([key, m]) => (
                  <tr key={key}>
                    <td className="px-3 py-2 text-slate-900 dark:text-white">
                      {m.label}
                      {m.description && <span className="block text-xs text-slate-500 dark:text-slate-400">{m.description}</span>}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{UNITS[m.unit] ?? m.unit}</td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-500 dark:text-slate-400">{key}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section>
        <h2 className="text-lg font-semibold text-slate-950 dark:text-white">API</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Open, no key required. Up to 10,000 values per request; follow <code>next</code> to page.</p>
        <pre className="mt-3 overflow-x-auto rounded-xl bg-slate-950 p-4 text-xs leading-6 text-slate-100">
          {`GET /api/data/v1/datasets/${slug}\nGET /api/data/v1/datasets/${slug}/observations?metric=${example ?? "<metric>"}&geoLevel=nation&from=2015`}
        </pre>
      </section>
    </div>
  );
}
