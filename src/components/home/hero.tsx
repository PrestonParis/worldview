import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { GlobalSearch } from "@/components/search/global-search";
import { formatValue } from "@/lib/format";
import { SLOGAN } from "@/lib/site";

export interface SnapshotMetric {
  label: string;
  value: number | null;
  unit: string;
  period?: string;
  change?: number | null;
  href: string;
  source: string;
}

const EXAMPLE_SEARCHES = [
  "Search people, elections, issues, and datasets",
  "Try “Hispanic population in Texas”",
  "Try “2024 presidential election”",
  "Try “H-1B immigration”",
  "Try “Nancy Mace”",
];

const QUICK_LINKS = [
  ["Immigration", "/immigration"],
  ["Crime", "/crime"],
  ["Elections", "/elections"],
  ["Political money", "/money"],
] as const;

export function Hero({ datasetCount, publisherCount, snapshot }: {
  datasetCount: number;
  publisherCount: number;
  snapshot: SnapshotMetric[];
}) {
  return (
    <section className="grid gap-12 border-b border-slate-200 pb-14 pt-8 lg:grid-cols-[1.05fr_.95fr] lg:items-start lg:gap-20 lg:pb-20 lg:pt-14 dark:border-slate-800">
      <div>
        <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Public data for understanding the United States</p>
        <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-[4.25rem] dark:text-white">
          {SLOGAN}
        </h1>
        <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-600 dark:text-slate-300">
          Every figure on Worldview comes from a government record or published study — immigration, crime, elections, demographics, political money, and Congress — and links back to where it came from.
        </p>

        <div className="mt-8 max-w-2xl">
          <GlobalSearch size="lg" placeholders={EXAMPLE_SEARCHES} />
          <p className="mt-2.5 text-sm text-slate-500 dark:text-slate-400">Search people, organizations, claims, and source records.</p>
        </div>

        <nav aria-label="Popular sections" className="mt-7 flex flex-wrap gap-x-5 gap-y-3">
          {QUICK_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
              {label}<ArrowRight size={14} aria-hidden />
            </Link>
          ))}
        </nav>

        {datasetCount > 0 ? (
          <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
            <Link href="/datasets" className="font-medium text-slate-800 hover:underline dark:text-slate-200">{datasetCount} public datasets</Link>{" "}
            from {publisherCount} {publisherCount === 1 ? "publisher" : "publishers"}. Check any of them at the source.
          </p>
        ) : null}
      </div>

      <div className="border-t-2 border-slate-950 pt-4 dark:border-white">
        <div className="flex items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-slate-950 dark:text-white">Latest figures, straight from the record</h2>
          <span className="text-sm text-slate-500 dark:text-slate-400">Latest available release</span>
        </div>
        <div className="mt-3 divide-y divide-slate-200 border-b border-slate-200 dark:divide-slate-800 dark:border-slate-800">
          {snapshot.slice(0, 4).map((metric) => (
            <Link key={metric.label} href={metric.href} className="group grid grid-cols-[1fr_auto] gap-5 py-5">
              <div>
                <p className="font-medium text-slate-900 group-hover:text-blue-700 dark:text-slate-100 dark:group-hover:text-blue-300">{metric.label}</p>
                <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metric.source}{metric.period ? ` · ${metric.period}` : ""}</p>
              </div>
              <div className="text-right">
                <p className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">{formatValue(metric.value, metric.unit, { compact: true })}</p>
                {metric.change != null && Number.isFinite(metric.change) ? (
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{metric.change > 0 ? "+" : ""}{metric.change.toFixed(1)}%</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
        <Link href="/datasets" className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:underline dark:text-blue-300">
          Browse datasets <ArrowRight size={14} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
