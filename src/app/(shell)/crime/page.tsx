import type { Metadata } from "next";
import { ChartCard } from "@/components/charts/chart-card";
import { StatTile } from "@/components/charts/stat-tile";
import { StateExplorer } from "@/components/charts/state-explorer";
import { TimeSeriesChart } from "@/components/charts/time-series-chart";
import { DatasetList } from "@/components/data/dataset-list";
import { loadCrime } from "@/lib/crime/data";
import { formatValue } from "@/lib/format";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Crime | Worldview",
  description: "Reported crime in the United States — violent and property crime rates nationally and by state, from the FBI.",
};

const SOURCE = { label: "FBI Crime Data Explorer", href: "/datasets/fbi-cde" };

export default async function CrimePage() {
  const d = await loadCrime();
  const tile = (label: string, h: (typeof d.headline)["violent"]) => (
    <StatTile label={label} unit="per_100k" value={h.value} period={`${d.year} · per 100,000`} change={h.change} compareLabel={`vs ${d.priorYear}`} spark={h.spark} />
  );

  return (
    <div className="mx-auto max-w-7xl space-y-14">
      <header className="max-w-3xl">
        <p className="text-xs font-semibold tracking-[0.18em] text-slate-400 uppercase">United States</p>
        <h1 className="mt-2 text-4xl font-semibold tracking-tight text-slate-950 dark:text-white">Crime</h1>
        <p className="mt-3 text-base leading-7 text-slate-500 dark:text-slate-400">
          Offenses reported to police, as rates per 100,000 residents so years and states compare fairly — nationally and
          for every state, updated monthly from the FBI.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        {tile("Violent crime rate", d.headline.violent)}
        {tile("Murder rate", d.headline.homicide)}
        {tile("Property crime rate", d.headline.property)}
      </div>

      <section className="space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">National trend</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">
            Annual rates per 100,000 residents for complete calendar years. Violent crime covers murder, rape, robbery, and
            aggravated assault; property crime covers burglary, larceny-theft, and motor vehicle theft.
            {d.latestMonth && (
              <>
                {" "}Monthly figures for {d.year && Number(d.year) + 1} onward are still coming in — agencies covering{" "}
                {formatValue(d.latestMonth.coverage, "percent")} of the population have reported for {d.latestMonth.label} — so
                this page compares complete years.
              </>
            )}
          </p>
        </div>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {d.annual.map((o) => (
            <ChartCard
              key={o.key}
              title={o.label}
              subtitle="Per 100,000 residents, per year"
              source={SOURCE}
              table={{ columns: ["Year", "Rate"], rows: [...o.points].reverse().map((p) => [p.label, formatValue(p.value, "per_100k")]) }}
            >
              <TimeSeriesChart series={[{ id: o.key, label: o.label, slot: 1, points: o.points }]} type="column" unit="per_100k" height={180} />
            </ChartCard>
          ))}
        </div>
      </section>

      <section className="space-y-5">
        <div className="max-w-3xl">
          <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Across the states</h2>
          <p className="mt-2 text-sm leading-6 text-slate-500 dark:text-slate-400">Rates per 100,000 residents in {d.year}.</p>
        </div>
        <StateExplorer metrics={d.states.metrics} rows={d.states.rows} />
      </section>

      <section className="space-y-5">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-950 dark:text-white">Sources</h2>
        <DatasetList datasets={d.datasets} />
      </section>
    </div>
  );
}
