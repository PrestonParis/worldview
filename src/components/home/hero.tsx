import Link from "next/link";
import { StatTile } from "@/components/charts/stat-tile";
import type { StatePath } from "@/lib/geo/state-paths";
import { SLOGAN } from "@/lib/site";
import { HeroReveal } from "./hero-reveal";
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

export function Hero({ datasetCount, publisherCount, snapshot, map, measures }: {
  datasetCount: number;
  publisherCount: number;
  snapshot: SnapshotMetric[];
  map: { width: number; height: number; states: StatePath[] } | null;
  measures: StateMeasure[];
}) {
  const intro = (
    <>
      <div className="pt-2 text-center sm:pt-5">
        <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.75rem] dark:text-white">
          {SLOGAN}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-7 text-slate-600 sm:text-lg dark:text-slate-300">
          Data across every facet of American Politics
        </p>

        {datasetCount > 0 ? (
          <p className="mt-4 text-xs leading-5 text-slate-500 dark:text-slate-400">
            <Link href="/datasets" className="font-semibold text-slate-800 hover:underline dark:text-slate-200">{datasetCount} traceable datasets</Link>{" "}
            · {publisherCount} {publisherCount === 1 ? "publisher" : "publishers"} · definitions and original sources attached
          </p>
        ) : null}
      </div>

      {map && measures.length ? (
        <div className="mt-8 w-full rounded-xl border border-slate-200 bg-white p-4 shadow-[0_20px_60px_-40px_rgba(15,23,42,.35)] sm:p-5 dark:border-slate-800 dark:bg-slate-950">
          <StateMap {...map} measures={measures} />
        </div>
      ) : null}
    </>
  );

  return (
    <section className="pb-9">
      {map ? <HeroReveal width={map.width} height={map.height} states={map.states} measure={measures[0]}>{intro}</HeroReveal> : intro}

      {snapshot.length ? (
        <div className="mt-7 border-y border-slate-200 py-4 dark:border-slate-800">
          <h2 className="mb-3 text-sm font-semibold text-slate-900 dark:text-white">Latest national figures</h2>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-4">
            {snapshot.slice(0, 4).map((metric) => (
              <div key={metric.label} className="min-w-[16rem] snap-start sm:min-w-0">
                <StatTile compact label={metric.label} value={metric.value} unit={metric.unit} period={metric.period} change={metric.change} compareLabel={metric.compareLabel} spark={metric.spark} href={metric.href} />
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
