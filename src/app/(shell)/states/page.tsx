import type { Metadata } from "next";
import Link from "next/link";
import { StateTileNav } from "@/components/states/state-tile-nav";
import { latestByGeo } from "@/lib/db/stats";
import { formatValue } from "@/lib/format";
import { STATES_51 } from "@/lib/geo/states";
import { stateSlug } from "@/lib/states/slug";

// Rebuilt at most hourly; crawlers and visitors share the cached render.
export const revalidate = 3600;

export const metadata: Metadata = {
  title: "States | Worldview",
  description: "A profile of every state and the District of Columbia: the economy, housing, health care, crime, immigration, schools, family, religion, and elections, each compared with the U.S.",
};

export default async function StatesPage() {
  const pop = await latestByGeo([{ source: "census-pep", metric: "population" }], "state");
  const popOf = new Map(pop.map((p) => [p.geoid, p]));
  const year = pop[0]?.period;

  return (
    <div className="mx-auto max-w-7xl space-y-12">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl dark:text-white">States</h1>
        <p className="mt-4 text-lg leading-8 text-slate-600 dark:text-slate-300">
          Pick a state to see every topic on Worldview in one place — jobs, homes, health, crime, immigration, schools, family, faith, and elections —
          each beside the U.S. figure and the state&apos;s rank.
        </p>
      </header>

      <div className="max-w-2xl">
        <StateTileNav />
      </div>

      <section className="space-y-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">All states</h2>
        <ul className="grid gap-x-8 gap-y-1 sm:grid-cols-2 lg:grid-cols-3">
          {STATES_51.map((s) => (
            <li key={s.fips}>
              <Link
                href={`/states/${stateSlug(s.name)}`}
                className="flex items-baseline justify-between gap-3 border-b border-slate-100 py-2 text-sm hover:text-blue-700 dark:border-slate-800 dark:hover:text-blue-300"
              >
                <span className="font-medium text-slate-900 dark:text-white">{s.name}</span>
                <span className="text-slate-500 tabular-nums dark:text-slate-400">{formatValue(popOf.get(s.fips)?.value, "people", { compact: true })}</span>
              </Link>
            </li>
          ))}
        </ul>
        {year && <p className="text-xs text-slate-400">Population as of July 1, {year} (Census Bureau estimates).</p>}
      </section>
    </div>
  );
}
