import { Suspense } from "react";
import type { Metadata } from "next";
import { DemographicsForecast } from "@/components/demographics/demographics-forecast";

export const metadata: Metadata = {
  title: "Demographics | Worldview",
  description: "U.S., state, and city population composition by age, sex, race, religion, and sexual orientation, with projections to 2050.",
};

export default function DemographicsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-sm font-semibold tracking-[0.14em] text-blue-700 uppercase dark:text-blue-400">United States</p>
        <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-5xl text-slate-950 dark:text-white">
          Demographic outlook
        </h1>
        <p className="mt-4 text-lg leading-8 text-slate-500 dark:text-slate-400">
          How America&apos;s population differs by place and how it may change. Past values are Census
          population estimates or survey estimates; values after the latest estimate are projections, shown as
          a range across scenarios. Each measure is published for different geographies: age, sex, and race go
          down to large cities, religion and sexual orientation to states.
        </p>
      </header>

      {/* The explorer reads ?state= / ?city= from the URL. */}
      <Suspense>
        <DemographicsForecast />
      </Suspense>
    </div>
  );
}
