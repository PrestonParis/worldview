import Link from "next/link";
import { GlobalSearch } from "@/components/search/global-search";
import { StatTile } from "@/components/charts/stat-tile";
import type { StatePath } from "@/lib/geo/state-paths";
import { SLOGAN } from "@/lib/site";
import { HERO_SEARCH_ID } from "./hero-search-id";
import { StateMap, type StateMeasure } from "./state-map";

export interface SnapshotMetric {
  label: string;
  value: number | null;
  unit: string;
  period?: string;
  change?: number | null;
  compareLabel?: string;
  spark?: number[];
  href: string;
}

const EXAMPLE_SEARCHES = [
  "Search people, elections, issues, and datasets",
  "Try “Hispanic population in Texas”",
  "Try “2024 presidential election”",
  "Try “H-1B immigration”",
  "Try “Nancy Mace”",
];

export function Hero({ datasetCount, publisherCount, snapshot, map, measures }: {
  datasetCount: number;
  publisherCount: number;
  snapshot: SnapshotMetric[];
  map: { width: number; height: number; states: StatePath[] } | null;
  measures: StateMeasure[];
}) {
  return (
    <section className="border-b border-slate-200 pb-14 pt-8 lg:pt-12 dark:border-slate-800">
      <div className="grid gap-12 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-16">
        <div>
          <p className="text-sm font-semibold text-slate-500 dark:text-slate-400">Public data for understanding the United States</p>
          <h1 className="mt-3 max-w-3xl text-5xl font-semibold leading-[1.02] tracking-[-0.04em] text-slate-950 sm:text-6xl lg:text-[4.25rem] dark:text-white">
            {SLOGAN}
          </h1>
          <p className="mt-5 max-w-2xl text-[17px] leading-7 text-slate-600 dark:text-slate-300">
            Every figure on Worldview comes from a government record or published study — immigration, crime, elections, demographics, political money, and Congress — and links back to where it came from.
          </p>

          <div id={HERO_SEARCH_ID} className="mt-8 max-w-2xl">
            <GlobalSearch size="lg" placeholders={EXAMPLE_SEARCHES} />
          </div>

          {datasetCount > 0 ? (
            <p className="mt-6 text-sm text-slate-500 dark:text-slate-400">
              <Link href="/datasets" className="font-medium text-slate-800 hover:underline dark:text-slate-200">{datasetCount} public datasets</Link>{" "}
              from {publisherCount} {publisherCount === 1 ? "publisher" : "publishers"}. Check any of them at the source.
            </p>
          ) : null}
        </div>

        {map && measures.length ? <StateMap {...map} measures={measures} /> : null}
      </div>

      {snapshot.length ? (
        <div className="mt-14">
          <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400">Latest figures, straight from the record</h2>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.slice(0, 4).map((metric) => (
              <StatTile
                key={metric.label}
                label={metric.label}
                value={metric.value}
                unit={metric.unit}
                period={metric.period}
                change={metric.change}
                compareLabel={metric.compareLabel}
                spark={metric.spark}
                href={metric.href}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
