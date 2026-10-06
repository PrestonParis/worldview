import { Suspense } from "react";
import type { Metadata } from "next";
import { DemographicsForecast } from "@/components/demographics/demographics-forecast";

export const metadata: Metadata = {
  title: "Demographics | Worldview",
  description: "U.S., state, and city demographic composition forecasts through 2050.",
};

export default function DemographicsPage() {
  return (
    <div className="mx-auto max-w-7xl space-y-8">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">United States</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">
          Demographic outlook
        </h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          Population shares by sex, race, sexual orientation, and religion—projected annually through 2050
          as a range between the highest and lowest scenarios. Select a state on the map, then a city.
        </p>
      </header>

      {/* The explorer reads ?state= / ?city= from the URL. */}
      <Suspense>
        <DemographicsForecast />
      </Suspense>
    </div>
  );
}
