import { ArrowRight, FileCheck2 } from "lucide-react";
import Link from "next/link";
import type { StatePath } from "@/lib/geo/state-paths";
import { SLOGAN } from "@/lib/site";
import { HeroReveal } from "./hero-reveal";
import { StateMap, type StateMeasure } from "./state-map";

export function Hero({ datasetCount, publisherCount, map, measures }: {
  datasetCount: number;
  publisherCount: number;
  map: { width: number; height: number; states: StatePath[] } | null;
  measures: StateMeasure[];
}) {
  const intro = (
    <div className="w-full rounded-xl border border-slate-200 bg-white px-4 pb-4 pt-8 shadow-[0_20px_60px_-40px_rgba(15,23,42,.35)] sm:px-8 sm:pb-5 sm:pt-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="text-center">
        <h1 className="mx-auto max-w-5xl text-5xl font-semibold leading-[.98] tracking-[-0.045em] text-slate-950 sm:text-6xl lg:text-[4.75rem] dark:text-white">
          {SLOGAN}
        </h1>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm text-slate-500 sm:gap-x-6 dark:text-slate-400">
          <p className="text-lg leading-7 text-slate-700 sm:text-xl dark:text-slate-300">American Political Data</p>
        {datasetCount > 0 ? (
          <>
            <span aria-hidden className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />
            <Link href="/datasets" className="group inline-flex items-baseline gap-1.5 hover:text-slate-900 dark:hover:text-white">
              <span className="text-lg font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">{datasetCount}</span>
              Traceable datasets <ArrowRight aria-hidden className="size-3 self-center" />
            </Link>
            <span aria-hidden className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />
            <span className="inline-flex items-baseline gap-1.5">
              <span className="text-lg font-semibold tabular-nums tracking-tight text-slate-950 dark:text-white">{publisherCount}</span>
              {publisherCount === 1 ? "Publisher" : "Publishers"}
            </span>
            <span aria-hidden className="hidden h-4 w-px bg-slate-200 sm:block dark:bg-slate-800" />
            <span className="inline-flex items-center gap-1.5">
              <FileCheck2 aria-hidden className="size-4 text-blue-700 dark:text-blue-300" />
              Definitions &amp; original sources
            </span>
          </>
        ) : null}
        </div>
      </div>

      {map && measures.length ? (
        <div className="mt-6 border-t border-slate-100 pt-4 dark:border-slate-800">
          <StateMap {...map} measures={measures} />
        </div>
      ) : null}
    </div>
  );

  return map ? <HeroReveal width={map.width} height={map.height} states={map.states} measure={measures[0]}>{intro}</HeroReveal> : intro;
}
