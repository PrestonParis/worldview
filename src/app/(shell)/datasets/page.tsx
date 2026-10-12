import type { Metadata } from "next";
import Link from "next/link";
import { DatasetList } from "@/components/data/dataset-list";
import { datasetCoverage, listDatasets } from "@/lib/db/stats";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Datasets | Worldview",
  description: "Every dataset on Worldview — publisher, method, coverage, and an open API.",
};

const TOPICS: Record<string, string> = {
  immigration: "Immigration",
  crime: "Crime & justice",
  abortion: "Abortion",
  demographics: "Demographics",
  elections: "Elections",
  money: "Money in politics",
  legislation: "Congress",
  courts: "Courts",
  executive: "Executive branch",
  government: "Government spending",
  economy: "Economy",
};

export default async function DatasetsPage() {
  const datasets = await listDatasets();
  const coverage = await datasetCoverage(datasets.map((d) => d.slug));
  const withCoverage = datasets.map((d) => ({ ...d, coverage: coverage[d.slug] ?? null }));
  const topics = [...new Set(datasets.map((d) => d.topic))].sort(
    (a, b) => Object.keys(TOPICS).indexOf(a) - Object.keys(TOPICS).indexOf(b),
  );

  return (
    <div className="mx-auto max-w-7xl space-y-12">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">Data</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Datasets</h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          Every statistic on Worldview comes from one of these datasets — public records refreshed from the agencies that
          publish them, and research data published here by partner institutions. Each is documented and available through
          an open API.
        </p>
        <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm">
          <Link href="/datasets/publish" className="font-medium text-slate-900 underline underline-offset-2 dark:text-white">
            Publish your institution&apos;s data
          </Link>
          <Link href="/api/data/v1/datasets" prefetch={false} className="text-slate-500 underline underline-offset-2 dark:text-slate-400">
            Catalog API
          </Link>
        </p>
      </header>

      {topics.map((topic) => (
        <section key={topic} className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">{TOPICS[topic] ?? topic}</h2>
          <DatasetList datasets={withCoverage.filter((d) => d.topic === topic)} />
        </section>
      ))}
    </div>
  );
}
